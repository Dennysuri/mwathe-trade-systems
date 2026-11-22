import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaperForwardSummary, recordSettledContractOutcome } from './paperForwardCalibration.js';

test('calibration records the actual Deriv contract settlement once per contract', () => {
  const signal = {
    id: 'signal-1', symbol: 'R_10', tradeType: 'Digits',
    subTradeType: 'Over/Under', option: 'Over', predictedDigit: 3,
    duration: 1, timeframeUnit: 'Ticks'
  };
  const first = recordSettledContractOutcome(signal, {
    quote: { ask_price: 1, payout: 1.9, currency: 'USD' },
    profit: 0.9, contractId: 'contract-test-1', now: 1000
  });
  assert.equal(first.trades, 1);
  assert.equal(first.wins, 1);
  const duplicate = recordSettledContractOutcome(signal, {
    quote: { ask_price: 1, payout: 1.9, currency: 'USD' },
    profit: 0.9, contractId: 'contract-test-1', now: 2000
  });
  assert.equal(duplicate.trades, 1);
  assert.equal(getPaperForwardSummary(signal).trades, 1);
});

test('calibration is suspended when the latest 50 forward outcomes deteriorate', () => {
  const signal = {
    symbol: 'R_25', tradeType: 'Digits', subTradeType: 'Over/Under',
    option: 'Over', predictedDigit: 3, duration: 1, timeframeUnit: 'Ticks'
  };
  for (let i = 0; i < 200; i++) {
    recordSettledContractOutcome(signal, {
      quote: { ask_price: 1, payout: 1.9, currency: 'USD' },
      profit: 0.9, contractId: `forward-pass-${i}`, now: 3000 + i
    });
  }
  const qualified = getPaperForwardSummary(signal);
  assert.equal(qualified.trades, 200);
  assert.equal(qualified.recentTrades, 50);
  assert.equal(qualified.recentWinRate, 1);
  assert.equal(qualified.calibrated, true);

  for (let i = 0; i < 10; i++) {
    recordSettledContractOutcome(signal, {
      quote: { ask_price: 1, payout: 1.9, currency: 'USD' },
      profit: -1, contractId: `forward-loss-${i}`, now: 4000 + i
    });
  }
  const deteriorated = getPaperForwardSummary(signal);
  assert.equal(deteriorated.winRate, 200 / 210);
  assert.equal(deteriorated.recentWinRate, 0.8);
  assert.equal(deteriorated.calibrated, false);
});
