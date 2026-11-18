import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMarketWindow, seedMarketWindow, appendLiveTick,
  isLiveReady, getMarketWindowSnapshot
} from '../src/services/liveMarketWindow.js';

test('historical seed initializes the rolling window but is not live-ready by itself', () => {
  const window = createMarketWindow(4);
  seedMarketWindow(window, [1, 2, 3, 4, 5]);
  assert.deepEqual(window.values, [2, 3, 4, 5]);
  assert.equal(isLiveReady(window, { now: 1000 }), false);
});

test('live ticks advance the same window and evict the oldest observations', () => {
  const window = createMarketWindow(4);
  seedMarketWindow(window, [1, 2, 3, 4]);
  assert.equal(appendLiveTick(window, 5, 1000), true);
  assert.deepEqual(window.values, [2, 3, 4, 5]);
  assert.deepEqual(window.source, ['initial', 'initial', 'initial', 'live']);
  assert.equal(isLiveReady(window, { now: 1000 }), true);
});

test('stale, invalid and future-dated ticks cannot qualify a live window', () => {
  const window = createMarketWindow(3);
  seedMarketWindow(window, [10, 11, 12]);
  appendLiveTick(window, 13, 1000);
  assert.equal(appendLiveTick(window, Number.NaN, 1001), false);
  assert.equal(isLiveReady(window, { now: 7000, maxAgeMs: 5000 }), false);
  assert.equal(isLiveReady(window, { now: 900, maxAgeMs: 5000 }), false);
});

test('snapshot reports the live and initial observations in the current window', () => {
  const window = createMarketWindow(3);
  seedMarketWindow(window, [1, 2, 3]);
  appendLiveTick(window, 4, 2000);
  const snapshot = getMarketWindowSnapshot(window);
  assert.deepEqual(snapshot.prices, [2, 3, 4]);
  assert.equal(snapshot.initialCount, 2);
  assert.equal(snapshot.liveCount, 1);
});
