import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Brain, Activity, Zap, Play, Square, Cpu, CheckCircle2 } from 'lucide-react'
import { MARKET_SYMBOLS, VOLATILITY_MARKETS, buildProposal } from '../services/tradingCore'
import { evaluateStrategyEnsemble } from '../services/strategyIntelligence'
import { beginPaperTrial, advancePaperTrials, getPaperForwardSummary, resetPaperTrials } from '../services/paperForwardCalibration'

const SUB_TRADE_TYPES = {
  Accumulators: [], Vanillas: ['Call/Put'], Turbos: ['Turbos'], Multipliers: ['Multipliers'],
  'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'],
  Digits: ['Over/Under', 'Matches/Differs', 'Even/Odd']
}
const OPTIONS = {
  'Over/Under': ['Over','Under','Both'], 'Even/Odd': ['Even','Odd','Both'],
  'Matches/Differs': ['Matches','Differs','Both'], Turbos: ['Up','Down','Both'],
  'Rise/Fall': ['Rise','Fall','Both'], 'Higher/Lower': ['Higher','Lower','Both'],
  'Touch/No Touch': ['Touch','No Touch','Both'], 'Call/Put': ['Call','Put','Both'],
  Multipliers: ['Up','Down','Both']
}
const TIMEFRAME_RULES = {
  Accumulators:{units:['Ticks'],defaultUnit:'Ticks',min:10,max:85,fixed:true,label:'10 - 85 ticks (risk-managed)'},
  Multipliers:{units:['Auto'],defaultUnit:'Auto',min:1,max:1,fixed:true,label:'Auto (market dependent)'},
  Digits:{units:['Ticks'],defaultUnit:'Ticks',min:1,max:10,fixed:false},
  Turbos:{units:['Ticks','Minutes'],defaultUnit:'Ticks',min:1,maxMap:{Ticks:10,Minutes:1440},fixed:false},
  'Ups & Downs':{units:['Ticks','Minutes'],defaultUnit:'Ticks',min:1,maxMap:{Ticks:10,Minutes:1440},fixed:false},
  'Touch & No Touch':{units:['Ticks','Minutes'],defaultUnit:'Ticks',min:1,maxMap:{Ticks:10,Minutes:1440},fixed:false},
  Vanillas:{units:['Minutes','Hours','Days'],defaultUnit:'Minutes',min:1,maxMap:{Minutes:1440,Hours:24,Days:30},fixed:false}
}
const TRADE_TYPES=Object.keys(TIMEFRAME_RULES)
const lastDigit=value=>{const s=String(value);const decimals=s.includes('.')?s.split('.')[1]:'';return Number((decimals || s).slice(-1))}
const mean=values=>values.reduce((a,b)=>a+b,0)/(values.length||1)
const analyseSeries=(prices,config)=>{
  if(prices.length<80)return null
  const recent=prices.slice(-100),deltas=recent.slice(1).map((v,i)=>v-recent[i])
  const up=deltas.filter(v=>v>0).length,down=deltas.filter(v=>v<0).length,flat=deltas.length-up-down
  const drift=mean(deltas),scale=mean(deltas.map(Math.abs))||1
  const trend=Math.abs(drift)/scale
  const digits=recent.map(lastDigit)
  const freq=Array(10).fill(0);digits.forEach(d=>freq[d]++)
  const target=Number(config.predictedDigit)
  let option=config.option,barrier='',score=0,detail=''
  if(config.tradeType==='Digits'){
    const counts={Over:0,Under:0,Matches:0,Differs:0,Even:0,Odd:0}
    digits.forEach(d=>{if(d>target)counts.Over++;if(d<target)counts.Under++;if(d===target)counts.Matches++;if(d!==target)counts.Differs++;if(d%2===0)counts.Even++;else counts.Odd++})
    const pair= config.subTradeType==='Over/Under'?['Over','Under']:config.subTradeType==='Matches/Differs'?['Matches','Differs']:['Even','Odd']
    const baseline=name=>config.subTradeType==='Over/Under'?(name==='Over'?(9-target)/10:target/10):config.subTradeType==='Matches/Differs'?(name==='Matches'?0.1:0.9):0.5
    const candidates=pair.map(name=>({name,p:counts[name]/digits.length,base:baseline(name)}))
    const chosen=option==='Both'?candidates.sort((x,y)=>(y.p-y.base)-(x.p-x.base))[0]:candidates.find(item=>item.name===option)
    if(chosen){option=chosen.name;score=Math.round(Math.max(0,Math.min(90,50+(chosen.p-chosen.base)*400)))}
    barrier=String(target);detail='Observed digit-frequency edge versus the contract baseline; heuristic setup score, not a calibrated win probability.'
  }else{
    const direction=drift>=0?'up':'down'
    if(option==='Both')option=config.tradeType==='Vanillas'?(direction==='up'?'Call':'Put'):config.tradeType==='Touch & No Touch'?(trend>0.35?'Touch':'No Touch'):config.subTradeType==='Higher/Lower'?(direction==='up'?'Higher':'Lower'):direction==='up'?'Rise':'Fall'
    const aligned=(direction==='up'?up:down)/deltas.length
    score=Math.round(Math.min(90,50+Math.max(0,aligned-0.5)*100+Math.min(15,trend*30)))
    if(['Higher/Lower'].includes(config.subTradeType)){option=option==='Rise'?'Higher':option==='Fall'?'Lower':option;const atr=mean(deltas.map(Math.abs));barrier=(direction==='up'?'+':'-')+Math.max(atr*2,Math.abs(prices.at(-1))*0.0001).toFixed(4)}
    if(config.tradeType==='Multipliers')option=direction==='up'?'Up':'Down'
    if(config.tradeType==='Turbos')option=direction==='up'?'Up':'Down'
    if(config.tradeType==='Touch & No Touch'){
      const atr=mean(deltas.map(Math.abs));barrier=(direction==='up'?'+':'-')+Math.max(atr*3,Math.abs(prices.at(-1))*0.0001).toFixed(4)
    }
    detail='Directional tick imbalance and drift; heuristic setup score, not a probability.'
  }
  if(config.tradeType==='Digits' && config.subTradeType==='Over/Under')option=option==='Both'?(freq.slice(0,5).reduce((a,b)=>a+b,0)>freq.slice(5).reduce((a,b)=>a+b,0)?'Over':'Under'):option
  if(config.tradeType==='Digits' && config.subTradeType==='Matches/Differs' && option==='Both')option=freq[target]>1?'Matches':'Differs'
  if(config.tradeType==='Digits' && config.subTradeType==='Even/Odd' && option==='Both')option=digits.filter(d=>d%2===0).length>=digits.length/2?'Even':'Odd'
  return {option,barrier,score,spot:prices.at(-1),detail,up,down,flat}
}

export default function AnalysisTool({isAnalyzing,setIsAnalyzing,progress,setProgress,aiLogs,setAiLogs,finalSignal,setFinalSignal,intervalRef,onSignalGenerated,token,accountId,currency='USD'}){
  const [tradeType,setTradeType]=useState('Digits'),[subTradeType,setSubTradeType]=useState('Over/Under'),[option,setOption]=useState('Over')
  const [predictedDigit,setPredictedDigit]=useState('5'),[analysisDuration,setAnalysisDuration]=useState(10),[lastDigits,setLastDigits]=useState(300)
  const [timeframeUnit,setTimeframeUnit]=useState('Ticks'),[durationValue,setDurationValue]=useState(5),[validationError,setValidationError]=useState('')
  const wsRef=useRef(null),pricesRef=useRef({}),lastTickAtRef=useRef({}),timerRef=useRef(null),activeRef=useRef(false),scanInFlightRef=useRef(false),lastEmittedSignalRef=useRef({}),proposalReqIdRef=useRef(920000),paperQuoteRequestsRef=useRef(new Map()),paperQuoteInFlightRef=useRef(new Set()),cycleStartedAtRef=useRef(0)
  const addLog=msg=>setAiLogs(prev=>[...prev.slice(-8),`[${new Date().toLocaleTimeString()}] ${msg}`])
  useEffect(()=>{if(SUB_TRADE_TYPES[tradeType]?.length)setSubTradeType(SUB_TRADE_TYPES[tradeType][0]);else setSubTradeType('')},[tradeType])
  useEffect(()=>{if(subTradeType&&OPTIONS[subTradeType])setOption(OPTIONS[subTradeType][0])},[subTradeType])
  useEffect(()=>{const r=TIMEFRAME_RULES[tradeType];setTimeframeUnit(r.defaultUnit);setDurationValue(r.min)},[tradeType])
  useEffect(()=>()=>{activeRef.current=false;clearInterval(timerRef.current);if(wsRef.current)wsRef.current.close()},[])
  const stopScanner=()=>{activeRef.current=false;clearInterval(timerRef.current);if(intervalRef.current)clearInterval(intervalRef.current);if(wsRef.current){wsRef.current.close();wsRef.current=null}setIsAnalyzing(false)}
  const handleStart=async()=>{
    setValidationError('')
    if(!token||!accountId){setValidationError('Connect a Deriv account before starting live market analysis.');return}
    if(tradeType==='Digits'&&(!Number.isInteger(Number(predictedDigit))||predictedDigit===''||Number(predictedDigit)<0||Number(predictedDigit)>9)){setValidationError('Enter a whole-number target digit from 0 to 9.');return}
    stopScanner();cycleStartedAtRef.current=Date.now();paperQuoteRequestsRef.current.clear();paperQuoteInFlightRef.current.clear();pricesRef.current={};lastTickAtRef.current={};resetPaperTrials();setIsAnalyzing(true);setProgress(0);setAiLogs([]);setFinalSignal(null);activeRef.current=true
    addLog('Connecting to authenticated Deriv market data...')
    try{
      const response=await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}})
      if(!response.ok)throw new Error(`Market-data authorization failed (${response.status}).`)
      const payload=await response.json(),url=payload.data?.url
      if(!url)throw new Error('Deriv did not return a market-data WebSocket URL.')
      const ws=new WebSocket(url);wsRef.current=ws
      ws.onopen=()=>{
        if(!activeRef.current)return
        ws.send(JSON.stringify({balance:1,req_id:900001}))
        MARKET_SYMBOLS.forEach((symbol,index)=>ws.send(JSON.stringify({ticks_history:symbol,count:Math.max(200,lastDigits),end:'latest',style:'ticks',subscribe:1,req_id:910000+index})))
        addLog('Historical windows requested; live tick subscriptions started across volatility markets.')
        let lastScanAt=0
        timerRef.current=setInterval(async()=>{
          const now=Date.now()
          const cycleMs=analysisDuration*1000
          const elapsed=now-cycleStartedAtRef.current
          if(elapsed>=cycleMs){cycleStartedAtRef.current=now;setProgress(0);addLog(`Analysis window completed (${analysisDuration}s); beginning the next rolling scan with refreshed market data.`)}
          else setProgress(Math.min(99,(elapsed/cycleMs)*100))
          if(now-lastScanAt<500||scanInFlightRef.current)return
          lastScanAt=now
          scanInFlightRef.current=true
          try {
            const config={tradeType,subTradeType,option,predictedDigit:Number(predictedDigit),duration:durationValue,timeframeUnit}
            const reports=await Promise.all(MARKET_SYMBOLS.map(async symbol=>{
              const fresh=now-(lastTickAtRef.current[symbol]||0)<5000
              if(!fresh)return {symbol,report:null,stale:true}
              const report=await evaluateStrategyEnsemble(pricesRef.current[symbol]||[],{...config,symbol,barrier:tradeType==='Digits'?String(predictedDigit):undefined})
              return {symbol,report,stale:false}
            }))
            const ready=reports.filter(item=>item.report?.ready)
            const candidates=ready.filter(item=>item.report.candidate).sort((a,b)=>b.report.candidate.score-a.report.candidate.score)
            const top=candidates.slice(0,4)
            if(!ready.length){
              addLog('Thamira: collecting fresh observations across all ${MARKET_SYMBOLS.length} markets; next scan continues immediately.')
              setFinalSignal({researchOnly:true,market:'Building live market picture',option:config.option,contractDuration:`${durationValue} ${timeframeUnit}`,sampleSize:reports.reduce((n,item)=>n+(item.report?.sampleSize||0),0),marketCount:0,detail:'Live feed remains active. Short recheck cycle; no forced entry.'})
            } else if(!top.length){
              addLog(`Thamira: monitoring ${ready.length}/${MARKET_SYMBOLS.length} fresh markets — no setup currently clears the relative-strength threshold. Rechecking in 0.5s.`)
              setFinalSignal({researchOnly:true,market:'Thamira monitoring all markets',option:config.option,contractDuration:`${durationValue} ${timeframeUnit}`,sampleSize:ready.reduce((n,item)=>n+item.report.sampleSize,0),marketCount:ready.length,detail:'No qualifying candidate at this instant. Continuous scanning remains active.'})
            } else {
              const best=top[0],label=VOLATILITY_MARKETS.find(([,sym])=>sym===best.symbol)?.[0]||best.symbol
              const candidate=best.report.candidate
              const nowSignal=Date.now()
              const series=pricesRef.current[best.symbol]||[]
              const deltas=series.slice(1).map((value,index)=>Math.abs(value-series[index])).filter(Number.isFinite)
              const atr=deltas.slice(-30).reduce((sum,value)=>sum+value,0)/Math.max(1,Math.min(30,deltas.length))
              let signalBarrier=tradeType==='Digits'?String(Number(predictedDigit)):''
              if(tradeType==='Touch & No Touch'||subTradeType==='Higher/Lower'){
                const down=['Fall','Lower','Down','Put','No Touch'].includes(candidate.option)
                const distance=Math.max(atr*(tradeType==='Touch & No Touch'?3:2),Math.abs(series.at(-1)||1)*0.0001)
                signalBarrier=(down?'-':'+')+distance.toFixed(4)
              }
              const signalKey=[best.symbol,tradeType,subTradeType,candidate.option,predictedDigit,signalBarrier].join('|')
              if(candidate.option!=='Both' && nowSignal-(lastEmittedSignalRef.current[signalKey]||0)>=2000){
                const signal={id:`analysis-${best.symbol}-${nowSignal}`,source:'analysis-tool-live',symbol:best.symbol,market:label,tradeType,subTradeType,option:candidate.option,predictedDigit:Number(predictedDigit),barrier:signalBarrier,duration:durationValue,timeframeUnit,createdAt:nowSignal,expiryEpoch:timeframeUnit==='Ticks'?undefined:Math.floor(nowSignal/1000)+Math.max(60,durationValue*(timeframeUnit==='Hours'?3600:timeframeUnit==='Days'?86400:timeframeUnit==='Minutes'?60:1)),setupScore:candidate.score,confidence:candidate.score,researchOnly:true}
                if(onSignalGenerated) onSignalGenerated(signal)
                lastEmittedSignalRef.current[signalKey]=nowSignal
                if (tradeType==='Digits' && timeframeUnit==='Ticks' && !paperQuoteInFlightRef.current.has(signalKey) && getPaperForwardSummary({...signal,currency}).pending===0) {
                  try {
                    const proposal=buildProposal({...signal,currency},1,currency)
                    const req_id=++proposalReqIdRef.current
                    paperQuoteRequestsRef.current.set(req_id,{signal:{...signal,currency},signalKey,label})
                    paperQuoteInFlightRef.current.add(signalKey)
                    ws.send(JSON.stringify({...proposal,req_id}))
                    setTimeout(()=>{const pendingRequest=paperQuoteRequestsRef.current.get(req_id);if(pendingRequest){paperQuoteRequestsRef.current.delete(req_id);paperQuoteInFlightRef.current.delete(pendingRequest.signalKey);addLog(`Paper proposal timed out for ${pendingRequest.label}; no sample recorded.`)}},12000)
                    addLog(`Requesting quote-matched paper sample: ${label} | ${candidate.option} | stake basis ${currency} 1.00; no purchase.`)
                  } catch(error) { paperQuoteInFlightRef.current.delete(signalKey); addLog(`Paper quote skipped: ${error.message}`) }
                }
                addLog(`Thamira signal handed to Denny Bots: ${label} | ${candidate.option} | score ${candidate.score}/94. Execution remains independently gated.`)
              }
              addLog(`Thamira: strongest candidate ${label} | setup score ${candidate.score}/94 | ${candidate.option}`)
              top.forEach(item=>{
                const market=VOLATILITY_MARKETS.find(([,sym])=>sym===item.symbol)?.[0]||item.symbol
                addLog(`${market}: ${item.report.candidate.score}/94 relative score; ${item.report.candidate.supportingFamilies.join(', ')}`)
              })
              setFinalSignal({researchOnly:true,market:label,option:best.report.candidate.option,contractDuration:`${durationValue} ${timeframeUnit}`,sampleSize:best.report.sampleSize,marketCount:candidates.length,score:best.report.candidate.score,detail:'Top-ranked live setup. Relative research score only, not a verified win probability; automated entry still requires independent calibration and payout validation.'})
            }
          } catch(error) { addLog(`Strategy research error: ${error.message}`) }
          finally { scanInFlightRef.current=false;setProgress(Math.min(99,((Date.now()-cycleStartedAtRef.current)/(analysisDuration*1000))*100)) }
        },250)
      }
      ws.onmessage=event=>{
        const msg=JSON.parse(event.data)
        const responseReqId=msg.echo_req?.req_id ?? msg.req_id
        if(msg.error){
          const failed=paperQuoteRequestsRef.current.get(responseReqId)
          if(failed){paperQuoteRequestsRef.current.delete(responseReqId);paperQuoteInFlightRef.current.delete(failed.signalKey);addLog(`Paper proposal unavailable for ${failed.label}: ${msg.error.message}`)}
          else addLog(`Deriv data error: ${msg.error.message}`)
          return
        }
        if(msg.msg_type==='proposal' && responseReqId!==undefined){
          const request=paperQuoteRequestsRef.current.get(responseReqId)
          if(request){
            paperQuoteRequestsRef.current.delete(responseReqId)
            const askPrice=Number(msg.proposal?.ask_price),payout=Number(msg.proposal?.payout)
            const quote={askPrice,payout,currency,quotedAt:Date.now()}
            if(beginPaperTrial(request.signal,{quote})){
              addLog(`Quote-matched paper trial started: ${request.label} | ${request.signal.option} | ask ${askPrice} ${currency} | payout ${payout} ${currency} | break-even ${(askPrice/payout*100).toFixed(1)}%; no funds purchased.`)
            } else addLog(`Paper sample not started: invalid proposal quote or matching trial already pending for ${request.label}.`)
            paperQuoteInFlightRef.current.delete(request.signalKey)
          }
        }
        if(msg.msg_type==='history'&&msg.history?.prices){const symbol=msg.echo_req?.ticks_history||msg.echo_req?.symbol||msg.history.symbol;pricesRef.current[symbol]=msg.history.prices.map(Number).filter(Number.isFinite);lastTickAtRef.current[symbol]=Date.now()}
        if(msg.msg_type==='tick'&&msg.tick?.symbol){const arr=pricesRef.current[msg.tick.symbol]||[];arr.push(Number(msg.tick.quote));pricesRef.current[msg.tick.symbol]=arr.slice(-Math.max(300,lastDigits));lastTickAtRef.current[msg.tick.symbol]=Date.now();const settled=advancePaperTrials(msg.tick.symbol,msg.tick.quote);settled.forEach(row=>{const summary=getPaperForwardSummary({symbol:row.symbol,tradeType:row.tradeType,subTradeType:row.subTradeType,option:row.option,predictedDigit:row.predictedDigit,barrier:row.barrier,duration:row.duration,timeframeUnit:row.timeframeUnit,currency:row.currency});addLog(`Paper result: ${row.symbol} | ${row.option} ${row.predictedDigit} | ${row.won?'WIN':'LOSS'} | terminal digit ${row.terminalDigit} | sample ${summary.trades} | Wilson 95% lower bound ${summary.lowerBound===null?'n/a':(summary.lowerBound*100).toFixed(1)+'%'} | worst quote break-even ${summary.maxBreakEvenRate===null?'n/a':(summary.maxBreakEvenRate*100).toFixed(1)+'%'} | calibrated ${summary.calibrated?'YES':'NO'}`)})}
      }
      ws.onerror=()=>{paperQuoteRequestsRef.current.clear();paperQuoteInFlightRef.current.clear();setValidationError('Live market-data connection failed.');stopScanner()}
      ws.onclose=()=>{paperQuoteRequestsRef.current.clear();paperQuoteInFlightRef.current.clear();if(activeRef.current){setValidationError('Live market-data feed disconnected. No signal was generated.');stopScanner()}}
    }catch(error){setValidationError(error.message);stopScanner()}
  }
  const handleStop=()=>{stopScanner();addLog('Live analysis stopped.')}
  const rules=TIMEFRAME_RULES[tradeType]
  return <div className="h-full overflow-y-auto bg-mwathe-black text-mwathe-white p-4 space-y-4">
    <div className="flex items-center gap-3 pb-2 border-b border-gray-800"><div className="w-10 h-10 bg-gradient-to-br from-mwathe-orange to-mwathe-green rounded-lg flex items-center justify-center"><Brain size={24}/></div><div><h2 className="text-xl font-bold">Analysis Tool</h2><p className="text-xs text-mwathe-gray flex items-center gap-1"><Cpu size={12}/> Live Deriv Market Scanner</p></div></div>
    {validationError&&<div className="bg-red-900/20 border border-red-500/50 rounded-xl p-3"><p className="text-red-400 text-xs">{validationError}</p></div>}
    <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 space-y-3">
      <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-mwathe-gray uppercase font-bold">Trade Type</label><select value={tradeType} onChange={e=>setTradeType(e.target.value)} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">{TRADE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>{SUB_TRADE_TYPES[tradeType]?.length>0&&<div><label className="text-[10px] text-mwathe-gray uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e=>setSubTradeType(e.target.value)} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">{SUB_TRADE_TYPES[tradeType].map(t=><option key={t}>{t}</option>)}</select></div>}</div>
      {subTradeType&&OPTIONS[subTradeType]&&<div><label className="text-[10px] text-mwathe-gray uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-2">{OPTIONS[subTradeType].map(opt=><button key={opt} onClick={()=>setOption(opt)} disabled={isAnalyzing} className={`py-1.5 rounded-lg text-xs font-bold border ${option===opt?'bg-mwathe-green/20 border-mwathe-green text-mwathe-green':'bg-mwathe-black border-gray-700 text-mwathe-gray'}`}>{opt}</button>)}</div></div>}
      <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-mwathe-gray uppercase font-bold">Contract Time Frame</label>{rules.fixed?<input value={rules.label} disabled className="w-full bg-mwathe-black/50 border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1"/>:<select value={timeframeUnit} onChange={e=>{setTimeframeUnit(e.target.value);setDurationValue(rules.min)}} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">{rules.units.map(u=><option key={u}>{u}</option>)}</select>}</div><div><label className="text-[10px] text-mwathe-gray uppercase font-bold">Duration</label><input type="number" value={durationValue} onChange={e=>setDurationValue(Number(e.target.value)||0)} disabled={isAnalyzing||rules.fixed} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1"/></div></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-mwathe-gray uppercase font-bold">Analysis Window: {analysisDuration}s</label><input type="range" min="10" max="59" value={analysisDuration} onChange={e=>setAnalysisDuration(Number(e.target.value))} disabled={isAnalyzing} className="w-full accent-mwathe-green mt-1"/></div>{tradeType==='Digits'&&<div><label className="text-[10px] text-mwathe-gray uppercase font-bold">History Ticks (200-500)</label><input type="number" min="200" max="500" value={lastDigits} onChange={e=>setLastDigits(Math.max(200,Math.min(500,Number(e.target.value))))} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1"/></div>}</div>
      {tradeType==='Digits'&&<div><label className="text-[10px] text-mwathe-gray uppercase font-bold">Target Digit (0-9)</label><input type="number" min="0" max="9" value={predictedDigit} onChange={e=>setPredictedDigit(e.target.value)} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1"/></div>}
    </div>
    {(isAnalyzing||progress>=100)&&<div className="rounded-xl p-3 border bg-mwathe-darkgray/50 border-mwathe-skyblue/30"><div className="flex items-center justify-between mb-2"><h3 className="text-xs font-bold flex items-center gap-1 text-mwathe-skyblue">{progress>=100?<><CheckCircle2 size={12}/> Scan complete</>:<><Activity size={12} className="animate-pulse"/> Scanning live markets...</>}</h3><span className="text-[10px] font-bold">{Math.round(progress)}%</span></div><div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-mwathe-orange to-mwathe-green" initial={{width:0}} animate={{width:`${progress}%`}}/></div></div>}
    {finalSignal&&<div className="rounded-xl p-3 border border-amber-500/40 bg-amber-500/10"><p className="font-bold text-sm">{finalSignal.market}</p><p className="text-xs text-mwathe-gray">{finalSignal.marketCount} candidate markets · {finalSignal.sampleSize} observations · {finalSignal.contractDuration}{finalSignal.score ? ` · Thamira score ${finalSignal.score}/94` : ''}</p><p className="text-[10px] text-amber-300 mt-1">{finalSignal.detail}</p></div>}
    <div className="bg-black rounded-xl border border-gray-800 overflow-hidden h-32 flex flex-col"><div className="bg-mwathe-darkgray px-3 py-1.5 flex items-center gap-2 border-b border-gray-800"><Zap size={12} className="text-mwathe-orange"/><span className="text-[10px] text-mwathe-orange font-bold">SYSTEM LOG</span></div><div className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5">{aiLogs.length===0?<p className="text-gray-600">Waiting for live analysis...</p>:aiLogs.map((log,i)=><p key={i} className="text-mwathe-skyblue">{log}</p>)}</div></div>
    <div className="grid grid-cols-2 gap-3 pt-2"><button onClick={handleStart} disabled={isAnalyzing} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${isAnalyzing?'bg-gray-800 text-gray-500':'bg-mwathe-green text-black'}`}><Play size={16}/> Start</button><button onClick={handleStop} disabled={!isAnalyzing} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${!isAnalyzing?'bg-gray-800 text-gray-500':'bg-red-500 text-white'}`}><Square size={16}/> Stop</button></div>
  </div>
}
