import test from 'node:test';
import assert from 'node:assert/strict';
import {
  strategyRecoveryProfile, getStrategyRecoveryState, getTradeDifficulty,
  evaluateAccountRisk
} from '../src/services/accountRiskIntelligence.js';

test('strategy profile is shared across markets but retains contract complexity parameters', () => {
  const first = { symbol: '1HZ50V', tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 7, duration: 1, timeframeUnit: 'Ticks' };
  const second = { ...first, symbol: 'R_50' };
  assert.equal(strategyRecoveryProfile(first), strategyRecoveryProfile(second));
  assert.notEqual(strategyRecoveryProfile(first), strategyRecoveryProfile({ ...second, predictedDigit: 1 }));
  assert.notEqual(strategyRecoveryProfile(first), strategyRecoveryProfile({ ...second, duration: 2 }));
});

test('digit difficulty distinguishes Over 7 from Over 1 and Matches from Even', () => {
  const over7 = getTradeDifficulty({ tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 7 });
  const over1 = getTradeDifficulty({ tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 1 });
  const matches = getTradeDifficulty({ tradeType: 'Digits', subTradeType: 'Matches/Differs', option: 'Matches' });
  const even = getTradeDifficulty({ tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even' });
  assert.equal(over7.baselineWinRate, 0.2);
  assert.equal(over1.baselineWinRate, 0.8);
  assert.equal(matches.baselineWinRate, 0.1);
  assert.equal(even.baselineWinRate, 0.5);
});

test('account risk stops an entry that exceeds remaining stop-loss budget', () => {
  const risk = evaluateAccountRisk({ balance: 50, equity: 49, sessionPL: -9, targetProfit: 10, stopLoss: 10, nextStake: 2, baseStake: 1 });
  assert.equal(risk.lossRemaining, 1);
  assert.equal(risk.stopForRisk, true);
  assert.equal(risk.status, 'risk-limit');
});

test('account risk identifies target completion and insufficient balance', () => {
  const target = evaluateAccountRisk({ balance: 100, sessionPL: 10, targetProfit: 10, stopLoss: 20, nextStake: 1 });
  const insolventStake = evaluateAccountRisk({ balance: 0.5, sessionPL: 0, targetProfit: 10, stopLoss: 20, nextStake: 1 });
  assert.equal(target.targetReached, true);
  assert.equal(target.status, 'target-reached');
  assert.equal(insolventStake.balanceUnsafe, true);
  assert.equal(insolventStake.stopForRisk, true);
});

test('strategy loss history is read as one profile across markets', () => {
  const rows = [
    { tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even', duration: 1, timeframeUnit: 'Ticks', symbol: '1HZ50V', profit: -1, won: false, settledAt: 1000 },
    { tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even', duration: 1, timeframeUnit: 'Ticks', symbol: 'R_50', profit: -1, won: false, settledAt: 2000 }
  ];
  global.localStorage = { getItem: key => key === 'mwathe:contract-outcomes:v1' ? JSON.stringify(rows) : null };
  const state = getStrategyRecoveryState({ tradeType: 'Digits', subTradeType: 'Even/Odd', option: 'Even', duration: 1, timeframeUnit: 'Ticks', symbol: '1HZ10V' }, { now: 3000 });
  assert.equal(state.consecutiveLosses, 2);
  assert.equal(state.paused, true);
  delete global.localStorage;
});
