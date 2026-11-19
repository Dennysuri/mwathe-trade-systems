import test from 'node:test';
import assert from 'node:assert/strict';
import { recordContractOutcome, getStrategyPerformance, strategyProfile } from '../src/services/contractOutcomeIntelligence.js';

const store = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: key => store.delete(key)
};

test('strategy loss history follows the setup across different markets', () => {
  store.clear();
  const setup = { tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even', predictedDigit: 2, duration: 1, timeframeUnit: 'Ticks' };
  recordContractOutcome({ ...setup, symbol: 'R_10' }, { profit: -1, stake: 1 });
  recordContractOutcome({ ...setup, symbol: 'R_50' }, { profit: -1, stake: 1 });
  const result = getStrategyPerformance({ ...setup, symbol: 'R_75' });
  assert.equal(result.consecutiveLosses, 2);
  assert.equal(result.paused, true);
});

test('Even/Odd strategy identity ignores irrelevant predicted digit', () => {
  const a = strategyProfile({ tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Odd', predictedDigit: 1, duration: 1, timeframeUnit: 'Ticks' });
  const b = strategyProfile({ tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Odd', predictedDigit: 8, duration: 1, timeframeUnit: 'Ticks' });
  assert.equal(a, b);
});

test('a win resets the cross-market consecutive-loss streak', () => {
  store.clear();
  const setup = { tradeType: 'Digits', subTradeType: 'Matches/Differs', option: 'Differs', predictedDigit: 5, duration: 1, timeframeUnit: 'Ticks' };
  recordContractOutcome({ ...setup, symbol: 'R_10' }, { profit: -1, stake: 1 });
  recordContractOutcome({ ...setup, symbol: 'R_50' }, { profit: 1, stake: 1 });
  assert.equal(getStrategyPerformance({ ...setup, symbol: 'R_75' }).consecutiveLosses, 0);
});
