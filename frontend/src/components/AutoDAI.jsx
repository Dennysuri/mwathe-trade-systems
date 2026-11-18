import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity, Lock } from 'lucide-react'
import { boundedNextStake, buildProposal, MARKET_SYMBOLS } from '../services/tradingCore'
import { evaluateStrategyEnsemble, validateEntryWindow } from '../services/strategyIntelligence'

const VOLATILITY_INDICES = ['Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index', 'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index']
const SYMBOL_MAP = { 'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10', 'Volatility 15 (1s) Index': 'R_15', 'Volatility 25 (1s) Index': 'R_25', 'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30', 'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50', 'Volatility 75 (1s) Index': 'R_75', 'Volatility 75 Index': 'R_75', 'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100', 'Volatility 100 Index': 'R_100' }
const TRADE_TYPES = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'], 'Multipliers': ['Multipliers'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Turbos': ['Up', 'Down', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks' }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto' }, 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false } }

const getQuoteDigit = value => { const text=String(value); const decimals=text.includes('.')?text.split('.')[1]:''; return Number((decimals||text).slice(-1)) }
const MARKET_LABEL_BY_SYMBOL = Object.fromEntries(Object.entries(SYMBOL_MAP).map(([label,symbol])=>[symbol,label]))

export default function AutoDAI({ token, accountId, onBalanceUpdate }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [selectedMarket, setSelectedMarket] = useState('Volatility 100 (1s) Index')
  const [tradeType, setTradeType] = useState('Digits')
  const [subTradeType, setSubTradeType] = useState('Over/Under')
  const [option, setOption] = useState('Over')
  const [timeframeUnit, setTimeframeUnit] = useState('Ticks')
  const [durationValue, setDurationValue] = useState(1)
  const [stake, setStake] = useState('0.35')
  const [targetProfit, setTargetProfit] = useState('20.00')
  const [stopLoss, setStopLoss] = useState('10.00')
  const martingaleFactor = 1.5
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(['AI Core initialized.'])
  const [currentPL, setCurrentPL] = useState(0.00)
  const [totalTrades, setTotalTrades] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currentStake, setCurrentStake] = useState(0.35)
  const [consecutiveLosses, setConsecutiveLosses] = useState(0)
  const [ws, setWs] = useState(null)
  const [currentContract, setCurrentContract] = useState(null)

  const logRef = useRef(null)
  const nextTradeTimer = useRef(null)
  const isRunningRef = useRef(false)
  const wsRef = useRef(null)
  const tickHistoryRef = useRef({})
  const pendingProposalRef = useRef(null)
  const pendingEntryRef = useRef(null)
  const sessionRef = useRef({totalTrades:0,wins:0,losses:0,lossStreak:0,stake:0.35,pl:0})
  const configRef = useRef({stake,targetProfit,stopLoss})
  configRef.current = {stake,targetProfit,stopLoss,selectedMarket,tradeType,subTradeType,option,timeframeUnit,durationValue}


  const addLog = (msg) => setLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { const rules = TIMEFRAME_RULES[tradeType]; setTimeframeUnit(rules.defaultUnit); setDurationValue(rules.min) }, [tradeType])
  useEffect(() => { if (!isRunning) setCurrentStake(parseFloat(stake) || 0.35) }, [stake, isRunning])

  const handleLogin = async () => { setPasswordError(''); try { const response = await fetch('/api/autod-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const result = await response.json(); if (!response.ok || !result.authenticated) throw new Error(result.error || 'Authentication failed'); setIsAuthenticated(true); setPassword('') } catch (error) { setPasswordError(error.message || 'Authentication failed') } }

  useEffect(() => {
    if (!isAuthenticated || !token || !accountId) return
    const connectWS = async () => {
      try {
        const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        const data = await response.json()
        const wsUrl = data.data?.url
        if (!wsUrl) throw new Error('No WebSocket URL')
        const websocket = new WebSocket(wsUrl)
        wsRef.current = websocket
        websocket.onopen = () => { addLog('✅ AI Connected to Deriv'); websocket.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 1 })) }
        websocket.onmessage = (message) => {
          try {
            const msg = JSON.parse(message.data)
            if (msg.msg_type === 'balance' && onBalanceUpdate) onBalanceUpdate(parseFloat(msg.balance.balance))
            if (msg.msg_type === 'history' && msg.history?.prices) { const symbol = msg.echo_req?.ticks_history || msg.history.symbol; if (symbol) tickHistoryRef.current[symbol] = msg.history.prices.map(Number).filter(Number.isFinite).slice(-500) }
            if (msg.msg_type === 'tick' && msg.tick?.quote !== undefined) { const symbol = msg.tick.symbol; const current = tickHistoryRef.current[symbol] || []; tickHistoryRef.current[symbol] = [...current, Number(msg.tick.quote)].slice(-500) }
            if (msg.msg_type === 'contracts_for' && pendingProposalRef.current?.reqId === msg.req_id) {
              const pending = pendingProposalRef.current; pendingProposalRef.current = null
              if (msg.error || !JSON.stringify(msg.contracts_for || {}).includes(pending.proposal.contract_type)) addLog('⛔ Deriv does not offer this contract for the selected market. No trade sent.')
              else websocket.send(JSON.stringify({...pending.proposal,req_id:Date.now()}))
            }
            if (msg.msg_type === 'proposal') { if (msg.error) { addLog(`❌ Proposal failed: ${msg.error.message || 'Deriv rejected the proposal'}`); if (isRunningRef.current) nextTradeTimer.current=setTimeout(()=>executeTrade(),3000) } else setTimeout(() => { const gate=validateEntryWindow(pendingEntryRef.current,{maxSignalAgeMs:15000,proposalBudgetMs:300,minimumRemainingMs:250}); if(!gate.valid){addLog(`⛔ Entry expired before purchase: ${gate.reason}`);pendingEntryRef.current=null;if(isRunningRef.current)nextTradeTimer.current=setTimeout(()=>executeTrade(),1500);return} websocket.send(JSON.stringify({ buy: msg.proposal.id, price: msg.proposal.ask_price, req_id: Date.now() })) }, 200) }
            if (msg.msg_type === 'buy') { if (msg.error) { addLog(`❌ Buy failed: ${msg.error.message || 'Deriv rejected the purchase'}`); setCurrentContract(null); if (isRunningRef.current) nextTradeTimer.current=setTimeout(()=>executeTrade(),3000) } else { setCurrentContract({ id: msg.buy.contract_id }); addLog(`✅ Contract: ${msg.buy.contract_id}`); websocket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: msg.buy.contract_id, subscribe: 1, req_id: Date.now() })) } }
            if (msg.msg_type === 'proposal_open_contract') { if (!msg.error && msg.proposal_open_contract) { const contract = msg.proposal_open_contract; if (contract.is_sold) { handleContractResult(parseFloat(contract.profit)); setCurrentContract(null) } else setCurrentPL(parseFloat(contract.profit || 0)) } }
          } catch (e) { console.error(e) }
        }
        websocket.onerror = () => addLog('❌ WS Error')
        websocket.onclose = () => addLog('🔌 Disconnected')
        setWs(websocket)
      } catch (err) { addLog(`❌ Connection failed`) }
    }
    connectWS()
    return () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null } }
  }, [isAuthenticated, token, accountId])

  const executeTrade = async () => {
    const socket = wsRef.current
    const config = configRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !isRunningRef.current) return
    const candidates = MARKET_SYMBOLS.map(symbol => {
      const series = tickHistoryRef.current[symbol] || []
      if (series.length < 40) return null
      const sample = series.slice(-20), moves = sample.slice(1).map((v,i)=>v-sample[i]), driftValue = series.at(-1)-series.at(-16)
      const volatility = moves.reduce((sum,v)=>sum+Math.abs(v),0)/(moves.length||1)
      return volatility>0 ? {symbol,ticks:series,drift:driftValue,atr:volatility,score:config.tradeType==='Accumulators'?Math.abs(series.at(-1))/(volatility||1):Math.abs(driftValue)/volatility} : null
    }).filter(item=>item && item.score>=(config.tradeType==='Accumulators'?50:3)).sort((a,b)=>b.score-a.score)
    if (!candidates.length) { addLog('⏳ Scanning live markets; no eligible setup yet.'); nextTradeTimer.current=setTimeout(()=>executeTrade(),500); return }
    const best = candidates[0]
    const ticks = best.ticks, atr = best.atr, drift = best.drift, symbol = best.symbol
    setSelectedMarket(MARKET_LABEL_BY_SYMBOL[symbol] || symbol)
    const direction = drift > 0 ? 'up' : 'down'
    let selectedOption = config.option
    if (selectedOption === 'Both') {
      selectedOption = config.tradeType === 'Vanillas' ? (direction==='up'?'Call':'Put')
        : config.tradeType === 'Touch & No Touch' ? 'Touch'
        : config.tradeType === 'Multipliers' || config.tradeType === 'Turbos' ? (direction==='up'?'Up':'Down')
        : config.subTradeType === 'Higher/Lower' ? (direction==='up'?'Higher':'Lower')
        : config.tradeType === 'Digits' ? (config.subTradeType === 'Over/Under' ? (direction==='up'?'Over':'Under') : config.subTradeType === 'Matches/Differs' ? 'Differs' : (getQuoteDigit(ticks.at(-1))%2===0?'Even':'Odd'))
        : config.subTradeType === 'Even/Odd' ? 'Even' : config.subTradeType === 'Matches/Differs' ? 'Differs'
        : direction==='up'?'Rise':'Fall'
    }
    if (config.tradeType === 'Digits') {
      const digits = ticks.slice(-120).map(getQuoteDigit), previous = digits.at(-1)
      const transitions = digits.slice(0,-1).reduce((out,d,i)=>{if(d===previous)out.push(digits[i+1]);return out},[])
      if (transitions.length < 10) { addLog('Insufficient conditional digit history; no trade.'); nextTradeTimer.current=setTimeout(()=>executeTrade(),500); return }
      const rate = predicate => (transitions.filter(predicate).length+1)/(transitions.length+2)
      const target = 3
      const candidates = config.subTradeType==='Over/Under'?[{name:'Over',p:rate(d=>d>2),base:0.7},{name:'Under',p:rate(d=>d<8),base:0.8}]
        :config.subTradeType==='Matches/Differs'?[{name:'Matches',p:rate(d=>d===target),base:0.1},{name:'Differs',p:rate(d=>d!==target),base:0.9}]
        :[{name:'Even',p:rate(d=>d%2===0),base:0.5},{name:'Odd',p:rate(d=>d%2===1),base:0.5}]
      const chosen=config.option==='Both'?candidates.sort((a,b)=>(b.p-b.base)-(a.p-a.base))[0]:candidates.find(item=>item.name===selectedOption)
      if(!chosen || chosen.p-chosen.base<0.04){addLog('Digit edge did not exceed the minimum threshold; no trade.');nextTradeTimer.current=setTimeout(()=>executeTrade(),500);return}
      selectedOption=chosen.name
    }
    const isDown = ['Fall','Lower','Down','Put','No Touch','Under','Odd','Differs'].includes(selectedOption)
    if (config.tradeType !== 'Digits' && config.tradeType !== 'Accumulators' && config.tradeType !== 'Touch & No Touch' && ((direction==='up' && isDown) || (direction==='down' && !isDown))) {
      addLog('Selected direction conflicts with current tick trend; no trade sent.')
      nextTradeTimer.current = setTimeout(() => executeTrade(), 500)
      return
    }

    const barrier = config.tradeType === 'Digits' ? (config.subTradeType==='Over/Under'?(selectedOption==='Over'?'2':'8'):config.subTradeType==='Matches/Differs'?'3':'')
      : (config.tradeType==='Touch & No Touch'||config.subTradeType==='Higher/Lower') ? ((config.tradeType==='Touch & No Touch'?direction==='down':isDown)?'-':'+')+Math.max(atr*(config.tradeType==='Touch & No Touch'?3:2),Math.abs(ticks.at(-1))*0.0001).toFixed(4) : ''
    try {
      const signal = {symbol,tradeType:config.tradeType,subTradeType:config.subTradeType,option:selectedOption,predictedDigit:selectedOption==='Over'?2:selectedOption==='Under'?8:3,barrier,duration:config.durationValue,timeframeUnit:config.timeframeUnit,createdAt:Date.now(),expiryEpoch:Math.floor(Date.now()/1000)+Math.max(60,config.durationValue*(config.timeframeUnit==='Hours'?3600:config.timeframeUnit==='Days'?86400:config.timeframeUnit==='Minutes'?60:1)),growthRate:0.01,multiplier:100,takeProfit:1,contractStopLoss:1}
      const researchReport = await evaluateStrategyEnsemble(ticks, signal)
      if (!researchReport.ready || !researchReport.tradable) { const candidate=researchReport.candidate; if(candidate) addLog(`Thamira candidate: ${candidate.option} | relative score ${candidate.score}/94. Execution remains gated pending independent calibration and payout validation.`); nextTradeTimer.current = setTimeout(() => executeTrade(), 500); return }
      const proposal = buildProposal(signal,sessionRef.current.stake)
      const reqId = Date.now()
      pendingProposalRef.current = {proposal,reqId}; pendingEntryRef.current = signal
      addLog(`🔎 Live setup ${selectedOption}; validating ${proposal.contract_type} with Deriv.`)
      socket.send(JSON.stringify({contracts_for:symbol,currency:'USD',req_id:reqId}))
    } catch (error) { addLog(`⛔ ${error.message}`); nextTradeTimer.current = setTimeout(() => executeTrade(), 3000) }
  }

  const handleContractResult = (profit) => {
    const session = sessionRef.current
    const config = configRef.current
    session.totalTrades += 1
    if (profit > 0) {
      session.wins += 1; session.lossStreak = 0; session.stake = parseFloat(config.stake) || 0.35
      addLog(`✅ AI WON +$${profit.toFixed(2)}`)
    } else {
      session.losses += 1; session.lossStreak += 1
      session.stake = boundedNextStake(config.stake,session.stake,martingaleFactor,session.lossStreak)
      addLog(`❌ AI LOST -$${profit.toFixed(2)} | Bounded stake $${session.stake.toFixed(2)}`)
    }
    session.pl += profit
    setTotalTrades(session.totalTrades);setWins(session.wins);setLosses(session.losses);setConsecutiveLosses(session.lossStreak);setCurrentStake(session.stake);setCurrentPL(session.pl)
    if (session.pl >= parseFloat(config.targetProfit)) { addLog(`🎯 Target hit! $${session.pl.toFixed(2)}`); setIsRunning(false); isRunningRef.current=false; return }
    if (session.pl <= -parseFloat(config.stopLoss)) { addLog(`🛑 Stop loss $${session.pl.toFixed(2)}`); setIsRunning(false); isRunningRef.current=false; return }
    if (session.lossStreak >= 2) { addLog('🛑 Recovery cap reached after two consecutive losses. Stopping AI.'); setIsRunning(false); isRunningRef.current=false; return }
    if (isRunningRef.current) { addLog(`P/L: $${session.pl.toFixed(2)} | Trades: ${session.totalTrades}`); nextTradeTimer.current=setTimeout(()=>executeTrade(),500) }
  }

  const startBot = () => { setValidationError(''); if (!ws || ws.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }; if (nextTradeTimer.current) clearTimeout(nextTradeTimer.current); setIsRunning(true); isRunningRef.current = true; setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setCurrentStake(parseFloat(stake)); setConsecutiveLosses(0); sessionRef.current={totalTrades:0,wins:0,losses:0,lossStreak:0,stake:parseFloat(stake),pl:0}; setLogs([]); addLog(` AutoD AI Started`); addLog('Market: autonomous scan across volatility indices'); addLog(`Target: $${targetProfit} | Stop: $${stopLoss}`); tickHistoryRef.current={}; MARKET_SYMBOLS.forEach((symbol,index)=>ws.send(JSON.stringify({ ticks_history: symbol, count: 200, end: 'latest', style: 'ticks', subscribe: 1, req_id: Date.now()+index }))); nextTradeTimer.current = setTimeout(() => { if (isRunningRef.current) executeTrade() }, 3000) }
  const stopBot = () => { setIsRunning(false); isRunningRef.current = false; if (nextTradeTimer.current) { clearTimeout(nextTradeTimer.current); nextTradeTimer.current = null }; addLog(`⏹️ AI stopped new entries; any open contract remains monitored until settlement.`) }
  const resetBot = () => { stopBot(); setLogs(['AI reset.']); setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setConsecutiveLosses(0); setCurrentStake(parseFloat(stake)); setValidationError(''); setCurrentContract(null) }
  const rules = TIMEFRAME_RULES[tradeType]; const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'
  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950 p-4">
        <div className="bg-gray-900 rounded-xl p-6 border border-orange-500/30 w-full max-w-sm">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="text-orange-500" size={32} /></div>
          <h2 className="text-xl font-bold text-white mb-2 text-center">AutoD AI Security</h2>
          <p className="text-gray-400 text-sm mb-6 text-center">Enter password to access AI core.</p>
          <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setPasswordError('') }} className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-lg mb-3 focus:border-orange-500 outline-none" placeholder="Enter Password" />
          {passwordError && <p className="text-red-500 text-sm mb-3 text-center">{passwordError}</p>}
          <button onClick={handleLogin} className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-green-500 text-white font-bold">Unlock AI</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0"><div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-green-500 rounded-lg flex items-center justify-center"><Activity size={16} className="text-white" /></div><div><h2 className="text-base font-bold text-white">AutoD AI</h2><p className="text-[10px] text-gray-400 flex items-center gap-1"><ShieldCheck size={10} /> Risk-Limited Trading</p></div></div>
      {validationError && <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0"><AlertCircle size={12} className="text-red-500" /><p className="text-red-400 text-[10px] font-medium">{validationError}</p></div>}
      <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-orange-500" /> Parameters</h3>
        <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Market (Auto-selected)</label><select value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)} disabled className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{VOLATILITY_INDICES.map(m => <option key={m} className="text-white">{m}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Type</label><select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{TRADE_TYPES.map(t => <option key={t} className="text-white">{t}</option>)}</select></div>{SUB_TRADE_TYPES[tradeType]?.length > 0 && <div><label className="text-[10px] text-gray-400 uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{SUB_TRADE_TYPES[tradeType].map(t => <option key={t} className="text-white">{t}</option>)}</select></div>}</div>
        {subTradeType && OPTIONS[subTradeType] && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-1">{OPTIONS[subTradeType].map(opt => <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-gray-700 text-gray-400'}`}>{opt}</button>)}</div></div>}
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Time</label>{rules.fixed ? <input type="text" value={rules.label} disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-gray-500" /> : <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{rules.units.map(u => <option key={u} className="text-white">{u}</option>)}</select>}</div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Duration</label><input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || rules.fixed} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stake</label><input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Martingale</label><input type="text" value="1.5 (Fixed)" disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-orange-400" /></div></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Target</label><input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stop Loss</label><input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
      </div>
      <div className="bg-gray-900 rounded-lg p-2 border border-green-500/30 mb-2 flex-shrink-0"><h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-500" /> Performance</h3><div className="grid grid-cols-4 gap-1 text-center"><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">P/L</p><p className={`font-bold text-xs ${currentPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Win Rate</p><p className="text-sky-400 font-bold text-xs">{winRate}%</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Trades</p><p className="text-white font-bold text-xs">{totalTrades}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Next</p><p className="text-orange-400 font-bold text-xs">{currentStake.toFixed(2)}</p></div></div></div>
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2"><button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-black'}`}><Play size={14} /> Run</button><button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}><Square size={14} /> Stop</button><button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-gray-800 border border-gray-700 text-orange-400"><RefreshCw size={14} /> Reset</button></div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col"><div className="bg-gray-900 px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">AI LOG</span></div><div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5">{logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') ? 'text-red-500' : log.includes('🤖') || log.includes('🚀') ? 'text-sky-400' : 'text-gray-400'}>{log}</p>)}</div></div>
    </div>
  )
}
