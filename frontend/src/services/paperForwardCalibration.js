const STORAGE_KEY = 'mwathe:paper-forward:v2';
const MAX_RECORDS = 5000;
const MIN_CALIBRATION_TRADES = 200;
const SAFETY_MARGIN = 0.02;
const TARGET_WIN_RATE = 0.90;
const Z_95 = 1.96;
const pending = new Map();
let memoryRows = [];

export function paperProfile(signal = {}) {
  const targetApplies = ['Over/Under', 'Matches/Differs'].includes(signal.subTradeType);
  return [signal.symbol || 'unknown', signal.tradeType || '', signal.subTradeType || '',
    signal.option || '', targetApplies ? (signal.predictedDigit ?? 'na') : 'na',
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
function digitOf(input) {
  const quote = input && typeof input === 'object' ? input.quote : input;
  const pipSize = input && typeof input === 'object' ? Number(input.pipSize) : NaN;
  const value = Number(quote);
  if (!Number.isFinite(value)) return null;
  const decimals = Number.isInteger(pipSize) && pipSize >= 0 && pipSize <= 10
    ? value.toFixed(pipSize).split('.')[1] || ''
    : (String(quote).split('.')[1] || '');
  const finalDigit = decimals ? decimals.slice(-1) : String(Math.abs(Math.trunc(value))).slice(-1);
  return Number(finalDigit);
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
export function advancePaperTrials(symbol, quote, { now = Date.now(), pipSize } = {}) {
  const digit = digitOf(quote && typeof quote === 'object' ? quote : { quote, pipSize });
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
/**
 * Persist the actual settled Deriv demo contract result against its exact
 * proposal quote. This is stronger calibration evidence than a synthetic
 * paper path because it uses the broker-confirmed contract outcome.
 */
export function recordSettledContractOutcome(signal, { quote, profit, contractId, now = Date.now() } = {}) {
  if (!signal || signal.tradeType !== 'Digits' || signal.timeframeUnit !== 'Ticks'
      || !['Over/Under', 'Matches/Differs', 'Even/Odd'].includes(signal.subTradeType)
      || !['Over', 'Under', 'Matches', 'Differs', 'Even', 'Odd'].includes(signal.option)) return null;
  const askPrice = Number(quote?.ask_price ?? quote?.askPrice);
  const payout = Number(quote?.payout);
  const settledProfit = Number(profit);
  if (!Number.isFinite(askPrice) || !Number.isFinite(payout) || !Number.isFinite(settledProfit)
      || askPrice <= 0 || payout <= askPrice) return null;
  const key = paperProfile(signal);
  const rows = readRows();
  if (contractId && rows.some(row => row.contractId === contractId)) return getPaperForwardSummary(signal);
  rows.push({
    key, symbol: signal.symbol, tradeType: 'Digits', subTradeType: signal.subTradeType,
    option: signal.option, predictedDigit: Number(signal.predictedDigit),
    duration: Number(signal.duration), timeframeUnit: 'Ticks',
    currency: quote?.currency || signal.currency || 'unknown',
    askPrice, payout, breakEvenRate: askPrice / payout,
    quotedAt: Number(quote?.date_start || quote?.quotedAt || now),
    entryAt: now, settledAt: now, contractId: contractId || null,
    source: 'deriv-settled-contract', won: settledProfit > 0
  });
  writeRows(rows);
  return getPaperForwardSummary(signal);
}

export function getPaperForwardSummary(signal = null) {
  const rows = readRows();
  const filtered = signal ? rows.filter(row => row.key === paperProfile(signal)) : rows;
  const wins = filtered.filter(row => row.won).length;
  const trades = filtered.length;
  const lowerBound = wilsonLowerBound(wins, trades);
  const maxBreakEvenRate = trades ? Math.max(...filtered.map(row => row.breakEvenRate)) : null;
  const winRate = trades ? wins / trades : null;
  const recent = filtered.slice(-50);
  const recentWins = recent.filter(row => row.won).length;
  const recentTrades = recent.length;
  const recentWinRate = recentTrades ? recentWins / recentTrades : null;
  const calibrated = trades >= MIN_CALIBRATION_TRADES && lowerBound !== null
    && winRate >= TARGET_WIN_RATE
    && recentTrades >= 50 && recentWinRate >= TARGET_WIN_RATE
    && lowerBound > maxBreakEvenRate + SAFETY_MARGIN;
  return { trades, wins, losses: trades - wins, winRate,
    recentTrades, recentWins, recentWinRate,
    lowerBound, maxBreakEvenRate, safetyMargin: SAFETY_MARGIN, minTrades: MIN_CALIBRATION_TRADES,
    calibrated, pending: signal ? [...pending.values()].filter(item => item.key === paperProfile(signal)).length : pending.size,
    targetWinRate: TARGET_WIN_RATE, targetWinRateMet: trades >= MIN_CALIBRATION_TRADES && winRate >= TARGET_WIN_RATE,
    recentTargetMet: recentTrades >= 50 && recentWinRate >= TARGET_WIN_RATE,
    note: 'Quote-matched forward outcomes. Calibration is local to this browser; both the full 200-sample record and most recent 50 outcomes must meet the 90% target, and the lower confidence bound must beat the worst observed quote break-even rate plus margin.' };
}
export function resetPaperTrials() { pending.clear(); }

/**
 * A demo purchase is permitted only after the exact quote-matched profile
 * clears the same forward-performance, recent-regime and payout requirements
 * used for real-account digit execution.
 */
export function canExecuteDemoValidationTrade(accountType, calibration) {
  return accountType === 'demo' && calibration?.calibrated === true;
}
