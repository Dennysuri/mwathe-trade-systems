import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStrategyProfiles, getStrategyUniverseDefinitions } from '../src/services/strategyUniverse.js';
import { rankLiveMarketOpportunities } from '../src/services/liveOpportunityEngine.js';

test('Thamira searches multiple durations for each supported strategy family', () => {
  const definitions = getStrategyUniverseDefinitions();
  const digitDurations = definitions.filter(x => x.tradeType === 'Digits' && x.subTradeType === 'Over/Under').map(x => x.duration);
  assert.deepEqual(digitDurations, [1,2,3,4,5,6,7,8,9,10]);
  assert.ok(definitions.some(x => x.tradeType === 'Ups & Downs' && x.timeframeUnit === 'Minutes' && x.duration === 15));
  assert.ok(definitions.some(x => x.tradeType === 'Vanillas' && x.timeframeUnit === 'Days' && x.duration === 7));
  assert.ok(definitions.some(x => x.tradeType === 'Accumulators' && x.duration === 85));
});

test('user-selected duration is included without collapsing the duration search ladder', () => {
  const profiles = buildStrategyProfiles({
    tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over',
    timeframeUnit: 'Ticks', duration: 17, predictedDigit: 4
  });
  const matching = profiles.filter(x => x.tradeType === 'Digits' && x.subTradeType === 'Over/Under');
  assert.equal(new Set(matching.map(x => x.duration)).size, 11);
  assert.ok(matching.some(x => x.duration === 17 && x.option === 'Over'));
  assert.ok(matching.some(x => x.duration === 1));
  assert.ok(matching.some(x => x.duration === 10));
});

test('live scanner retains a ranked watch candidate without qualifying it for execution', async () => {
  const prices = Array.from({length: 300}, (_, i) => 100 + Math.sin(i / 4) * 0.03 + i * 0.0008);
  const result = await rankLiveMarketOpportunities([{
    symbol: 'R_100', name: 'Volatility 100 Index', prices,
    liveTicks: 3, lastLiveAt: 10000
  }], { tradeType: 'Ups & Downs', subTradeType: 'Rise/Fall', option: 'Both', duration: 1, timeframeUnit: 'Ticks' }, {
    now: 10000, maxAgeMs: 5000, minLiveTicks: 1
  });
  assert.equal(result.length, 1);
  assert.equal(typeof result[0].qualified, 'boolean');
  assert.ok(result[0].report.watchCandidate);
  assert.equal(result[0].report.tradable, false);
});
