// Shared account- and strategy-level risk intelligence for both trading robots.
// Scores rank candidates; this module uses settled outcomes and account limits to govern risk.
const OUTCOME_KEY = 'mwathe:contract-outcomes:v1';
const MAX_RECENT = 30;
const STRATEGY_LOSS_COOLDOWN_MS = 10 * 60 * 1000;
const MIN_80_SAMPLE = 200;

function readOutcomes() {
  try {
    const rows = JSON.parse(localStorage.getItem(OUTCOME_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

export function strategyRecoveryProfile(signal = {}) {
  const digitTargetApplies = signal.tradeType === 'Digits'
    && ['Over/Under', 'Matches/Differs'].includes(signal.subTradeType);
  const barrierApplies = digitTargetApplies || signal.tradeType === 'Touch & No Touch'
    || signal.subTradeType === 'Higher/Lower';
  return [
    signal.tradeType || 'unknown-type', signal.subTradeType || 'default',
    signal.option || 'unknown-option',
    digitTargetApplies ? (signal.predictedDigit ?? 'na') : 'na',
    barrierApplies ? (signal.barrier ?? signal.predictedDigit ?? 'na') : 'na',
    signal.duration ?? 'na', signal.timeframeUnit || 'na'
  ].join('|');
}

export function getStrategyRecoveryState(signal = {}, { now = Date.now() } = {}) {
  const key = strategyRecoveryProfile(signal);
  const matching = readOutcomes().filter(row => (row.strategyKey || strategyRecoveryProfile(row)) === key)
    .sort((a, b) => Number(a.settledAt || 0) - Number(b.settledAt || 0));
  const recent = matching.slice(-MAX_RECENT);
  let consecutiveLosses = 0;
  for (let i = matching.length - 1; i >= 0 && !matching[i].won; i--) consecutiveLosses++;
  const wins = recent.filter(row => row.won).length;
  const trades = recent.length;
  const netProfit = recent.reduce((sum, row) => sum + Number(row.profit || 0), 0);
  const lastLossAt = [...matching].reverse().find(row => !row.won)?.settledAt || 0;
  const pausedUntil = consecutiveLosses >= 2 && lastLossAt
    ? Number(lastLossAt) + STRATEGY_LOSS_COOLDOWN_MS : 0;
  const historicalTrades = matching.length;
  const historicalWinRate = historicalTrades ? matching.filter(row => row.won).length / historicalTrades : null;
  return {
    key, trades, wins, losses: trades - wins,
    winRate: trades ? wins / trades : null, netProfit, consecutiveLosses,
    historicalTrades, historicalWinRate,
    meets80PercentTarget: historicalTrades >= MIN_80_SAMPLE && historicalWinRate >= 0.8,
    paused: pausedUntil > now, pausedUntil,
    reason: pausedUntil > now
      ? 'This exact strategy profile has lost twice consecutively across markets; cooling down globally.'
      : historicalTrades >= MIN_80_SAMPLE && historicalWinRate < 0.8
        ? 'This profile is below the 80% historical win-rate target; increase selectivity and review calibration.'
        : 'No strategy-level loss lock is active.'
  };
}

// Theoretical digit frequencies are complexity references, not forecasts.
// Real execution still requires live market evidence and quote-specific break-even checks.
export function getTradeDifficulty(signal = {}) {
  if (signal.tradeType !== 'Digits') {
    return { baselineWinRate: null, difficulty: 'contract-specific', note: 'Requires contract-specific payout and forward calibration.' };
  }
  const option = signal.option;
  const barrier = Number(signal.predictedDigit ?? signal.barrier);
  let baselineWinRate = null;
  if (signal.subTradeType === 'Even/Odd' && ['Even', 'Odd'].includes(option)) baselineWinRate = 0.5;
  if (signal.subTradeType === 'Matches/Differs' && ['Matches', 'Differs'].includes(option)) baselineWinRate = option === 'Matches' ? 0.1 : 0.9;
  if (signal.subTradeType === 'Over/Under' && Number.isInteger(barrier) && barrier >= 0 && barrier <= 9) {
    baselineWinRate = option === 'Over' ? (9 - barrier) / 10
      : option === 'Under' ? barrier / 10 : null;
  }
  if (baselineWinRate === null) return { baselineWinRate: null, difficulty: 'unknown', note: 'Invalid or incomplete digit contract parameters.' };
  const difficulty = baselineWinRate >= 0.7 ? 'lower-theoretical-difficulty'
    : baselineWinRate >= 0.45 ? 'moderate-theoretical-difficulty' : 'higher-theoretical-difficulty';
  return {
    baselineWinRate, difficulty,
    note: 'Uniform-digit theoretical baseline only; not a live win probability. Duration, market dependence, payout and quote must be evaluated separately.'
  };
}

export function evaluateAccountRisk({
  balance, equity = balance, sessionPL = 0, targetProfit, stopLoss, nextStake = 0,
  baseStake = nextStake
} = {}) {
  const numeric = value => value === null || value === undefined || value === ''
    ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const b = numeric(balance), e = numeric(equity), pl = numeric(sessionPL) ?? 0;
  const target = numeric(targetProfit), lossLimit = numeric(stopLoss), stakeValue = numeric(nextStake) ?? 0;
  const targetRemaining = target === null ? null : Math.max(0, target - pl);
  const lossRemaining = lossLimit === null ? null : Math.max(0, lossLimit + pl);
  const targetReached = target !== null && pl >= target;
  const stopReached = lossLimit !== null && pl <= -lossLimit;
  const balanceUnsafe = b !== null && stakeValue > b;
  const stopForRisk = stopReached || balanceUnsafe || (lossRemaining !== null && stakeValue > lossRemaining);
  return {
    balance: b, equity: e, sessionPL: pl, targetRemaining, lossRemaining,
    targetProgress: target && target > 0 ? Math.max(0, Math.min(1, pl / target)) : null,
    stopReached, targetReached, balanceUnsafe, stopForRisk,
    baseStake: numeric(baseStake),
    status: targetReached ? 'target-reached' : stopReached ? 'stop-loss-reached'
      : stopForRisk ? 'risk-limit' : targetRemaining !== null && targetRemaining <= Math.max(stakeValue * 2, 0) ? 'near-target' : 'active'
  };
}
