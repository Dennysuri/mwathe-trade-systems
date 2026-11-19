import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStrategyProfiles,
  getStrategyUniverseDefinitions,
  rankLiveStrategyUniverse,
  findSelectedStrategyOpportunity
} from '../src/services/strategyUniverse.js';

test('strategy universe covers all supported families and a duration ladder', () => {
  const profiles = buildStrategyProfiles({ tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even', duration: 4, timeframeUnit: 'Ticks', predictedDigit: 6 });
  assert.ok(profiles.length > 80);
  const selected = profiles.find(item => item.profileId === 'Digits|Even/Odd|Ticks|4');
  assert.equal(selected.option, 'Even');
  assert.equal(selected.duration, 4);
  assert.equal(selected.timeframeUnit, 'Ticks');
  assert.ok(profiles.some(item => item.profileId === 'Vanillas|Call/Put|Minutes|1'));
  assert.equal(getStrategyUniverseDefinitions().length, 93);
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
  if (selected) assert.ok(selected.profile.profileId.startsWith('Ups & Downs|Rise/Fall|'));
});

test('selected strategy lookup never substitutes a different subtype', () => {
  const rows = [{ profile: { tradeType: 'Digits', subTradeType: 'Over/Under' } }];
  assert.equal(findSelectedStrategyOpportunity(rows, { tradeType: 'Digits', subTradeType: 'Even/Odd' }), null);
});
