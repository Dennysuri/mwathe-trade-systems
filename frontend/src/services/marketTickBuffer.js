/**
 * Bounded tick buffers for bot research. Historical observations seed the
 * window; live ticks received while history is loading are appended afterward.
 */
export const MARKET_TICK_BUFFER_SIZE = 500;

const finiteValues = values => (Array.isArray(values) ? values : [])
  .filter(value => value !== null && value !== undefined && value !== '')
  .map(Number)
  .filter(Number.isFinite);

export function seedTickBuffer(historicalPrices, pendingLiveTicks = [], maxSize = MARKET_TICK_BUFFER_SIZE) {
  const limit = Math.max(1, Math.floor(Number(maxSize) || MARKET_TICK_BUFFER_SIZE));
  return [...finiteValues(historicalPrices), ...finiteValues(pendingLiveTicks)].slice(-limit);
}

export function appendTickBuffer(buffer, quote, maxSize = MARKET_TICK_BUFFER_SIZE) {
  const value = Number(quote);
  if (!Number.isFinite(value)) return Array.isArray(buffer) ? buffer : [];
  const limit = Math.max(1, Math.floor(Number(maxSize) || MARKET_TICK_BUFFER_SIZE));
  return [...finiteValues(buffer), value].slice(-limit);
}
