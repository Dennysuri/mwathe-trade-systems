import test from 'node:test';
import assert from 'node:assert/strict';
import { rankLiveMarketOpportunities } from './liveOpportunityEngine.js';

test('preloaded history plus a fresh live tick can start analysis without 200 live ticks', async () => {
  const diagnostics = [];
  const ranked = await rankLiveMarketOpportunities([{
    symbol: 'R_10',
    prices: Array.from({ length: 250 }, (_, index) => 100 + index / 100),
    livePrices: [102.51],
    liveTicks: 1,
    lastLiveAt: 10000
  }], { tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 3, duration: 1, timeframeUnit: 'Ticks' }, {
    now: 10000, minLiveTicks: 1,
    onMarketEvaluation: result => diagnostics.push(result)
  });
  assert.notEqual(diagnostics[0]?.status, 'WAITING_FOR_FIRST_LIVE_TICK');
  assert.notEqual(diagnostics[0]?.status, 'INSUFFICIENT_LIVE_TICKS');
  assert.ok(['QUALIFIED_CANDIDATE', 'WATCH_CANDIDATE', 'ANALYSED_NO_SIGNAL'].includes(diagnostics[0]?.status));
  assert.ok(Array.isArray(ranked));
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


test('reports per-market research status for insufficient and stale live feeds', async () => {
  const diagnostics = [];
  await rankLiveMarketOpportunities([
    { symbol: 'R_10', name: 'Volatility 10', livePrices: [1, 2], liveTicks: 2, lastLiveAt: 10000 },
    { symbol: 'R_25', name: 'Volatility 25', livePrices: Array.from({ length: 250 }, (_, i) => 100 + i / 100), liveTicks: 250, lastLiveAt: 1000 }
  ], { tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 3, duration: 1, timeframeUnit: 'Ticks' }, {
    now: 10000, maxAgeMs: 5000, minLiveTicks: 200,
    onMarketEvaluation: result => diagnostics.push(result)
  });
  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics.find(row => row.symbol === 'R_10')?.status, 'INSUFFICIENT_LIVE_TICKS');
  assert.equal(diagnostics.find(row => row.symbol === 'R_25')?.status, 'STALE_FEED');
  assert.ok(diagnostics.every(row => row.evaluationCompletedAt >= row.evaluationStartedAt));
});
