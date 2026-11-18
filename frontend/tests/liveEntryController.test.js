import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLiveOpportunity } from '../src/services/liveOpportunityEngine.js';

const signal = { createdAt: 1000, entryPoint: 100, option: 'Rise' };
const market = { lastLiveAt: 1900, prices: [99.9, 100, 100.1, 100.05, 100.08] };

test('last-moment guard accepts a fresh entry within normal tick movement', () => {
  const result = validateLiveOpportunity(signal, market, { now: 2000 });
  assert.equal(result.valid, true);
  assert.equal(result.latestPrice, 100.08);
});

test('last-moment guard rejects expired signal and stale feed', () => {
  assert.equal(validateLiveOpportunity(signal, market, { now: 3000 }).valid, false);
  assert.equal(validateLiveOpportunity(signal, { ...market, lastLiveAt: 100 }, { now: 2000 }).valid, false);
});

test('last-moment guard rejects material price drift', () => {
  const result = validateLiveOpportunity(signal, { lastLiveAt: 1990, prices: [99.9, 100, 100.1, 100.05, 103] }, { now: 2000 });
  assert.equal(result.valid, false);
  assert.match(result.reason, /moved outside/);
});
