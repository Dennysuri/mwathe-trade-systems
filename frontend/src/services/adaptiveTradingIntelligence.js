const STORAGE_KEY = 'mwathe:adaptive-trading:v1';
const MAX_ROWS = 2000;

const readRows = () => {
  try {
    const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
};
const writeRows = rows => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-MAX_ROWS))); } catch {}
};

// Deliberately excludes market symbol: a losing strategy cannot escape its
// cooldown simply by hopping to another volatility index.
export function adaptiveStrategyKey(signal = {}) {
  const digitTargetMatters = signal.tradeType === 'Digits'
    && ['Over/Under', 'Matches/Differs'].includes(signal.subTradeType);
  return [
    signal.tradeType || '', signal.subTradeType || '', signal.option || '',
    signal.timeframeUnit || '', Number(signal.duration) || '',
    digitTargetMatters ? (signal.predictedDigit ?? '') : '',
    signal.barrier ?? ''
  ].join('|');
}

export function getContractDifficulty(signal = {}) {
  if (signal.tradeType === 'Digits') {
    const target = Number(signal.predictedDigit);
    if (signal.subTradeType === 'Over/Under') {
      const winChance = signal.option === 'Over' ? (9 - target) / 10
        : signal.option === 'Under' ? target / 10 : null;
      return { theoreticalWinChance: winChance, difficulty: winChance == null ? null : 1 - winChance,
        note: 'Digit-count baseline only; Deriv payout and live distribution still determine break-even.' };
    }
    if (signal.subTradeType === 'Matches/Differs') {
      const winChance = signal.option === 'Matches' ? 0.1 : signal.option === 'Differs' ? 0.9 : null;
      return { theoreticalWinChance: winChance, difficulty: winChance == null ? null : 1 - winChance,
        note: 'Uniform-digit baseline; not a forecast.' };
    }
    if (signal.subTradeType === 'Even/Odd') {
      return { theoreticalWinChance: 0.5, difficulty: 0.5,
        note: 'Parity baseline is 50%; short-term runs do not establish an edge.' };
    }
  }
  return { theoreticalWinChance: null, difficulty: null,
    note: 'Difficulty must be estimated from the exact contract quote and forward-settled outcomes.' };
}

export function recordAdaptiveOutcome(signal, { profit, stake, bot = 'unknown', now = Date.now() } = {}) {
  if (!signal || !Number.isFinite(Number(profit))) return null;
  const rows = readRows();
  const key = adaptiveStrategyKey(signal);
  rows.push({ key, profit: Number(profit), stake: Math.max(0, Number(stake) || 0),
    won: Number(profit) > 0, bot, symbol: signal.symbol || '', settledAt: now });
  writeRows(rows);
  return getAdaptiveStrategyStatus(signal, now);
}

export function getAdaptiveStrategyStatus(signal = {}, now = Date.now()) {
  const key = adaptiveStrategyKey(signal);
  const matching = readRows().filter(row => row.key === key).slice(-20);
  let consecutiveLosses = 0;
  for (let i = matching.length - 1; i >= 0 && !matching[i].won; i--) consecutiveLosses++;
  const wins = matching.filter(row => row.won).length;
  const trades = matching.length;
  const winRate = trades ? wins / trades : null;
  const netProfit = matching.reduce((sum, row) => sum + Number(row.profit || 0), 0);
  const last = matching.at(-1);
  const cooldownMs = consecutiveLosses >= 3 ? 15 * 60_000
    : consecutiveLosses === 2 ? 5 * 60_000
    : consecutiveLosses === 1 ? 45_000 : 0;
  const blockedUntil = last && cooldownMs ? last.settledAt + cooldownMs : 0;
  return { key, trades, wins, losses: trades - wins, winRate, netProfit,
    consecutiveLosses, blocked: blockedUntil > now, blockedUntil,
    targetWinRate: 0.8,
    winRateTargetMet: trades >= 20 && winRate >= 0.8,
    status: trades < 20 ? 'building-evidence' : winRate >= 0.8 ? 'target-met' : 'below-target' };
}

export function evaluateAccountRisk({ balance, sessionPL = 0, targetProfit, stopLoss, nextStake = 0 } = {}) {
  const target = Math.max(0, Number(targetProfit) || 0);
  const stop = Math.max(0, Number(stopLoss) || 0);
  const pl = Number(sessionPL) || 0;
  const remainingToTarget = target > 0 ? Math.max(0, target - pl) : null;
  const remainingLossRoom = stop > 0 ? Math.max(0, stop + pl) : null;
  const balanceValue = Number(balance);
  const validBalance = Number.isFinite(balanceValue) && balanceValue >= 0;
  const stopHit = stop > 0 && pl <= -stop;
  const targetHit = target > 0 && pl >= target;
  const insufficientLossRoom = remainingLossRoom !== null && Number(nextStake) > remainingLossRoom;
  const insufficientBalance = validBalance && Number(nextStake) > balanceValue;
  const balanceUnavailable = !validBalance;
  return { balance: validBalance ? balanceValue : null, sessionPL: pl,
    remainingToTarget, remainingLossRoom, targetHit, stopHit,
    insufficientLossRoom, insufficientBalance, balanceUnavailable,
    allowEntry: !balanceUnavailable && !insufficientBalance && !stopHit && !targetHit && !insufficientLossRoom,
    message: balanceUnavailable ? 'Waiting for a verified account balance'
      : stopHit ? 'Session stop-loss reached' : targetHit ? 'Target profit reached'
      : insufficientBalance ? 'Next stake exceeds available account balance'
      : insufficientLossRoom ? 'Next stake exceeds remaining stop-loss allowance' : 'Within configured session limits' };
}
