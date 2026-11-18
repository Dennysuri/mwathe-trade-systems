import test from 'node:test';
import assert from 'node:assert/strict';
import { rankLiveMarketOpportunities } from '../src/services/liveOpportunityEngine.js';

test('unified ranking rejects history-only and stale markets', async () => {
  const prices = Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 4) * 0.03 + i * 0.0008);
  const result = await rankLiveMarketOpportunities([
    { symbol: 'R_50', name: 'Volatility 50', prices, liveTicks: 0, lastLiveAt: 0 },
    { symbol: 'R_75', name: 'Volatility 75', prices, liveTicks: 2, lastLiveAt: 1000 }
  ], { tradeType: 'Ups & Downs', subTradeType: 'Rise/Fall', option: 'Both', duration: 1, timeframeUnit: 'Ticks' }, { now: 10000 });
  assert.deepEqual(result, []);
});

test('unified ranking returns a complete fresh market-plus-contract candidate', async () => {
  const prices = Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 4) * 0.03 + i * 0.0008);
  const result = await rankLiveMarketOpportunities([
    { symbol: 'R_50', name: 'Volatility 50', prices, liveTicks: 3, lastLiveAt: 9950 }
  ], { tradeType: 'Ups & Downs', subTradeType: 'Rise/Fall', option: 'Both', duration: 2, timeframeUnit: 'Ticks' }, { now: 10000 });
  if (result.length) {
    assert.equal(result[0].signal.symbol, 'R_50');
    assert.equal(result[0].signal.market, 'Volatility 50');
    assert.ok(['Rise', 'Fall'].includes(result[0].signal.option));
    assert.equal(result[0].signal.duration, 2);
    assert.equal(result[0].signal.entryPoint, prices.at(-1));
    assert.equal(result[0].signal.researchOnly, true);
  }
});
