const MAX_BALANCE_AGE_MS = 60_000;
const MAX_STAKE_BALANCE_FRACTION = 0.02;
const PROTECTIVE_STAKE_FRACTION = 0.01;

export function evaluateAccountRisk({
  balance, balanceUpdatedAt, now = Date.now(), sessionPL = 0,
  targetProfit = 0, stopLoss = 0, nextStake = 0, openExposure = 0,
  consecutiveLosses = 0
} = {}) {
  const cash = Number(balance), stake = Number(nextStake), exposure = Number(openExposure);
  const target = Math.max(0, Number(targetProfit) || 0);
  const lossLimit = Math.max(0, Number(stopLoss) || 0);
  const pnl = Number(sessionPL) || 0;
  const age = now - Number(balanceUpdatedAt || 0);
  const result = (allowed, mode, reason, maxStake = null) => ({
    allowed, mode, reason, balance: Number.isFinite(cash) ? cash : null,
    sessionPL: pnl, targetProgress: target > 0 ? Math.max(0, pnl / target) : 0,
    stopLossUsed: lossLimit > 0 ? Math.max(0, -pnl / lossLimit) : 0,
    maxStake
  });

  if (!Number.isFinite(cash) || cash <= 0 || !Number.isFinite(age) || age < 0 || age > MAX_BALANCE_AGE_MS)
    return result(false, 'balance-unverified', 'Fresh Deriv account balance is required before another entry.');
  if (target > 0 && pnl >= target)
    return result(false, 'target-reached', 'Session target profit has been reached.');
  if (lossLimit > 0 && pnl <= -lossLimit)
    return result(false, 'stop-loss-reached', 'Session stop loss has been reached.');
  if (consecutiveLosses >= 3)
    return result(false, 'loss-streak-pause', 'Three consecutive losses: pause entries and reassess the strategy profile.');

  const balanceCap = cash * MAX_STAKE_BALANCE_FRACTION;
  const exposureCap = cash * MAX_STAKE_BALANCE_FRACTION;
  if (stake <= 0 || stake > balanceCap)
    return result(false, 'stake-too-large', 'Next stake exceeds 2% of the latest account balance.', balanceCap);
  if (exposure > exposureCap)
    return result(false, 'exposure-too-large', 'Open exposure exceeds 2% of the latest account balance.', balanceCap);

  const targetProgress = target > 0 ? pnl / target : 0;
  const stopLossRemaining = lossLimit > 0 ? lossLimit + pnl : Infinity;
  const protective = targetProgress >= 0.8;
  const maxStake = protective ? cash * PROTECTIVE_STAKE_FRACTION : balanceCap;
  if (protective && stake > maxStake)
    return result(false, 'profit-protection', 'Target is at least 80% reached; reduce stake to protect accumulated profit.', maxStake);
  if (lossLimit > 0 && stopLossRemaining <= Math.max(stake, cash * 0.005))
    return result(false, 'near-stop-loss', 'Remaining stop-loss allowance is too small for the next stake; protect the account.', maxStake);
  return result(true, protective ? 'profit-protection' : 'normal',
    protective ? 'Target progress is high; continue only with reduced exposure.' : 'Account balance, session limits and exposure are within configured risk bounds.',
    maxStake);
}

export function getContractDifficulty(signal = {}, quote = {}) {
  const ask = Number(quote.askPrice), payout = Number(quote.payout);
  const validQuote = Number.isFinite(ask) && Number.isFinite(payout) && ask > 0 && payout > ask;
  const breakEvenRate = validQuote ? ask / payout : null;
  let theoreticalBaseline = null;
  if (signal.tradeType === 'Digits') {
    if (signal.subTradeType === 'Even/Odd') theoreticalBaseline = 0.5;
    if (signal.subTradeType === 'Matches/Differs') theoreticalBaseline = signal.option === 'Matches' ? 0.1 : 0.9;
    if (signal.subTradeType === 'Over/Under') {
      const barrier = Number(signal.predictedDigit);
      if (Number.isInteger(barrier) && barrier >= 0 && barrier <= 9)
        theoreticalBaseline = signal.option === 'Over' ? (9 - barrier) / 10 : barrier / 10;
    }
  }
  return {
    validQuote, askPrice: validQuote ? ask : null, payout: validQuote ? payout : null,
    breakEvenRate, theoreticalBaseline,
    edgeRequired: validQuote && theoreticalBaseline !== null ? breakEvenRate - theoreticalBaseline : null,
    note: validQuote
      ? 'Break-even is derived from this exact proposal. Theoretical digit frequency is a baseline, not a forecast.'
      : 'Exact proposal ask and payout are required to calculate break-even.'
  };
}
