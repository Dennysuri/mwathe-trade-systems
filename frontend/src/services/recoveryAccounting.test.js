import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecoveryLedger,
  nextRecoveryStake,
  recordRecoveryOutcome
} from './recoveryAccounting.js';

test('cumulative recovery remains active after a win that does not close the gap', () => {
  let ledger = createRecoveryLedger(1);
  ledger = recordRecoveryOutcome(ledger, { profit: -1, baseStakeWinProfit: 0.9 });
  assert.equal(ledger.deficit, 1.9);
  ledger = recordRecoveryOutcome(ledger, { profit: 1.9, baseStakeWinProfit: 0.9 });
  assert.equal(ledger.actualProfit, 0.9);
  assert.equal(ledger.idealProfit, 1.8);
  assert.equal(ledger.deficit, 0.9);
  const next = nextRecoveryStake(ledger, { baseStake: 1, martingaleFactor: 2, netProfitPerUnit: 0.9 });
  assert.equal(next.allowed, true);
  assert.equal(next.stake, 2);
});

test('base stake is restored only when cumulative ideal profit is recovered', () => {
  let ledger = createRecoveryLedger(1);
  ledger = recordRecoveryOutcome(ledger, { profit: -1, baseStakeWinProfit: 0.9 });
  ledger = recordRecoveryOutcome(ledger, { profit: 1.9, baseStakeWinProfit: 0.9 });
  ledger = recordRecoveryOutcome(ledger, { profit: 1.8, baseStakeWinProfit: 0.9 });
  assert.equal(ledger.deficit, 0);
  const next = nextRecoveryStake(ledger, { baseStake: 1, martingaleFactor: 2, netProfitPerUnit: 0.9 });
  assert.equal(next.recovered, true);
  assert.equal(next.stake, 1);
});

test('recovery refuses a stake above the configured hard ceiling', () => {
  const ledger = { ...createRecoveryLedger(1), deficit: 5 };
  const next = nextRecoveryStake(ledger, { baseStake: 1, martingaleFactor: 2, netProfitPerUnit: 0.5, maxStakeMultiplier: 3 });
  assert.equal(next.allowed, false);
  assert.equal(next.requiredStake, 10);
});

test('recovery refuses non-positive quoted returns', () => {
  const ledger = { ...createRecoveryLedger(1), deficit: 1 };
  const next = nextRecoveryStake(ledger, { baseStake: 1, martingaleFactor: 2, netProfitPerUnit: 0 });
  assert.equal(next.allowed, false);
});
