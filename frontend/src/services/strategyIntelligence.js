/**
 * Mwathe Strategy Intelligence
 * Deterministic research evaluators only: this module never places orders and
 * never labels an uncalibrated score as a win probability.
 */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const variance = xs => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
};
const stdev = xs => Math.sqrt(variance(xs));
const digitOf = value => {
  const s = String(value);
  const decimals = s.includes('.') ? s.split('.')[1] : '';
  return Number((decimals || s).slice(-1));
};
const wilson = (successes, n, z = 1.96) => {
  if (!n) return { lower: 0, upper: 1 };
  const p = successes / n, z2 = z * z, den = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / den;
  const margin = z * Math.sqrt((p * (1 - p) / n) + z2 / (4 * n * n)) / den;
  return { lower: clamp(center - margin, 0, 1), upper: clamp(center + margin, 0, 1) };
};
const result = (name, family, sampleSize, metrics, notes = []) => ({
  name, family, sampleSize, metrics, notes, status: 'research-only',
  calibrated: false
});

function digitStrategies(prices, config) {
  const digits = prices.map(digitOf).filter(d => Number.isInteger(d) && d >= 0 && d <= 9);
  const target = Number(config.predictedDigit);
  const sub = config.subTradeType;
  const opts = sub === 'Over/Under' ? ['Over', 'Under']
    : sub === 'Matches/Differs' ? ['Matches', 'Differs'] : ['Even', 'Odd'];
  const base = option => sub === 'Over/Under'
    ? (option === 'Over' ? (9 - target) / 10 : target / 10)
    : sub === 'Matches/Differs' ? (option === 'Matches' ? 0.1 : 0.9) : 0.5;
  const counts = Object.fromEntries(opts.map(o => [o, 0]));
  digits.forEach(d => {
    if (sub === 'Over/Under') { if (d > target) counts.Over++; if (d < target) counts.Under++; }
    else if (sub === 'Matches/Differs') { if (d === target) counts.Matches++; else counts.Differs++; }
    else counts[d % 2 === 0 ? 'Even' : 'Odd']++;
  });
  const frequency = opts.map(option => {
    const p = digits.length ? counts[option] / digits.length : 0;
    const interval = wilson(counts[option], digits.length);
    return { option, observed: p, baseline: base(option), lower: interval.lower, upper: interval.upper, edge: p - base(option) };
  });
  const latest = digits.at(-1);
  const transitionDigits = [];
  for (let i = 0; i < digits.length - 1; i++) if (digits[i] === latest) transitionDigits.push(digits[i + 1]);
  const conditional = opts.map(option => {
    const hits = transitionDigits.filter(d => sub === 'Over/Under' ? (option === 'Over' ? d > target : d < target)
      : sub === 'Matches/Differs' ? (option === 'Matches' ? d === target : d !== target)
        : option === 'Even' ? d % 2 === 0 : d % 2 === 1).length;
    const interval = wilson(hits, transitionDigits.length);
    return { option, observed: transitionDigits.length ? hits / transitionDigits.length : 0, baseline: base(option), lower: interval.lower, upper: interval.upper, observations: transitionDigits.length };
  });
  return [
    result('Bayesian-smoothed frequency / Wilson interval', 'digit-distribution', digits.length,
      { options: frequency }, ['Baseline comparison only; overlapping rolling windows are not independent.']),
    result('Conditional last-digit transition test', 'digit-transition', transitionDigits.length,
      { conditioningDigit: latest, options: conditional }, ['Transition findings are exploratory and require independent out-of-sample confirmation.']),
    result('Distribution stability', 'digit-drift', digits.length,
      { recentWindow: digits.slice(-50).length, olderWindow: digits.slice(-100, -50).length,
        recentEvenRate: digits.slice(-50).filter(d => d % 2 === 0).length / Math.max(1, digits.slice(-50).length),
        olderEvenRate: digits.slice(-100, -50).filter(d => d % 2 === 0).length / Math.max(1, digits.slice(-100, -50).length) },
      ['A detected distribution change is not itself a directional prediction.'])
  ];
}

function priceStrategies(prices, config) {
  const deltas = prices.slice(1).map((p, i) => p - prices[i]).filter(Number.isFinite);
  const fast = deltas.slice(-12), slow = deltas.slice(-48);
  const fastMean = mean(fast), slowMean = mean(slow), vol = stdev(slow);
  const momentum = fastMean - slowMean;
  const upRate = fast.filter(x => x > 0).length / Math.max(1, fast.length);
  const downRate = fast.filter(x => x < 0).length / Math.max(1, fast.length);
  const last = prices.at(-1), high = Math.max(...prices.slice(-30)), low = Math.min(...prices.slice(-30));
  const rangePosition = high === low ? 0.5 : (last - low) / (high - low);
  const direction = momentum > 0 ? 'up' : momentum < 0 ? 'down' : 'flat';
  const trendStrength = Math.abs(slowMean) / Math.max(vol, Number.EPSILON);
  return [
    result('Multi-horizon momentum', 'momentum', deltas.length,
      { direction, fastMean, slowMean, momentum, upRate, downRate, trendStrength }),
    result('Mean-reversion / range position', 'mean-reversion', Math.min(30, prices.length),
      { rangePosition, distanceFromMean: last - mean(prices.slice(-30)), volatility: vol },
      ['Contrarian conditions are hypotheses, not a guaranteed reversal.']),
    result('Volatility and breakout regime', 'volatility-regime', slow.length,
      { volatility: vol, fastVolatility: stdev(fast), rangeHigh: high, rangeLow: low, rangePosition },
      ['Breakout classification requires instrument-specific validation.']),
    result('Change-point / regime stability', 'regime-change', deltas.length,
      { fastVolatility: stdev(fast), slowVolatility: vol, volatilityRatio: vol ? stdev(fast) / vol : null, momentumShift: fastMean - slowMean })
  ];
}

function contractSpecificStrategies(prices, config) {
  const base = priceStrategies(prices, config);
  const deltas = prices.slice(1).map((p, i) => p - prices[i]);
  const vol = stdev(deltas.slice(-50));
  const distance = Number(config.barrierDistance);
  if (config.tradeType === 'Touch & No Touch') {
    return [result(config.option === 'No Touch' ? 'Barrier survival / first-passage risk' : 'First-passage / touch hazard',
      'barrier-path', deltas.length, { volatility: vol, barrierDistance: Number.isFinite(distance) ? distance : null,
        distanceInVolatilityUnits: Number.isFinite(distance) && vol > 0 ? Math.abs(distance) / vol : null },
      ['Requires the actual contract barrier and path distribution; not enough information to estimate calibrated touch probability.']), ...base];
  }
  if (config.tradeType === 'Accumulators') {
    const breaches = deltas.slice(-50).filter(d => Math.abs(d) > vol * 2).length;
    return [result('Range-survival / breach hazard', 'accumulator-survival', deltas.length,
      { volatility: vol, largeMoveCount: breaches, recentRange: Math.max(...prices.slice(-50)) - Math.min(...prices.slice(-50)) },
      ['A proper accumulator model needs contract growth rate, allowed range and tick-by-tick breach rules.']), ...base];
  }
  if (config.tradeType === 'Vanillas') {
    return [result('Option premium and volatility decomposition', 'vanilla-valuation', deltas.length,
      { realisedVolatility: vol, directionalDrift: mean(deltas.slice(-50)), expiryEpoch: config.expiryEpoch ?? null },
      ['Greeks, implied volatility and fair value are omitted unless reliable option quotes and contract terms are supplied.']), ...base];
  }
  if (config.tradeType === 'Multipliers') {
    return [result('Leverage-adjusted directional risk', 'multiplier-risk', deltas.length,
      { volatility: vol, direction: mean(deltas.slice(-20)) >= 0 ? 'up' : 'down', multiplier: Number(config.multiplier || 0) },
      ['Requires actual multiplier, stop-loss and cancellation terms to calculate exposure.']), ...base];
  }
  if (config.tradeType === 'Turbos') {
    return [result('Turbo barrier / knock-out hazard', 'turbo-barrier-risk', deltas.length,
      { volatility: vol, direction: mean(deltas.slice(-20)) >= 0 ? 'up' : 'down', barrierDistance: Number.isFinite(distance) ? distance : null },
      ['Must be matched to the exact Turbo contract specification and knock-out level.']), ...base];
  }
  return base;
}

/**
 * Evaluate all applicable strategy families concurrently. The returned
 * recommendation is deliberately non-tradable until payout-aware, calibrated
 * out-of-sample evidence is supplied by the validation layer.
 */
export async function evaluateStrategyEnsemble(prices, config = {}) {
  const clean = (prices || []).map(Number).filter(Number.isFinite);
  const min = config.tradeType === 'Digits' ? 200 : 80;
  if (clean.length < min) return {
    ready: false, tradable: false, sampleSize: clean.length, strategies: [],
    reasons: [`Need at least ${min} observations; currently have ${clean.length}.`],
    conviction: null, decision: 'WAIT'
  };
  const jobs = config.tradeType === 'Digits'
    ? [() => digitStrategies(clean, config)]
    : [() => contractSpecificStrategies(clean, config)];
  const strategyGroups = await Promise.all(jobs.map(async run => run()));
  const strategies = strategyGroups.flat();
  const best = strategies.find(s => s.status === 'research-only') || null;
  return {
    ready: true, tradable: false, sampleSize: clean.length, strategies,
    bestResearch: best, conviction: null, decision: 'WAIT',
    reasons: ['Models are research-only until independently calibrated on unseen outcomes.',
      'A payout-aware expected-value calculation is required before any trade can be authorised.']
  };
}

/** Fast, synchronous final gate immediately before requesting a proposal/buy. */
export function validateEntryWindow(signal, {
  now = Date.now(), maxSignalAgeMs = 2500, proposalBudgetMs = 1200,
  minimumRemainingMs = 500, contractDurationMs = null
} = {}) {
  const created = Number(signal?.createdAt || signal?.timestamp || 0);
  const age = now - created;
  if (!created || age < 0 || age > maxSignalAgeMs) return { valid: false, reason: 'Signal is stale or has an invalid timestamp.' };
  if (signal?.option === 'Both') return { valid: false, reason: 'A specific contract option must be selected before entry.' };
  const expiry = Number(signal?.expiryEpoch);
  if (signal?.timeframeUnit !== 'Ticks' && Number.isFinite(expiry) && expiry > 0) {
    const remaining = expiry * 1000 - now;
    if (remaining < proposalBudgetMs + minimumRemainingMs) return { valid: false, reason: 'Insufficient time remains to obtain a quote and enter safely.' };
  }
  if (contractDurationMs !== null && (!Number.isFinite(contractDurationMs) || contractDurationMs <= 0)) {
    return { valid: false, reason: 'Contract duration is invalid.' };
  }
  return { valid: true, ageMs: age, proposalBudgetMs, contractDurationMs };
}

/** Payout-aware break-even check. Payout must be the net profit per unit stake. */
export function evaluateExpectedValue({ winProbability, netProfitOnWin, lossOnLoss = 1, uncertainty = 0 }) {
  const p = Number(winProbability), win = Number(netProfitOnWin), loss = Number(lossOnLoss);
  if (![p, win, loss].every(Number.isFinite) || p < 0 || p > 1 || win < 0 || loss < 0) {
    return { valid: false, expectedValue: null, breakEvenProbability: null };
  }
  const lowerBound = clamp(p - Math.max(0, Number(uncertainty) || 0), 0, 1);
  const breakEvenProbability = loss / (win + loss || 1);
  const expectedValue = lowerBound * win - (1 - lowerBound) * loss;
  return { valid: true, lowerBound, breakEvenProbability, expectedValue,
    positive: expectedValue > 0 && lowerBound > breakEvenProbability };
}
