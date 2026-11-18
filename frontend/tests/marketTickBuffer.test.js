import test from 'node:test';
import assert from 'node:assert/strict';
import { appendTickBuffer, seedTickBuffer } from '../src/services/marketTickBuffer.js';

test('history seeds the window and live ticks received during loading are retained after it', () => {
  assert.deepEqual(seedTickBuffer([1, 2, 3], [4, 5]), [1, 2, 3, 4, 5]);
});

test('tick buffer retains the newest observations within its bound', () => {
  assert.deepEqual(seedTickBuffer([1, 2, 3, 4], [5, 6], 4), [3, 4, 5, 6]);
  assert.deepEqual(appendTickBuffer([3, 4, 5, 6], 7, 4), [4, 5, 6, 7]);
});

test('invalid observations are ignored', () => {
  assert.deepEqual(seedTickBuffer([1, 'bad', 2], [null, 3]), [1, 2, 3]);
  assert.deepEqual(appendTickBuffer([1, 2], Number.NaN), [1, 2]);
});
