import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAccountRisk, getContractDifficulty } from '../src/services/accountRiskIntelligence.js';

test('account gate blocks stale balance and stop-loss breach', () => {
  const now = 10_000_000;
  assert.equal(evaluateAccountRisk({ balance: 100, balanceUpdatedAt: now - 61_000, now, nextStake: 1 }).allowed, false);
  assert.equal(evaluateAccountRisk({ balance: 100, balanceUpdatedAt: now, now, sessionPL: -10, stopLoss: 10, nextStake: 1 }).mode, 'stop-loss-reached');
});

test('account gate reduces exposure near target and blocks oversized martingale stake', () => {
  const now = 10_000_000;
  const nearTarget = evaluateAccountRisk({ balance: 100, balanceUpdatedAt: now, now, sessionPL: 8, targetProfit: 10, stopLoss: 20, nextStake: 1 });
  assert.equal(nearTarget.allowed, true);
  assert.equal(nearTarget.mode, 'profit-protection');
  assert.equal(evaluateAccountRisk({ balance: 100, balanceUpdatedAt: now, now, nextStake: 2.01 }).mode, 'stake-too-large');
});

test('difficulty model distinguishes Over 1 from Over 7 and uses proposal break-even', () => {
  const quote = { askPrice: 1, payout: 4 };
  const over1 = getContractDifficulty({ tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 1 }, quote);
  const over7 = getContractDifficulty({ tradeType: 'Digits', subTradeType: 'Over/Under', option: 'Over', predictedDigit: 7 }, quote);
  assert.equal(over1.theoreticalBaseline, 0.8);
  assert.equal(over7.theoreticalBaseline, 0.2);
  assert.equal(over7.breakEvenRate, 0.25);
  assert.equal(over1.edgeRequired, -0.55);
});
