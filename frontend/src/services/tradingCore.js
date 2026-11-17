// Shared, deterministic Deriv contract and risk helpers. No order is sent from this module.
export const VOLATILITY_MARKETS = [
  ['Volatility 10 (1s) Index','R_10'],['Volatility 10 Index','R_10'],['Volatility 15 (1s) Index','R_15'],
  ['Volatility 25 (1s) Index','R_25'],['Volatility 25 Index','R_25'],['Volatility 30 (1s) Index','R_30'],
  ['Volatility 50 (1s) Index','R_50'],['Volatility 50 Index','R_50'],['Volatility 75 (1s) Index','R_75'],
  ['Volatility 75 Index','R_75'],['Volatility 90 (1s) Index','R_90'],['Volatility 100 (1s) Index','R_100'],
  ['Volatility 100 Index','R_100']
];
export const MARKET_SYMBOLS = [...new Set(VOLATILITY_MARKETS.map(([,symbol])=>symbol))];
export const SYMBOL_BY_MARKET = Object.fromEntries(VOLATILITY_MARKETS);

export function getContractIntent(signal) {
  if (!signal || !signal.tradeType || !signal.option || signal.option === 'Both') return null;
  const {tradeType,subTradeType,option}=signal;
  if (tradeType==='Digits') {
    if (subTradeType==='Over/Under') return {contract_type:option==='Over'?'DIGITOVER':'DIGITUNDER',barrier:String(signal.predictedDigit ?? signal.barrier ?? '')};
    if (subTradeType==='Matches/Differs') return {contract_type:option==='Matches'?'DIGITMATCH':'DIGITDIFF',barrier:String(signal.predictedDigit ?? signal.barrier ?? '')};
    if (subTradeType==='Even/Odd') return {contract_type:option==='Even'?'DIGITEVEN':'DIGITODD'};
  }
  if (tradeType==='Ups & Downs') {
    if (subTradeType==='Rise/Fall') return {contract_type:option==='Rise'?'CALL':'PUT'};
    if (subTradeType==='Higher/Lower') return {contract_type:option==='Higher'?'HIGHER':'LOWER',barrier:String(signal.barrier ?? '')};
  }
  if (tradeType==='Touch & No Touch') return {contract_type:option==='Touch'?'ONETOUCH':'NOTOUCH',barrier:String(signal.barrier ?? '')};
  if (tradeType==='Multipliers') return {contract_type:option==='Up'?'MULTUP':'MULTDOWN',multiplier:Number(signal.multiplier || 100)};
  if (tradeType==='Accumulators') return {contract_type:'ACCU',growth_rate:Number(signal.growthRate || 0.01)};
  if (tradeType==='Vanillas' && subTradeType==='Call/Put') return {contract_type:option==='Call'?'VANILLALONGCALL':'VANILLALONGPUT'};
  if (tradeType==='Turbos' && subTradeType==='Turbos') return {contract_type:option==='Up'?'TURBOSLONG':'TURBOSSHORT'};
  return null;
}

export function buildProposal(signal, stake, currency='USD') {
  const intent=getContractIntent(signal);
  if (!intent || !signal.symbol || !Number.isFinite(Number(stake)) || Number(stake)<=0) throw new Error('Signal is incomplete or its contract mapping is unsupported.');
  const request={proposal:1,amount:Number(stake),basis:'stake',currency,underlying_symbol:signal.symbol,...intent};
  if (intent.barrier==='') throw new Error('This contract requires an explicit barrier; no trade was sent.');
  if (signal.tradeType==='Accumulators') {
    request.duration=Number(signal.duration || 10); request.duration_unit='t';
    request.limit_order={take_profit:Number(signal.takeProfit || 0.5),stop_loss:Number(signal.contractStopLoss || 0.5)};
  } else if (signal.tradeType==='Multipliers') {
    request.limit_order={take_profit:Number(signal.takeProfit || 1),stop_loss:Number(signal.contractStopLoss || 1)};
  } else if (signal.tradeType==='Vanillas') {
    const expiry=Number(signal.expiryEpoch);
    if (!Number.isFinite(expiry) || expiry<=Math.floor(Date.now()/1000)) throw new Error('Vanilla signal has no valid future expiry.');
    request.date_expiry=expiry;
  } else {
    const unitMap={Ticks:'t',Seconds:'s',Minutes:'m',Hours:'h',Days:'d'};
    const unit=unitMap[signal.timeframeUnit];
    if (!unit || !Number.isInteger(Number(signal.duration)) || Number(signal.duration)<1) throw new Error('Signal duration is invalid.');
    request.duration=Number(signal.duration); request.duration_unit=unit;
  }
  return request;
}

export function isFreshSignal(signal, now=Date.now()) {
  const ts=Number(signal?.timestamp || signal?.createdAt || 0);
  return Boolean(signal?.id && signal?.symbol && ts>0 && now-ts>=0 && now-ts<=15000 && signal.option!=='Both' && signal.source==='analysis-tool-live');
}

export function boundedNextStake(baseStake,currentStake,martingaleFactor,lossesInRow=0,maxMultiplier=3) {
  const base=Math.max(0,Number(baseStake)||0);
  if (!base || lossesInRow>=2) return base;
  const factor=Math.min(3,Math.max(1,Number(martingaleFactor)||1));
  return Math.min(base*maxMultiplier,Math.max(base,Number(currentStake)||base)*factor);
}
