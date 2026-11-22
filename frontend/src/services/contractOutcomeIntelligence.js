const STORAGE_KEY = 'mwathe:contract-outcomes:v1';
const MAX_RECORDS = 5000;
const FORWARD_STORAGE_KEY = 'mwathe:contract-forward-outcomes:v1';
const MIN_FORWARD_TRADES = 200;
const TARGET_WIN_RATE = 0.90;
const SAFETY_MARGIN = 0.02;

const readForward = () => {
  try {
    const value = JSON.parse(localStorage.getItem(FORWARD_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
};

const writeForward = rows => {
  try { localStorage.setItem(FORWARD_STORAGE_KEY, JSON.stringify(rows.slice(-MAX_RECORDS))); }
  catch { /* Calibration persistence must not interrupt contract settlement handling. */ }
};

const wilsonLowerBound = (wins, trades, z = 1.96) => {
  if (!Number.isFinite(wins) || !Number.isFinite(trades) || trades <= 0 || wins < 0 || wins > trades) return null;
  const p = wins / trades, z2 = z * z, denominator = 1 + z2 / trades;
  const center = p + z2 / (2 * trades);
  const spread = z * Math.sqrt((p * (1 - p) / trades) + z2 / (4 * trades * trades));
  return Math.max(0, (center - spread) / denominator);
};

const forwardProfile = (signal, currency = 'USD') => [contractProfile(signal), currency || 'USD', signal.multiplier ?? 'na', signal.growthRate ?? 'na', signal.takeProfit ?? 'na', signal.contractStopLoss ?? 'na'].join('|');

const read = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
};

export function contractProfile(signal = {}) {
  const digitTargetApplies = signal.tradeType === 'Digits'
    && ['Over/Under', 'Matches/Differs'].includes(signal.subTradeType);
  const barrierApplies = digitTargetApplies || signal.tradeType === 'Touch & No Touch'
    || signal.subTradeType === 'Higher/Lower';
  return [
    signal.symbol || 'unknown-market',
    signal.tradeType || 'unknown-type',
    signal.subTradeType || 'default',
    signal.option || 'unknown-option',
    digitTargetApplies ? (signal.predictedDigit ?? 'na') : 'na',
    barrierApplies ? (signal.barrier ?? signal.predictedDigit ?? 'na') : 'na',
    signal.duration ?? 'na',
    signal.timeframeUnit || 'na'
  ].join('|');
}

export function recordContractOutcome(signal, { profit, stake, contractId, bot = 'unknown', accountType = 'real', quote } = {}) {
  if (typeof window === 'undefined' || !Number.isFinite(Number(profit))) return null;
  const records = read();
  const row = {
    key: contractProfile(signal), symbol: signal.symbol || 'unknown-market',
    tradeType: signal.tradeType || 'unknown-type', subTradeType: signal.subTradeType || '',
    option: signal.option || '', predictedDigit: signal.predictedDigit ?? null,
    barrier: signal.barrier ?? null, duration: signal.duration ?? null,
    timeframeUnit: signal.timeframeUnit || '', profit: Number(profit),
    stake: Math.max(0, Number(stake) || 0), won: Number(profit) > 0,
    contractId: contractId ? String(contractId) : null, bot, settledAt: Date.now()
  };
  records.push(row);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS))); }
  catch { /* Keep trading independent from optional browser storage. */ }
  const askPrice = Number(quote?.ask_price ?? quote?.askPrice);
  const payout = Number(quote?.payout);
  if (accountType === 'demo' && contractId && Number.isFinite(askPrice) && Number.isFinite(payout)
      && askPrice > 0 && payout > askPrice) {
    const forwardRows = readForward();
    if (!forwardRows.some(item => String(item.contractId) === String(contractId))) {
      forwardRows.push({
        key: forwardProfile(signal, quote?.currency || signal.currency || 'USD'),
        contractId: String(contractId), accountType: 'demo',
        won: Number(profit) > 0, profit: Number(profit), stake: Math.max(0, Number(stake) || 0),
        askPrice, payout, breakEvenRate: askPrice / payout,
        quotedAt: Number(quote?.date_start || quote?.quotedAt || Date.now()),
        settledAt: Date.now()
      });
      writeForward(forwardRows);
    }
  }
  return getContractPerformance(signal);
}

export function getContractPerformance(signal = {}) {
  const key = contractProfile(signal);
  const matching = read().filter(row => row.key === key);
  const wins = matching.filter(row => row.won).length;
  const trades = matching.length;
  return {
    key, trades, wins, losses: trades - wins,
    winRate: trades ? wins / trades : null,
    netProfit: matching.reduce((sum, row) => sum + Number(row.profit || 0), 0),
    sampleSufficient: trades >= 100,
    note: trades < 100 ? 'Insufficient settled trades for reliable calibration.' : 'Historical descriptive statistics only; validate out of sample.'
  };
}

/**
 * Forward evidence is sourced only from broker-settled DEMO contracts. The
 * profile key includes every contract-defining field plus currency. This
 * same calibration gate can therefore protect every supported contract family
 * without pretending that their settlement rules are identical.
 */
export function getForwardContractCalibration(signal = {}, currency = 'USD') {
  const key = forwardProfile(signal, currency);
  const matching = readForward().filter(row => row.key === key && row.accountType === 'demo'
    && Number.isFinite(row.breakEvenRate) && row.breakEvenRate > 0 && row.breakEvenRate < 1);
  const trades = matching.length;
  const wins = matching.filter(row => row.won).length;
  const winRate = trades ? wins / trades : null;
  const recent = matching.slice(-50);
  const recentTrades = recent.length;
  const recentWins = recent.filter(row => row.won).length;
  const recentWinRate = recentTrades ? recentWins / recentTrades : null;
  const lowerBound = wilsonLowerBound(wins, trades);
  const maxBreakEvenRate = trades ? Math.max(...matching.map(row => row.breakEvenRate)) : null;
  const calibrated = trades >= MIN_FORWARD_TRADES && winRate >= TARGET_WIN_RATE
    && recentTrades >= 50 && recentWinRate >= TARGET_WIN_RATE
    && lowerBound !== null && maxBreakEvenRate !== null
    && lowerBound > maxBreakEvenRate + SAFETY_MARGIN;
  return {
    key, trades, wins, losses: trades - wins, winRate,
    recentTrades, recentWins, recentWinRate, lowerBound, maxBreakEvenRate,
    minTrades: MIN_FORWARD_TRADES, targetWinRate: TARGET_WIN_RATE,
    safetyMargin: SAFETY_MARGIN, calibrated
  };
}

export function getContractOutcomeSummary() {
  const rows = read();
  const groups = new Map();
  rows.forEach(row => {
    const current = groups.get(row.key) || { key: row.key, trades: 0, wins: 0, netProfit: 0 };
    current.trades += 1; current.wins += row.won ? 1 : 0; current.netProfit += Number(row.profit || 0);
    groups.set(row.key, current);
  });
  return [...groups.values()].map(row => ({ ...row, losses: row.trades - row.wins, winRate: row.wins / row.trades }));
}
