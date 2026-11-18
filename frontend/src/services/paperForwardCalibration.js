const STORAGE_KEY = 'mwathe:paper-forward:v2';
const MAX_RECORDS = 5000;
const MIN_CALIBRATION_TRADES = 200;
const SAFETY_MARGIN = 0.02;
const Z_95 = 1.96;
const pending = new Map();
let memoryRows = [];

export function paperProfile(signal = {}) {
  return [signal.symbol || 'unknown', signal.tradeType || '', signal.subTradeType || '',
    signal.option || '', signal.predictedDigit ?? 'na', signal.barrier ?? 'na',
    signal.duration ?? 'na', signal.timeframeUnit || '', signal.currency || ''].join('|');
}
function readRows() {
  try {
    if (typeof localStorage === 'undefined') return memoryRows;
    const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(rows) ? rows.filter(row => Number.isFinite(row.askPrice) && Number.isFinite(row.payout) && row.askPrice > 0 && row.payout > row.askPrice) : [];
  } catch { return memoryRows; }
}
function writeRows(rows) {
  memoryRows = rows.slice(-MAX_RECORDS);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryRows)); } catch {}
}
function digitOf(quote) {
  const value = Number(quote);
  if (!Number.isFinite(value)) return null;
  const text = String(quote);
  const decimals = text.includes('.') ? text.split('.')[1] : '';
  return Number((decimals || text).slice(-1));
}
export function wilsonLowerBound(wins, trades, z = Z_95) {
  const n = Number(trades), w = Number(wins);
  if (!Number.isFinite(n) || !Number.isFinite(w) || n <= 0 || w < 0 || w > n) return null;
  const p = w / n, z2 = z * z, denominator = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) / n) + z2 / (4 * n * n));
  return Math.max(0, (center - spread) / denominator);
}
export function beginPaperTrial(signal, { now = Date.now(), quote } = {}) {
  if (!signal || signal.tradeType !== 'Digits' || signal.timeframeUnit !== 'Ticks'
      || !Number.isInteger(Number(signal.duration)) || Number(signal.duration) < 1
      || !['Over/Under', 'Matches/Differs', 'Even/Odd'].includes(signal.subTradeType)
      || !['Over', 'Under', 'Matches', 'Differs', 'Even', 'Odd'].includes(signal.option)) return false;
  const askPrice = Number(quote?.askPrice), payout = Number(quote?.payout);
  if (!Number.isFinite(askPrice) || !Number.isFinite(payout) || askPrice <= 0 || payout <= askPrice) return false;
  const key = paperProfile(signal);
  if ([...pending.values()].some(item => item.key === key)) return false;
  pending.set(signal.id || `${key}:${now}`, {
    key, signal: { ...signal }, remaining: Number(signal.duration), startedAt: now,
    quote: { askPrice, payout, currency: quote.currency || signal.currency || 'unknown',
      breakEvenRate: askPrice / payout, quotedAt: Number(quote.quotedAt || now) }
  });
  return true;
}
export function advancePaperTrials(symbol, quote, { now = Date.now() } = {}) {
  const digit = digitOf(quote);
  if (digit === null) return [];
  const completed = [];
  for (const [id, trial] of pending) {
    if (trial.signal.symbol !== symbol) continue;
    trial.remaining -= 1;
    if (trial.remaining > 0) continue;
    const { option, predictedDigit } = trial.signal;
    const target = Number(predictedDigit);
    const won = option === 'Over' ? digit > target : option === 'Under' ? digit < target
      : option === 'Matches' ? digit === target : option === 'Differs' ? digit !== target
      : option === 'Even' ? digit % 2 === 0 : digit % 2 === 1;
    const row = { key: trial.key, symbol, tradeType: 'Digits', subTradeType: trial.signal.subTradeType,
      option, predictedDigit: target, barrier: trial.signal.barrier ?? null,
      duration: trial.signal.duration, timeframeUnit: 'Ticks', currency: trial.quote.currency,
      askPrice: trial.quote.askPrice, payout: trial.quote.payout,
      breakEvenRate: trial.quote.breakEvenRate, quotedAt: trial.quote.quotedAt,
      entryAt: trial.startedAt, settledAt: now, terminalDigit: digit, won };
    const rows = readRows(); rows.push(row); writeRows(rows);
    pending.delete(id);
    completed.push(row);
  }
  return completed;
}
export function getPaperForwardSummary(signal = null) {
  const rows = readRows();
  const filtered = signal ? rows.filter(row => row.key === paperProfile(signal)) : rows;
  const wins = filtered.filter(row => row.won).length;
  const trades = filtered.length;
  const lowerBound = wilsonLowerBound(wins, trades);
  const maxBreakEvenRate = trades ? Math.max(...filtered.map(row => row.breakEvenRate)) : null;
  const calibrated = trades >= MIN_CALIBRATION_TRADES && lowerBound !== null
    && lowerBound > maxBreakEvenRate + SAFETY_MARGIN;
  return { trades, wins, losses: trades - wins, winRate: trades ? wins / trades : null,
    lowerBound, maxBreakEvenRate, safetyMargin: SAFETY_MARGIN, minTrades: MIN_CALIBRATION_TRADES,
    calibrated, pending: signal ? [...pending.values()].filter(item => item.key === paperProfile(signal)).length : pending.size,
    note: 'Quote-matched forward paper outcomes. Calibration is local to this browser and research-only; it does not authorize live trading.' };
}
export function resetPaperTrials() { pending.clear(); }
