/**
 * Authorize digit entries only from independent forward-settled outcomes.
 * Historical tick-frequency estimates are intentionally not accepted as
 * win-probability evidence for a purchase.
 */
export function evaluateForwardCalibrationGate(calibration = {}, quote = {}, {
  minTrades = 200, targetWinRate = 0.90, safetyMargin = 0.02
} = {}) {
  const trades = Number(calibration.trades);
  const winRate = Number(calibration.winRate);
  const recentTrades = Number(calibration.recentTrades);
  const recentWinRate = Number(calibration.recentWinRate);
  const lowerBound = Number(calibration.lowerBound);
  const maxBreakEvenRate = Number(calibration.maxBreakEvenRate);
  const ask = Number(quote.ask_price ?? quote.askPrice);
  const payout = Number(quote.payout);
  const quoteBreakEven = ask > 0 && payout > ask ? ask / payout : NaN;

  if (!Number.isFinite(ask) || !Number.isFinite(payout) || ask <= 0 || payout <= ask) {
    return { allowed: false, reason: 'The current quote has no valid positive net payout.' };
  }
  if (!Number.isFinite(trades) || trades < minTrades) {
    return { allowed: false, reason: `Forward sample is incomplete (${Number.isFinite(trades) ? trades : 0}/${minTrades}).`, quoteBreakEven };
  }
  if (!Number.isFinite(winRate) || winRate < targetWinRate) {
    return { allowed: false, reason: `Overall forward win rate is below ${(targetWinRate * 100).toFixed(1)}%.`, quoteBreakEven };
  }
  if (!Number.isFinite(recentTrades) || recentTrades < 50) {
    return { allowed: false, reason: 'The most recent 50 forward outcomes are not yet available.', quoteBreakEven };
  }
  if (!Number.isFinite(recentWinRate) || recentWinRate < targetWinRate) {
    return { allowed: false, reason: `Recent forward win rate is below ${(targetWinRate * 100).toFixed(1)}%; the profile may be deteriorating.`, quoteBreakEven };
  }
  if (!Number.isFinite(lowerBound) || !Number.isFinite(maxBreakEvenRate)) {
    return { allowed: false, reason: 'A valid forward confidence bound and quote history are required.', quoteBreakEven };
  }
  const requiredBound = Math.max(maxBreakEvenRate, quoteBreakEven) + safetyMargin;
  if (lowerBound <= requiredBound) {
    return { allowed: false, reason: 'The forward confidence bound does not clear the current and historical quote break-even rates plus the safety margin.', quoteBreakEven, lowerBound, requiredBound };
  }
  const expectedValue = lowerBound * (payout - ask) - (1 - lowerBound) * ask;
  if (!(expectedValue > 0)) {
    return { allowed: false, reason: 'The forward confidence bound does not produce positive quote-adjusted expected value.', quoteBreakEven, lowerBound, requiredBound, expectedValue };
  }
  return { allowed: true, quoteBreakEven, lowerBound, requiredBound, expectedValue };
}
