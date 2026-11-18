/**
 * A single rolling market window. Initial history seeds the window; every live
 * tick thereafter advances it and evicts the oldest observation.
 * Consumers must use isLiveReady() before treating the window as a live signal source.
 */
export function createMarketWindow(maxSize = 500) {
  const limit = Math.max(1, Math.floor(Number(maxSize) || 500));
  return { values: [], source: [], lastLiveAt: 0, liveTicks: 0, historyLoaded: false, maxSize: limit };
}

export function seedMarketWindow(window, historicalPrices = []) {
  const values = (historicalPrices || []).map(Number).filter(Number.isFinite).slice(-window.maxSize);
  window.values = values;
  window.source = values.map(() => 'initial');
  // A tick received before the history response must not make seeded history live-ready.
  window.lastLiveAt = 0;
  window.liveTicks = 0;
  window.historyLoaded = true;
  return window;
}

export function appendLiveTick(window, quote, timestamp = Date.now()) {
  const value = Number(quote);
  const at = Number(timestamp);
  if (!Number.isFinite(value) || !Number.isFinite(at) || at <= 0) return false;
  window.values.push(value);
  window.source.push('live');
  if (window.values.length > window.maxSize) {
    const excess = window.values.length - window.maxSize;
    window.values.splice(0, excess);
    window.source.splice(0, excess);
  }
  window.lastLiveAt = at;
  window.liveTicks += 1;
  return true;
}

export function isLiveReady(window, { now = Date.now(), maxAgeMs = 5000, minLiveTicks = 1 } = {}) {
  return Boolean(window && window.historyLoaded && window.liveTicks >= minLiveTicks &&
    window.lastLiveAt > 0 && now >= window.lastLiveAt && now - window.lastLiveAt <= maxAgeMs &&
    window.values.length >= Math.min(window.maxSize, minLiveTicks));
}

export function getMarketWindowSnapshot(window) {
  return {
    prices: [...window.values],
    initialCount: window.source.filter(source => source === 'initial').length,
    liveCount: window.source.filter(source => source === 'live').length,
    lastLiveAt: window.lastLiveAt,
    historyLoaded: window.historyLoaded
  };
}
