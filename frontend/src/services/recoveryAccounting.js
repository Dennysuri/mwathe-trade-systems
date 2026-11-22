/**
 * Session-wide recovery accounting shared by the normal and recovery phases.
 * The ideal-profit ledger assumes every executed trade won at the configured
 * base stake and the exact quoted payout. Actual P/L uses Deriv settlements.
 */
const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function createRecoveryLedger(baseStake = 1) {
  return {
    baseStake: Math.max(0.01, Number(baseStake) || 1),
    idealProfit: 0,
    actualProfit: 0,
    deficit: 0,
    recoveryTrades: 0,
    settledTrades: 0
  };
}

export function recordRecoveryOutcome(ledger, {
  profit = 0,
  baseStakeWinProfit = 0
} = {}) {
  const current = ledger || createRecoveryLedger();
  const actual = Number(profit);
  const ideal = Number(baseStakeWinProfit);
  if (!Number.isFinite(actual) || !Number.isFinite(ideal) || ideal < 0) return current;
  const idealProfit = roundMoney(current.idealProfit + ideal);
  const actualProfit = roundMoney(current.actualProfit + actual);
  const deficit = roundMoney(Math.max(0, idealProfit - actualProfit));
  return {
    ...current,
    idealProfit,
    actualProfit,
    deficit,
    settledTrades: current.settledTrades + 1,
    recoveryTrades: deficit > 0 ? current.recoveryTrades + 1 : 0
  };
}

/**
 * Size the next recovery order from the remaining cumulative gap and the
 * current quote's net-profit-per-unit. The configured martingale is the
 * minimum recovery progression; the quote-derived stake may be higher.
 * Never exceed the explicit maximum multiplier.
 */
export function nextRecoveryStake(ledger, {
  baseStake = ledger?.baseStake || 1,
  martingaleFactor = 2,
  netProfitPerUnit,
  maxStakeMultiplier = 3
} = {}) {
  const base = Math.max(0.01, Number(baseStake) || 1);
  const deficit = Math.max(0, Number(ledger?.deficit) || 0);
  if (deficit <= 0.005) {
    return { allowed: true, recovered: true, stake: roundMoney(base), requiredStake: roundMoney(base), deficit: 0 };
  }
  const rate = Number(netProfitPerUnit);
  const factor = Math.max(1, Number(martingaleFactor) || 1);
  const ceiling = base * Math.max(1, Number(maxStakeMultiplier) || 1);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { allowed: false, recovered: false, stake: null, requiredStake: Infinity, deficit,
      reason: 'The quoted contract has no positive net winning return.' };
  }
  const requiredStake = deficit / rate;
  const configuredProgression = base * factor;
  const stake = Math.max(configuredProgression, requiredStake);
  if (!Number.isFinite(stake) || stake > ceiling + 0.005) {
    return { allowed: false, recovered: false, stake: null, requiredStake: roundMoney(requiredStake), deficit,
      reason: 'The recovery amount exceeds the configured maximum stake.' };
  }
  return { allowed: true, recovered: false, stake: roundMoney(stake),
    requiredStake: roundMoney(requiredStake), deficit, ceiling: roundMoney(ceiling) };
}
