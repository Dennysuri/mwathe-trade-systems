import test from 'node:test';
import assert from 'node:assert/strict';
import { beginPaperTrial, advancePaperTrials, getPaperForwardSummary, resetPaperTrials, wilsonLowerBound } from '../src/services/paperForwardCalibration.js';

function quote(askPrice=1,payout=1.9){ return {askPrice,payout,currency:'USD',quotedAt:900}; }

test('paper-forward digit trials require a valid Deriv proposal quote and settle after future ticks', () => {
  resetPaperTrials();
  const signal = { id:'paper-1', symbol:'R_100', tradeType:'Digits', subTradeType:'Over/Under',
    option:'Over', predictedDigit:4, duration:3, timeframeUnit:'Ticks', currency:'USD' };
  assert.equal(beginPaperTrial(signal,{now:1000}),false);
  assert.equal(beginPaperTrial(signal,{now:1000,quote:quote(1,0.9)}),false);
  assert.equal(beginPaperTrial(signal,{now:1000,quote:quote()}),true);
  assert.equal(beginPaperTrial({...signal,id:'paper-2'},{now:1001,quote:quote()}),false);
  assert.equal(advancePaperTrials('R_100',123.45,{now:1100}).length,0);
  assert.equal(advancePaperTrials('R_100',123.46,{now:1200}).length,0);
  const settled=advancePaperTrials('R_100',123.47,{now:1300});
  assert.equal(settled.length,1);
  assert.equal(settled[0].terminalDigit,7);
  assert.equal(settled[0].won,true);
  assert.equal(settled[0].askPrice,1);
  assert.equal(settled[0].payout,1.9);
  assert.equal(settled[0].breakEvenRate,1/1.9);
  assert.equal(getPaperForwardSummary(signal).pending,0);
});

test('paper-forward trials reject unsupported families and minute durations', () => {
  resetPaperTrials();
  const q=quote();
  assert.equal(beginPaperTrial({symbol:'R_100',tradeType:'Ups & Downs',subTradeType:'Rise/Fall',
    option:'Rise',duration:5,timeframeUnit:'Ticks'},{quote:q}),false);
  assert.equal(beginPaperTrial({symbol:'R_100',tradeType:'Digits',subTradeType:'Even/Odd',
    option:'Even',predictedDigit:2,duration:1,timeframeUnit:'Minutes'},{quote:q}),false);
});

test('Wilson lower bound is conservative and invalid for zero samples', () => {
  assert.equal(wilsonLowerBound(0,0),null);
  assert.ok(wilsonLowerBound(80,100)<0.8);
  assert.ok(wilsonLowerBound(95,100)<0.95);
});

test('calibration requires at least 200 quote-matched samples and beats worst break-even plus margin', () => {
  resetPaperTrials();
  const signal={symbol:'R_100',tradeType:'Digits',subTradeType:'Even/Odd',option:'Even',
    predictedDigit:4,duration:1,timeframeUnit:'Ticks',currency:'USD'};
  for(let i=0;i<200;i++){
    assert.equal(beginPaperTrial({...signal,id:'sample-'+i},{quote:quote(1,1.8)}),true);
    const row=advancePaperTrials('R_100',i<110?123.42:123.41);
    assert.equal(row.length,1);
  }
  const summary=getPaperForwardSummary(signal);
  assert.equal(summary.trades,200);
  assert.equal(summary.calibrated,false);
  assert.equal(summary.targetWinRate,0.9);
  assert.equal(summary.targetWinRateMet,false);
  assert.ok(summary.lowerBound!==null);
  assert.ok(summary.maxBreakEvenRate>0.5);
});

test('strong quote-matched results can clear the conservative calibration threshold', () => {
  resetPaperTrials();
  const signal={symbol:'R_100',tradeType:'Digits',subTradeType:'Even/Odd',option:'Even',
    predictedDigit:4,duration:1,timeframeUnit:'Ticks',currency:'USD'};
  for(let i=0;i<220;i++){
    assert.equal(beginPaperTrial({...signal,id:'strong-'+i},{quote:quote(1,1.8)}),true);
    advancePaperTrials('R_100',123.42);
  }
  const summary=getPaperForwardSummary(signal);
  assert.equal(summary.calibrated,true);
  assert.ok(summary.lowerBound>summary.maxBreakEvenRate+summary.safetyMargin);
});

test('parity calibration profile does not fragment on irrelevant predicted digit', () => {
  const first={symbol:'R_50',tradeType:'Digits',subTradeType:'Even/Odd',option:'Even',
    predictedDigit:1,duration:1,timeframeUnit:'Ticks',currency:'USD'};
  const second={...first,predictedDigit:8};
  assert.equal(beginPaperTrial({...first,id:'parity-a'},{quote:quote()}),true);
  assert.equal(beginPaperTrial({...second,id:'parity-b'},{quote:quote()}),false);
  resetPaperTrials();
});

test('pip size preserves trailing zero precision when deriving the terminal digit', () => {
  resetPaperTrials();
  const signal={id:'precision',symbol:'R_50',tradeType:'Digits',subTradeType:'Even/Odd',
    option:'Even',duration:1,timeframeUnit:'Ticks',currency:'USD'};
  assert.equal(beginPaperTrial(signal,{quote:quote()}),true);
  const settled=advancePaperTrials('R_50',{quote:123.4,pipSize:2});
  assert.equal(settled.length,1);
  assert.equal(settled[0].terminalDigit,0);
  assert.equal(settled[0].won,true);
});


test('90 percent observed win-rate target is enforced alongside quote break-even confidence', () => {
  resetPaperTrials();
  const signal={symbol:'R_100',tradeType:'Digits',subTradeType:'Even/Odd',option:'Even',
    predictedDigit:4,duration:1,timeframeUnit:'Ticks',currency:'USD'};
  for(let i=0;i<200;i++){
    assert.equal(beginPaperTrial({...signal,id:'target-'+i},{quote:quote(1,1.8)}),true);
    advancePaperTrials('R_100',i<180?123.42:123.41);
  }
  const summary=getPaperForwardSummary(signal);
  assert.equal(summary.targetWinRate,0.9);
  assert.equal(summary.targetWinRateMet,true);
  assert.equal(summary.calibrated,true);
});
