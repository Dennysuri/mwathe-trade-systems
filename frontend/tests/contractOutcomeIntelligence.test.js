import test from 'node:test';
import assert from 'node:assert/strict';
import { getForwardContractCalibration, recordContractOutcome } from '../src/services/contractOutcomeIntelligence.js';

function resetStorage() {
  const values = new Map();
  globalThis.window = {};
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}
const signal = {
  symbol: 'R_100', tradeType: 'Ups & Downs', subTradeType: 'Rise/Fall',
  option: 'Rise', duration: 1, timeframeUnit: 'Ticks', currency: 'USD'
};
const quote = { ask_price: 1, payout: 2, currency: 'USD', date_start: 1000 };

test('broker-settled demo outcomes calibrate a non-Digits profile for real-account gating', () => {
  resetStorage();
  for (let i = 0; i < 200; i++) {
    recordContractOutcome(signal, {
      profit: 1, stake: 1, contractId: `rise-${i}`, accountType: 'demo', quote
    });
  }
  const result = getForwardContractCalibration(signal, 'USD');
  assert.equal(result.trades, 200);
  assert.equal(result.wins, 200);
  assert.equal(result.recentTrades, 50);
  assert.equal(result.recentWinRate, 1);
  assert.equal(result.calibrated, true);
});

test('real-account settlements cannot contaminate demo forward calibration', () => {
  resetStorage();
  for (let i = 0; i < 220; i++) {
    recordContractOutcome(signal, {
      profit: 1, stake: 1, contractId: `real-${i}`, accountType: 'real', quote
    });
  }
  assert.equal(getForwardContractCalibration(signal, 'USD').trades, 0);
  assert.equal(getForwardContractCalibration(signal, 'USD').calibrated, false);
});

test('calibration is isolated by exact contract profile and currency', () => {
  resetStorage();
  for (let i = 0; i < 200; i++) {
    recordContractOutcome(signal, {
      profit: 1, stake: 1, contractId: `profile-${i}`, accountType: 'demo', quote
    });
  }
  assert.equal(getForwardContractCalibration({ ...signal, option: 'Fall' }, 'USD').trades, 0);
  assert.equal(getForwardContractCalibration(signal, 'EUR').trades, 0);
});

test('a deteriorating latest 50 outcomes disables a previously strong profile', () => {
  resetStorage();
  for (let i = 0; i < 200; i++) {
    recordContractOutcome(signal, {
      profit: 1, stake: 1, contractId: `stable-${i}`, accountType: 'demo', quote
    });
  }
  assert.equal(getForwardContractCalibration(signal, 'USD').calibrated, true);
  for (let i = 0; i < 10; i++) {
    recordContractOutcome(signal, {
      profit: -1, stake: 1, contractId: `recent-loss-${i}`, accountType: 'demo', quote
    });
  }
  const result = getForwardContractCalibration(signal, 'USD');
  assert.equal(result.recentTrades, 50);
  assert.equal(result.recentWinRate, 0.8);
  assert.equal(result.calibrated, false);
});
