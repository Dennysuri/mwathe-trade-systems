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
  minLiveTicks = 1
} = {}) {
  const evaluated = await Promise.all((markets || []).map(async market => {
    const prices = (market?.prices || []).map(Number).filter(Number.isFinite);
    const liveTicks = Number(market?.liveTicks || 0);
    const lastLiveAt = Number(market?.lastLiveAt || 0);
    if (!market?.symbol || prices.length < 1 || liveTicks < minLiveTicks ||
        !lastLiveAt || now - lastLiveAt < 0 || now - lastLiveAt > maxAgeMs) return null;

    const report = await evaluateStrategyEnsemble(prices, {
      ...config,
      symbol: market.symbol,
      barrier: config.tradeType === 'Digits' ? String(config.predictedDigit) : config.barrier
    });
    const candidate = report.candidate;
    if (!report.ready || !candidate || !candidate.option || candidate.option === 'Both') return null;

    const entryPoint = prices.at(-1);
    const duration = Number(config.duration);
    const timeframeUnit = config.timeframeUnit || 'Ticks';
    const durationSeconds = timeframeUnit === 'Hours' ? duration * 3600
      : timeframeUnit === 'Days' ? duration * 86400
        : timeframeUnit === 'Minutes' ? duration * 60 : duration;
    const createdAt = now;
    const marketName = market.name || market.symbol;
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
      barrier: config.tradeType === 'Digits' ? String(config.predictedDigit) : (candidate.barrier || config.barrier || ''),
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
    return { symbol: market.symbol, marketName, score: candidate.score, report, signal };
  }));

  return evaluated.filter(Boolean).sort((a, b) => b.score - a.score);
}
