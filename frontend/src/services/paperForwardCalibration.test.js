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
