import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStrategyEnsemble, evaluateExpectedValue, validateEntryWindow } from '../src/services/strategyIntelligence.js';
import { boundedNextStake } from '../src/services/tradingCore.js';
import { contractProfile, getContractPerformance } from '../src/services/contractOutcomeIntelligence.js';
import { beginPaperTrial, advancePaperTrials, getPaperForwardSummary, resetPaperTrials } from '../src/services/paperForwardCalibration.js';

test('digit ensemble waits for sufficient observations', async () => {
  const result = await evaluateStrategyEnsemble(Array.from({length:120},(_,i)=>100.01+i/100), {tradeType:'Digits',subTradeType:'Matches/Differs',option:'Both',predictedDigit:3});
  assert.equal(result.ready,false);
  assert.equal(result.tradable,false);
});

test('digit ensemble runs independent research families in parallel and never calls them calibrated', async () => {
  const prices = Array.from({length:300},(_,i)=>100+(i%10)/100);
  const result = await evaluateStrategyEnsemble(prices,{tradeType:'Digits',subTradeType:'Even/Odd',option:'Both',predictedDigit:5});
  assert.equal(result.ready,true);
  assert.equal(result.tradable,false);
  assert.ok(result.strategies.length>=3);
  assert.ok(result.strategies.every(s=>s.calibrated===false));
});

test('expected value uses payout-adjusted break-even and uncertainty', () => {
  const result=evaluateExpectedValue({winProbability:0.8,netProfitOnWin:0.2,lossOnLoss:1,uncertainty:0.1});
  assert.equal(result.positive,false);
  assert.ok(result.lowerBound < 0.8);
});

test('entry window rejects stale signals and accepts fresh tick contracts', () => {
  const stale=validateEntryWindow({createdAt:1000,option:'Over',timeframeUnit:'Ticks'}, {now:5000,maxSignalAgeMs:1000});
  assert.equal(stale.valid,false);
  const fresh=validateEntryWindow({createdAt:4900,option:'Over',timeframeUnit:'Ticks'}, {now:5000});
  assert.equal(fresh.valid,true);
});

test('Thamira ranks a candidate without presenting its score as probability or authorizing a trade', async () => {
  const prices = Array.from({length:300},(_,i)=>100 + Math.sin(i/4)*0.03 + i*0.0008);
  const result = await evaluateStrategyEnsemble(prices,{tradeType:'Ups & Downs',subTradeType:'Rise/Fall',option:'Both'});
  assert.equal(result.tradable,false);
  assert.ok(['CANDIDATE','MONITOR'].includes(result.decision));
  if (result.candidate) {
    assert.ok(result.candidate.score >= 62);
    assert.ok(result.candidate.score <= 94);
    assert.match(result.candidate.note,/not a calibrated probability/i);
  }
});

test('bounded recovery permits a third attempt while enforcing the 3x cap and a five-loss ceiling', () => {
  assert.equal(boundedNextStake(1, 2.25, 1.5, 3), 3);
  assert.equal(boundedNextStake(1, 3, 1.5, 4), 3);
  assert.equal(boundedNextStake(1, 3, 1.5, 5), 1);
});

test('contract intelligence separates barrier and predicted-digit configurations', () => {
  const over4 = {symbol:'R_100',tradeType:'Digits',subTradeType:'Over/Under',option:'Over',predictedDigit:4,barrier:'4',duration:1,timeframeUnit:'Ticks'};
  const over5 = {...over4,predictedDigit:5,barrier:'5'};
  assert.notEqual(contractProfile(over4), contractProfile(over5));
  const performance = getContractPerformance(over4);
  assert.equal(performance.trades, 0);
  assert.equal(performance.sampleSufficient, false);
});

test('research candidates use the correct option vocabulary for each contract family', async () => {
  const prices = Array.from({length:300},(_,i)=>100+i*0.00001+i*i*0.000001);
  const cases = [
    [{tradeType:'Ups & Downs',subTradeType:'Rise/Fall',option:'Both'}, 'Rise'],
    [{tradeType:'Ups & Downs',subTradeType:'Higher/Lower',option:'Both'}, 'Higher'],
    [{tradeType:'Touch & No Touch',subTradeType:'Touch/No Touch',option:'Both'}, 'Touch'],
    [{tradeType:'Multipliers',subTradeType:'Multipliers',option:'Both'}, 'Up'],
    [{tradeType:'Turbos',subTradeType:'Turbos',option:'Both'}, 'Up'],
    [{tradeType:'Vanillas',subTradeType:'Call/Put',option:'Both'}, 'Call'],
    [{tradeType:'Accumulators',subTradeType:'',option:'Both'}, 'Accumulate']
  ];
  for (const [config, expected] of cases) {
    const result = await evaluateStrategyEnsemble(prices, config);
    assert.equal(result.watchCandidate?.option, expected, config.tradeType);
  }
});

test('only a fully calibrated exact Digits tick profile can become tradable', async () => {
  resetPaperTrials();
  const config = {symbol:'R_100',tradeType:'Digits',subTradeType:'Even/Odd',option:'Both',
    predictedDigit:5,barrier:'5',duration:1,timeframeUnit:'Ticks',currency:'USD'};
  const prices = Array.from({length:300},()=>100.02);
  const before = await evaluateStrategyEnsemble(prices,config);
  assert.equal(before.tradable,false);
  assert.equal(before.decision,'CANDIDATE');
  const option = before.watchCandidate.option;
  const signal = {...config,option};
  for(let i=0;i<220;i++){
    assert.equal(beginPaperTrial({...signal,id:'calibrated-'+i},{quote:{askPrice:1,payout:1.8,currency:'USD'}}),true);
    const terminalQuote = option === 'Even' ? 123.42 : 123.43;
    assert.equal(advancePaperTrials('R_100',terminalQuote).length,1);
  }
  const summary=getPaperForwardSummary(signal);
  assert.equal(summary.calibrated,true);
  const after=await evaluateStrategyEnsemble(prices,{...config,option});
  assert.equal(after.tradable,true);
  assert.equal(after.decision,'CALIBRATED_READY');
  assert.equal(after.paperCalibration.trades,220);
});

test('non-Digit families remain non-tradable without their own settlement calibration', async () => {
  const prices=Array.from({length:300},(_,i)=>100+i*0.00001+i*i*0.000001);
  const result=await evaluateStrategyEnsemble(prices,{symbol:'R_50',tradeType:'Ups & Downs',
    subTradeType:'Rise/Fall',option:'Both',duration:1,timeframeUnit:'Ticks'});
  assert.equal(result.tradable,false);
  assert.equal(result.paperCalibration,null);
});
