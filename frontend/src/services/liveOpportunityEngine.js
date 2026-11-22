import { evaluateStrategyEnsemble } from './strategyIntelligence.js';

const DEFAULT_MAX_AGE_MS = 5000;

/**
 * Evaluate a complete market + contract opportunity from the same live window.
 * Historical observations may seed prices, but a market is eligible only after
 * at least one fresh post-seed live tick has arrived.
 */
export async function rankLiveMarketOpportunities(markets, config = {}, {
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  minLiveTicks = 200
} = {}) {
  const evaluated = await Promise.all((markets || []).map(async market => {
    // Only post-subscription live observations may generate an entry signal.
    // Historical prices are preload/reference data and are deliberately excluded.
    const prices = (market?.livePrices || []).map(Number).filter(Number.isFinite);
    const liveTicks = Number(market?.liveTicks || 0);
    const lastLiveAt = Number(market?.lastLiveAt || 0);
    if (!market?.symbol || prices.length < minLiveTicks || liveTicks < minLiveTicks ||
        !lastLiveAt || now - lastLiveAt < 0 || now - lastLiveAt > maxAgeMs) return null;

    const report = await evaluateStrategyEnsemble(prices, {
      ...config,
      symbol: market.symbol,
      barrier: config.tradeType === 'Digits' ? String(config.predictedDigit) : config.barrier
    });
    // Preserve the strongest observed setup for Thamira's comparison board even
    // when it does not yet pass the legacy display threshold. Execution remains
    // separately qualified and must never treat a watch candidate as approved.
    const candidate = report.candidate || report.watchCandidate;
    if (!report.ready || !candidate || !candidate.option || candidate.option === 'Both') return null;

    const entryPoint = prices.at(-1);
    const duration = Number(config.duration);
    const timeframeUnit = config.timeframeUnit || 'Ticks';
    const durationSeconds = timeframeUnit === 'Hours' ? duration * 3600
      : timeframeUnit === 'Days' ? duration * 86400
        : timeframeUnit === 'Minutes' ? duration * 60 : duration;
    const createdAt = now;
    const marketName = market.name || market.symbol;
    const deltas = prices.slice(1).map((value, index) => value - prices[index]);
    const averageMove = deltas.length ? deltas.reduce((sum, value) => sum + Math.abs(value), 0) / deltas.length : 0;
    const isDown = ['Fall', 'Lower', 'Down', 'Put', 'No Touch'].includes(candidate.option);
    const needsBarrier = config.tradeType === 'Touch & No Touch' || (config.tradeType === 'Ups & Downs' && config.subTradeType === 'Higher/Lower');
    const derivedBarrier = needsBarrier
      ? (isDown ? '-' : '+') + Math.max(averageMove * (config.tradeType === 'Touch & No Touch' ? 3 : 2), Math.abs(entryPoint) * 0.0001).toFixed(4)
      : '';
    const signal = {
      id: `live-${market.symbol}-${createdAt}`,
      source: 'unified-live-opportunity-engine',
      researchOnly: true,
      symbol: market.symbol,
      market: marketName,
      tradeType: config.tradeType,
      subTradeType: config.subTradeType,
      option: candidate.option,
      predictedDigit: Number(config.predictedDigit),
      barrier: config.tradeType === 'Digits' ? String(config.predictedDigit) : (candidate.barrier || config.barrier || derivedBarrier),
      entryPoint,
      entryDigit: config.tradeType === 'Digits' ? Number(String(entryPoint).split('.').at(-1).slice(-1)) : undefined,
      duration,
      timeframeUnit,
      contractTimeframe: `${duration} ${timeframeUnit}`,
      createdAt,
      expiryEpoch: Math.floor(createdAt / 1000) + Math.max(1, durationSeconds),
      setupScore: candidate.score,
      confidence: candidate.score
    };
    return { symbol: market.symbol, marketName, score: candidate.score, qualified: Boolean(report.candidate), report, signal };
  }));

  return evaluated.filter(Boolean).sort((a, b) => b.score - a.score);
}


/**
 * Last-moment entry guard. It rejects a candidate if its signal or market feed
 * has aged, or if price has moved materially since the ranked entry snapshot.
 * This is a freshness/slippage guard, not a win-probability estimator.
 */
export function validateLiveOpportunity(signal, market, {
  now = Date.now(),
  maxSignalAgeMs = 1500,
  maxMarketAgeMs = 1500,
  maxDriftMultiples = 2.5
} = {}) {
  const createdAt = Number(signal?.createdAt || 0);
  const signalAgeMs = now - createdAt;
  if (!createdAt || signalAgeMs < 0 || signalAgeMs > maxSignalAgeMs) {
    return { valid: false, reason: 'Signal expired before execution.', signalAgeMs };
  }
  const lastLiveAt = Number(market?.lastLiveAt || 0);
  const marketAgeMs = now - lastLiveAt;
  if (!lastLiveAt || marketAgeMs < 0 || marketAgeMs > maxMarketAgeMs) {
    return { valid: false, reason: 'Latest market tick is stale.', marketAgeMs };
  }
  const prices = (market?.prices || []).map(Number).filter(Number.isFinite);
  if (prices.length < 3) return { valid: false, reason: 'Insufficient live price context.' };
  const entryPoint = Number(signal?.entryPoint);
  const latestPrice = prices.at(-1);
  if (!Number.isFinite(entryPoint) || !Number.isFinite(latestPrice)) {
    return { valid: false, reason: 'Entry or latest price is invalid.' };
  }
  const recent = prices.slice(-21);
  const moves = recent.slice(1).map((price, index) => Math.abs(price - recent[index])).filter(Number.isFinite);
  const averageMove = moves.length ? moves.reduce((sum, move) => sum + move, 0) / moves.length : 0;
  const minimumTolerance = Math.max(Math.abs(entryPoint) * 1e-8, Number.EPSILON);
  const allowedDrift = Math.max(minimumTolerance, averageMove * maxDriftMultiples);
  const drift = Math.abs(latestPrice - entryPoint);
  if (drift > allowedDrift) {
    return { valid: false, reason: 'Market moved outside the acceptable entry range.', marketAgeMs, latestPrice, drift, allowedDrift };
  }
  return { valid: true, signalAgeMs, marketAgeMs, latestPrice, drift, allowedDrift };
}
