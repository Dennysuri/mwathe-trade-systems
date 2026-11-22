import test from 'node:test';
import assert from 'node:assert/strict';
import { rankLiveMarketOpportunities } from './liveOpportunityEngine.js';

test('historical prices and a few live ticks cannot qualify a market', async () => {
  const ranked = await rankLiveMarketOpportunities([{
    symbol: 'R_10',
    prices: Array.from({ length: 250 }, (_, index) => 100 + index / 100),
    livePrices: [100.1, 100.2, 100.3],
    liveTicks: 3,
    lastLiveAt: 10000
  }], { tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 3, duration: 1, timeframeUnit: 'Ticks' }, {
    now: 10000, minLiveTicks: 200
  });
  assert.deepEqual(ranked, []);
});

test('a market with stale live data is excluded even with a large sample', async () => {
  const ranked = await rankLiveMarketOpportunities([{
    symbol: 'R_10',
    livePrices: Array.from({ length: 250 }, (_, index) => 100 + index / 100),
    liveTicks: 250,
    lastLiveAt: 1000
  }], { tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 3, duration: 1, timeframeUnit: 'Ticks' }, {
    now: 10000, maxAgeMs: 5000, minLiveTicks: 200
  });
  assert.deepEqual(ranked, []);
});
