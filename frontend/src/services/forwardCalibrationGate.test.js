import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateForwardCalibrationGate } from './forwardCalibrationGate.js';

const quote = { ask_price: 1, payout: 1.9 };

test('requires at least 200 independent forward-settled outcomes', () => {
  const result = evaluateForwardCalibrationGate({
    trades: 199, winRate: 1, lowerBound: 0.98, maxBreakEvenRate: 0.53
  }, quote);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /199\/200/);
});

test('requires the observed forward win rate to meet 90 percent', () => {
  const result = evaluateForwardCalibrationGate({
    trades: 200, winRate: 0.89, lowerBound: 0.85, maxBreakEvenRate: 0.53
  }, quote);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /below 90.0%/);
});

test('rejects a high observed rate when the confidence bound does not clear break-even', () => {
  const result = evaluateForwardCalibrationGate({
    trades: 200, winRate: 0.91, lowerBound: 0.54, maxBreakEvenRate: 0.53
  }, quote);
  assert.equal(result.allowed, false);
});

test('allows a qualified profile only when its lower bound clears current quote break-even plus margin', () => {
  const result = evaluateForwardCalibrationGate({
    trades: 220, winRate: 0.99, lowerBound: 0.96, maxBreakEvenRate: 0.54
  }, quote);
  assert.equal(result.allowed, true);
  assert.ok(result.expectedValue > 0);
});

test('rejects invalid or non-profitable quotes', () => {
  const result = evaluateForwardCalibrationGate({
    trades: 220, winRate: 0.99, lowerBound: 0.96, maxBreakEvenRate: 0.54
  }, { ask_price: 1, payout: 1 });
  assert.equal(result.allowed, false);
});

test('rejects a profile whose latest 50 outcomes fall below target despite strong lifetime results', () => {
  const result = evaluateForwardCalibrationGate({
    trades: 220, winRate: 0.95, recentTrades: 50, recentWinRate: 0.84,
    lowerBound: 0.90, maxBreakEvenRate: 0.54
  }, quote);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /Recent forward win rate/);
});

test('requires a complete recent 50-outcome window', () => {
  const result = evaluateForwardCalibrationGate({
    trades: 220, winRate: 0.95, recentTrades: 49, recentWinRate: 1,
    lowerBound: 0.90, maxBreakEvenRate: 0.54
  }, quote);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /most recent 50/);
});
