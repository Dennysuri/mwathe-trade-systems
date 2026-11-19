import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptiveStrategyKey, getAdaptiveStrategyStatus, recordAdaptiveOutcome,
  evaluateAccountRisk, getContractDifficulty
} from '../src/services/adaptiveTradingIntelligence.js';

function resetStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('strategy loss history is shared across markets but isolated by contract settings', () => {
  resetStorage();
  const first = { symbol: 'R_10', tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even', duration: 1, timeframeUnit: 'Ticks' };
  const second = { ...first, symbol: 'R_100' };
  assert.equal(adaptiveStrategyKey(first), adaptiveStrategyKey(second));
  assert.notEqual(adaptiveStrategyKey(first), adaptiveStrategyKey({ ...second, duration: 2 }));
  recordAdaptiveOutcome(first, { profit: -1, stake: 1, now: 1000 });
  recordAdaptiveOutcome(second, { profit: -1, stake: 1, now: 2000 });
  const status = getAdaptiveStrategyStatus(first, 2500);
  assert.equal(status.consecutiveLosses, 2);
  assert.equal(status.blocked, true);
});

test('a winning settlement clears the profile loss streak', () => {
  resetStorage();
  const signal = { tradeType: 'Digits', subTradeType: 'Matches/Differs', option: 'Matches', predictedDigit: 4, duration: 1, timeframeUnit: 'Ticks' };
  recordAdaptiveOutcome(signal, { profit: -1, now: 1000 });
  recordAdaptiveOutcome(signal, { profit: 1, now: 2000 });
  const status = getAdaptiveStrategyStatus(signal, 2500);
  assert.equal(status.consecutiveLosses, 0);
  assert.equal(status.blocked, false);
});

test('account guard respects target, stop loss and remaining loss allowance', () => {
  assert.equal(evaluateAccountRisk({ sessionPL: 10, targetProfit: 10, stopLoss: 20, nextStake: 1 }).allowEntry, false);
  assert.equal(evaluateAccountRisk({ sessionPL: -20, targetProfit: 10, stopLoss: 20, nextStake: 1 }).stopHit, true);
  assert.equal(evaluateAccountRisk({ sessionPL: -9, targetProfit: 10, stopLoss: 10, nextStake: 2 }).insufficientLossRoom, true);
  assert.equal(evaluateAccountRisk({ balance: 100, sessionPL: -2, targetProfit: 10, stopLoss: 10, nextStake: 1 }).allowEntry, true);
  assert.equal(evaluateAccountRisk({ sessionPL: 0, targetProfit: 10, stopLoss: 10, nextStake: 1 }).balanceUnavailable, true);
  assert.equal(evaluateAccountRisk({ balance: 0.5, sessionPL: 0, targetProfit: 10, stopLoss: 10, nextStake: 1 }).insufficientBalance, true);
});

test('contract difficulty differentiates Over 1 from Over 7 and parity', () => {
  const overOne = getContractDifficulty({ tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 1 });
  const overSeven = getContractDifficulty({ tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 7 });
  const parity = getContractDifficulty({ tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even' });
  assert.equal(overOne.theoreticalWinChance, 0.8);
  assert.equal(overSeven.theoreticalWinChance, 0.2);
  assert.equal(parity.theoreticalWinChance, 0.5);
});
