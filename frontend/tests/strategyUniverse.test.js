import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStrategyProfiles,
  getStrategyUniverseDefinitions,
  rankLiveStrategyUniverse,
  findSelectedStrategyOpportunity
} from '../src/services/strategyUniverse.js';

test('strategy universe contains every supported family and subtype', () => {
  const profiles = buildStrategyProfiles({ tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even', duration: 4, timeframeUnit: 'Ticks', predictedDigit: 6 });
  assert.equal(profiles.length, 10);
  assert.deepEqual(profiles.map(item => item.profileId), [
    'Digits|Over/Under', 'Digits|Matches/Differs', 'Digits|Even/Odd',
    'Ups & Downs|Rise/Fall', 'Ups & Downs|Higher/Lower',
    'Touch & No Touch|Touch/No Touch', 'Multipliers|Multipliers',
    'Accumulators|default', 'Vanillas|Call/Put', 'Turbos|Turbos'
  ]);
  const selected = profiles.find(item => item.profileId === 'Digits|Even/Odd');
  assert.equal(selected.option, 'Even');
  assert.equal(selected.duration, 4);
  assert.equal(selected.timeframeUnit, 'Ticks');
  assert.equal(profiles.find(item => item.profileId === 'Vanillas|Call/Put').duration, 1);
  assert.equal(getStrategyUniverseDefinitions().length, 10);
});

test('strategy universe ranks market and subtype candidates together while preserving research-only status', async () => {
  const prices = Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 4) * 0.03 + i * 0.0008);
  const ranked = await rankLiveStrategyUniverse([
    { symbol: 'R_50', name: 'Volatility 50', prices, liveTicks: 3, lastLiveAt: 9950 }
  ], { tradeType: 'Ups & Downs', subTradeType: 'Rise/Fall', option: 'Both', duration: 2, timeframeUnit: 'Ticks' }, { now: 10000 });
  assert.ok(ranked.every(item => item.signal.researchOnly === true));
  assert.ok(ranked.every(item => item.report.tradable === false));
  assert.ok(ranked.every(item => item.profile?.tradeType && item.profile?.subTradeType !== undefined));
  assert.deepEqual(ranked.map(item => item.score), [...ranked.map(item => item.score)].sort((a, b) => b - a));
  const selected = findSelectedStrategyOpportunity(ranked, { tradeType: 'Ups & Downs', subTradeType: 'Rise/Fall' });
  if (selected) assert.equal(selected.profile.profileId, 'Ups & Downs|Rise/Fall');
});

test('selected strategy lookup never substitutes a different subtype', () => {
  const rows = [{ profile: { tradeType: 'Digits', subTradeType: 'Over/Under' } }];
  assert.equal(findSelectedStrategyOpportunity(rows, { tradeType: 'Digits', subTradeType: 'Even/Odd' }), null);
});
