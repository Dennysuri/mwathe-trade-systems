import { getStrategyPerformance } from './contractOutcomeIntelligence.js';

const DIGIT_TYPES = ['Over/Under', 'Matches/Differs', 'Even/Odd'];

export function getContractDifficulty(signal = {}) {
  let baselineWinProbability = null;
  let basis = 'Requires exact contract terms, proposal payout and forward-settled outcomes.';
  if (signal.tradeType === 'Digits' && DIGIT_TYPES.includes(signal.subTradeType)) {
    const option = signal.option;
    const barrier = Number(signal.predictedDigit ?? signal.barrier);
    if (signal.subTradeType === 'Over/Under' && Number.isInteger(barrier) && barrier >= 0 && barrier <= 9) {
      baselineWinProbability = option === 'Over' ? (9 - barrier) / 10
        : option === 'Under' ? barrier / 10 : null;
      basis = 'Uniform last-digit reference rate; not a live-market prediction.';
    } else if (signal.subTradeType === 'Matches/Differs') {
      baselineWinProbability = option === 'Matches' ? 0.1 : option === 'Differs' ? 0.9 : null;
      basis = 'Ten possible last digits; reference rate only.';
    } else if (signal.subTradeType === 'Even/Odd') {
      baselineWinProbability = ['Even', 'Odd'].includes(option) ? 0.5 : null;
      basis = 'Five even and five odd digits; reference rate only.';
    }
  }
  const difficulty = baselineWinProbability === null ? 'unmeasured'
    : baselineWinProbability >= 0.8 ? 'lower-hit-difficulty'
      : baselineWinProbability >= 0.5 ? 'moderate-hit-difficulty' : 'high-hit-difficulty';
  return {
    baselineWinProbability, difficulty,
    targetWinRate: 0.8, basis,
    note: baseline hit frequency is not profitability; Deriv payout determines break-even.
  };
}

export function assessStrategyRecovery(signal = {}, {
  performance = getStrategyPerformance(signal),
  minTradesForRateReview = 20,
  targetWinRate = 0.8,
  maxConsecutiveLosses = 2
} = {}) {
  const difficulty = getContractDifficulty(signal);
  const reasons = [];
  if (performance.consecutiveLosses >= maxConsecutiveLosses) {
    reasons.push(`This exact contract profile has ${performance.consecutiveLosses} consecutive losses across markets.`);
    return { allowed: false, mode: 'PROFILE_COOLDOWN', performance, difficulty, reasons };
  }
  // The 80% objective is only a hard review threshold where the contract's
  // reference hit-rate makes it statistically plausible. Low-hit-rate contracts
  // must be judged against quote-specific break-even, not an impossible 80% rule.
  if (performance.trades >= minTradesForRateReview
      && difficulty.baselineWinProbability !== null
      && difficulty.baselineWinProbability >= targetWinRate
      && performance.winRate < targetWinRate) {
    reasons.push(`Observed win rate ${(performance.winRate * 100).toFixed(1)}% is below the ${(targetWinRate * 100).toFixed(0)}% objective for this profile.`);
    return { allowed: false, mode: 'BELOW_TARGET_REVIEW', performance, difficulty, reasons };
  }
  if (performance.consecutiveLosses === 1) reasons.push('One loss on this profile: increase confirmation and re-check payout before re-entry.');
  if (performance.trades < minTradesForRateReview) reasons.push(`Only ${performance.trades} settled profile trades; performance evidence is still limited.`);
  reasons.push(`Contract difficulty: ${difficulty.difficulty}; ${difficulty.basis}`);
  return { allowed: true, mode: performance.consecutiveLosses === 1 ? 'RECOVERY_CONFIRMATION' : 'NORMAL', performance, difficulty, reasons };
}

export function assessSessionRisk({ profitLoss = 0, targetProfit = 0, stopLoss = 0, balance = null, initialBalance = null } = {}) {
  const pl = Number(profitLoss), target = Number(targetProfit), stop = Math.abs(Number(stopLoss));
  if (Number.isFinite(target) && target > 0 && pl >= target) return { allowed: false, reason: 'TARGET_REACHED', remainingToTarget: 0 };
  if (Number.isFinite(stop) && stop > 0 && pl <= -stop) return { allowed: false, reason: 'STOP_LOSS_REACHED', remainingToStop: 0 };
  const remainingToTarget = Number.isFinite(target) && target > 0 ? Math.max(0, target - pl) : null;
  const remainingToStop = Number.isFinite(stop) && stop > 0 ? Math.max(0, stop + pl) : null;
  const drawdown = Number.isFinite(Number(balance)) && Number.isFinite(Number(initialBalance))
    ? Number(initialBalance) - Number(balance) : null;
  return { allowed: true, reason: 'WITHIN_SESSION_LIMITS', remainingToTarget, remainingToStop, drawdown };
}
