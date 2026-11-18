const STORAGE_KEY = 'mwathe:contract-outcomes:v1';
const MAX_RECORDS = 5000;

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

export function recordContractOutcome(signal, { profit, stake, contractId, bot = 'unknown' } = {}) {
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
