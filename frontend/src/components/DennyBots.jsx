import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, Activity } from 'lucide-react'
import { buildProposal, isFreshSignal, boundedNextStake } from '../services/tradingCore'

const VOLATILITY_INDICES = ['Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index', 'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index']
const SYMBOL_MAP = { 'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10', 'Volatility 15 (1s) Index': 'R_15', 'Volatility 25 (1s) Index': 'R_25', 'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30', 'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50', 'Volatility 75 (1s) Index': 'R_75', 'Volatility 75 Index': 'R_75', 'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100', 'Volatility 100 Index': 'R_100' }
const TRADE_TYPES = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'], 'Multipliers': ['Multipliers'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Turbos': ['Up', 'Down', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks' }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto' }, 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false } }

const roundStake = (value) => Math.round(value * 100) / 100

const getQuoteDigit = value => { const text=String(value); const decimals=text.includes('.')?text.split('.')[1]:''; return Number((decimals||text).slice(-1)) }
const analyzeDigitTrade = (tickHistory, predictedDigit, option, subTradeType) => {
  if (tickHistory.length < 50) return { confidence: 0, signal: null, reasons: ['Gathering at least 50 live ticks.'] }
  const digits = tickHistory.map(getQuoteDigit)
  const target = Math.max(0,Math.min(9,parseInt(predictedDigit,10)||0))
  const previous = digits.at(-1)
  const transitions = digits.slice(0,-1).reduce((out,d,i)=>{if(d===previous)out.push(digits[i+1]);return out},[])
  if (transitions.length < 8) return { confidence: 0, signal: null, reasons: ['Insufficient repeated-state transitions.'] }
  const rate = predicate => (transitions.filter(predicate).length+1)/(transitions.length+2)
  let choices
  if (subTradeType==='Over/Under') choices=[{name:'Over',p:rate(d=>d>target),base:(9-target)/10},{name:'Under',p:rate(d=>d<target),base:target/10}]
  else if (subTradeType==='Matches/Differs') choices=[{name:'Matches',p:rate(d=>d===target),base:0.1},{name:'Differs',p:rate(d=>d!==target),base:0.9}]
  else choices=[{name:'Even',p:rate(d=>d%2===0),base:0.5},{name:'Odd',p:rate(d=>d%2===1),base:0.5}]
  const chosen=option==='Both'?choices.sort((x,y)=>(y.p-y.base)-(x.p-x.base))[0]:choices.find(x=>x.name===option)
  if(!chosen)return {confidence:0,signal:null,reasons:['Unsupported digit option.']}
  const edge=chosen.p-chosen.base
  const confidence=Math.max(0,Math.min(90,Math.round(50+edge*400)))
  return {confidence,signal:chosen.name,reasons:[`Observed conditional rate ${(chosen.p*100).toFixed(1)}% vs baseline ${(chosen.base*100).toFixed(1)}% over ${transitions.length} matching transitions.`]}
}

const analyzePriceTrade = (tickHistory) => {
  if (tickHistory.length < 20) return { confidence: 10, signal: 'CALL', reasons: ['Gathering data...'] }
  const ticks = tickHistory
  const recent = ticks.slice(-20)
  const upCount = recent.filter((t, i, arr) => i > 0 && t > arr[i-1]).length
  const trendConf = (upCount / 19) * 100
  const momentum = ticks[ticks.length - 1] - ticks[ticks.length - 10]
  
  let confidence = 30
  let reasons = []
  if (trendConf > 60) { confidence += 30; reasons.push('Strong uptrend') }
  else if (trendConf < 40) { confidence += 30; reasons.push('Strong downtrend') }
  if (momentum > 0) { confidence += 20; reasons.push('Positive momentum') }
  else { confidence += 20; reasons.push('Negative momentum') }
  
  const signal = trendConf > 50 ? 'CALL' : 'PUT'
  return { confidence: Math.min(confidence, 99), signal, reasons }
}

export default function DennyBots({ token, accountId, currency = 'USD', onBalanceUpdate, signals = [] }) {
  const [connectedMode, setConnectedMode] = useState(false)
  const [selectedMarket, setSelectedMarket] = useState('Volatility 100 (1s) Index')
  const [tradeType, setTradeType] = useState('Digits')
  const [subTradeType, setSubTradeType] = useState('Over/Under')
  const [option, setOption] = useState('Over')
  const [predictedDigit, setPredictedDigit] = useState('3')
  const [timeframeUnit, setTimeframeUnit] = useState('Ticks')
  const [durationValue, setDurationValue] = useState(1)
  const [stake, setStake] = useState('1.00')
  const [targetProfit, setTargetProfit] = useState('50.00')
  const [stopLoss, setStopLoss] = useState('20.00')
  const [martingaleFactor, setMartingaleFactor] = useState('1.5')
  const [minConfidence, setMinConfidence] = useState('70')
  
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(['System initialized.'])
  const [currentPL, setCurrentPL] = useState(0.00)
  const [totalTrades, setTotalTrades] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currentStake, setCurrentStake] = useState(1.00)
  const [consecutiveLosses, setConsecutiveLosses] = useState(0)
  const [confidenceScore, setConfidenceScore] = useState(0)
  
  const logRef = useRef(null)
  const wsRef = useRef(null)
  const isRunningRef = useRef(false)
  const reqIdRef = useRef(1)
  const tickHistoryRef = useRef([])
  const tickSubscriptionRef = useRef(null)
  const currentStakeRef = useRef(1.00)
  const sessionPLRef = useRef(0.00)
  const totalTradesRef = useRef(0)
  const winsRef = useRef(0)
  const lossesRef = useRef(0)
  const consecutiveLossesRef = useRef(0)
  const signalsRef = useRef(signals)
  const consumedSignalsRef = useRef(new Set())
  useEffect(() => { signalsRef.current = signals }, [signals])

  const addLog = (msg, silent = false) => {
    if (silent) return
    setLogs(prev => [...prev.slice(-40), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { const rules = TIMEFRAME_RULES[tradeType]; setTimeframeUnit(rules.defaultUnit); setDurationValue(rules.min) }, [tradeType])
  useEffect(() => { if (!isRunning) { const s = parseFloat(stake) || 1.00; setCurrentStake(s); currentStakeRef.current = s } }, [stake, isRunning])

  useEffect(() => {
    if (!token || !accountId) return
    const connectWS = async () => {
      try {
        const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        const data = await response.json()
        const wsUrl = data.data?.url
        if (!wsUrl) throw new Error('No WebSocket URL')
        if (wsRef.current) wsRef.current.close()
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        ws.onopen = () => { 
          addLog('✅ Connected to Deriv API')
          ws.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: reqIdRef.current++ }))
          ws.send(JSON.stringify({ ticks_history: SYMBOL_MAP[selectedMarket], count: 200, end: 'latest', style: 'ticks', subscribe: 1, req_id: reqIdRef.current++ }))
        }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.msg_type === 'history' && msg.history?.prices) { tickHistoryRef.current = msg.history.prices.map(Number).filter(Number.isFinite).slice(-500); if (msg.subscription?.id) tickSubscriptionRef.current = msg.subscription.id }
            if (msg.msg_type === 'tick') tickHistoryRef.current = [...tickHistoryRef.current, Number(msg.tick.quote)].slice(-500)
            if (msg.msg_type === 'balance' && onBalanceUpdate) onBalanceUpdate(parseFloat(msg.balance.balance))
          } catch (e) {}
        }
        ws.onerror = () => addLog('❌ WS Error')
        ws.onclose = () => addLog('🔌 Disconnected')
      } catch (err) { addLog(` Connection failed`) }
    }
    connectWS()
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [token, accountId])

  const wsRequest = (request) => {
    return new Promise((resolve, reject) => {
      const socket = wsRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return reject(new Error('Deriv connection is not ready. Reconnect your account and try again.'))
      const req_id = reqIdRef.current++
      const requestWithId = { ...request, req_id }
      let timeoutId
      const cleanup = () => { socket.removeEventListener('message', onMessage); if (timeoutId) clearTimeout(timeoutId) }
      const onMessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.req_id !== req_id) return
          cleanup()
          if (msg.error) reject(new Error(`${msg.error.message || 'Deriv API error'}${msg.error.code ? ` (${msg.error.code})` : ''}`))
          else resolve(msg)
        } catch (error) { if (error instanceof SyntaxError) return; cleanup(); reject(error) }
      }
      socket.addEventListener('message', onMessage)
      try { socket.send(JSON.stringify(requestWithId)) }
      catch (error) { cleanup(); reject(error); return }
      timeoutId = setTimeout(() => { cleanup(); reject(new Error(`Deriv request timed out (${request.msg_type || Object.keys(request).find(key => request[key] === 1) || 'request'}).`)) }, 15000)
    })
  }

  const monitorContract = (contract_id) => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve(null)
      let sub_id = null
      const onMessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract?.contract_id === contract_id) {
            if (msg.subscription?.id) sub_id = msg.subscription.id
            if (msg.proposal_open_contract.is_sold) {
              wsRef.current.removeEventListener('message', onMessage)
              if (sub_id) wsRef.current.send(JSON.stringify({ forget: sub_id, req_id: reqIdRef.current++ }))
              resolve(msg.proposal_open_contract)
            } else setCurrentPL(parseFloat(msg.proposal_open_contract.profit || 0))
          }
        } catch (e) {}
      }
      wsRef.current.addEventListener('message', onMessage)
      wsRef.current.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contract_id, subscribe: 1, req_id: reqIdRef.current++ }))
    })
  }

  useEffect(() => {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    if (tickSubscriptionRef.current) socket.send(JSON.stringify({ forget: tickSubscriptionRef.current, req_id: reqIdRef.current++ }))
    tickSubscriptionRef.current = null
    tickHistoryRef.current = []
    socket.send(JSON.stringify({ ticks_history: SYMBOL_MAP[selectedMarket], count: 200, end: 'latest', style: 'ticks', subscribe: 1, req_id: reqIdRef.current++ }))
  }, [selectedMarket])

  const getContractType = () => {
    if (tradeType === 'Digits') {
      if (subTradeType === 'Over/Under') return option === 'Over' ? 'DIGITOVER' : 'DIGITUNDER'
      if (subTradeType === 'Even/Odd') return option === 'Even' ? 'DIGITEVEN' : 'DIGITODD'
      return 'DIGITDIFF'
    }
    if (tradeType === 'Ups & Downs') return option === 'Rise' || option === 'Higher' ? 'CALL' : 'PUT'
    return 'CALL'
  }

  const runTradeCycle = async () => {
    while (isRunningRef.current) {
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          await new Promise(r => setTimeout(r, 2000))
          continue
        }

        // Load initial data if empty
        if (tickHistoryRef.current.length < 20) {
          addLog('📡 Gathering market data...', true)
          const symbol = SYMBOL_MAP[selectedMarket]
          await wsRequest({ ticks_history: symbol, count: 50, end: 'latest', style: 'ticks' })
          await new Promise(r => setTimeout(r, 2000))
        }

        let independentOption = option
        if (!connectedMode) {
          addLog('🔬 Analyzing market setup...')
          let analysis

          if (tradeType === 'Digits') {
            analysis = analyzeDigitTrade(tickHistoryRef.current, predictedDigit, option, subTradeType)
          } else {
            analysis = analyzePriceTrade(tickHistoryRef.current)
          }

          if (option === 'Both') {
            if (tradeType === 'Digits') independentOption = analysis.signal
            else if (tradeType === 'Ups & Downs') independentOption = subTradeType === 'Higher/Lower' ? (analysis.signal === 'CALL' ? 'Higher' : 'Lower') : (analysis.signal === 'CALL' ? 'Rise' : 'Fall')
            else if (tradeType === 'Vanillas') independentOption = analysis.signal === 'CALL' ? 'Call' : 'Put'
            else if (tradeType === 'Multipliers' || tradeType === 'Turbos') independentOption = analysis.signal === 'CALL' ? 'Up' : 'Down'
            else if (tradeType === 'Touch & No Touch') independentOption = analysis.confidence >= 70 ? 'Touch' : 'No Touch'
          }

          setConfidenceScore(analysis.confidence)
          addLog(`📊 Setup score: ${analysis.confidence}/100 | Signals: ${analysis.reasons.join(', ')}`)

          const minConf = parseFloat(minConfidence) || 70
          let waitTime = 0

          // Wait silently for up to 20 seconds for a better setup
          while (analysis.confidence < minConf && waitTime < 20000 && isRunningRef.current) {
            addLog(`⏳ Waiting for stronger setup... (${analysis.confidence}%)`, true)
            await new Promise(r => setTimeout(r, 5000))
            waitTime += 5000

            if (tradeType === 'Digits') analysis = analyzeDigitTrade(tickHistoryRef.current, predictedDigit, option, subTradeType)
            else analysis = analyzePriceTrade(tickHistoryRef.current)
            setConfidenceScore(analysis.confidence)
          }

          if (analysis.confidence < minConf) {
            addLog(`⏸️ Setup score ${analysis.confidence} below threshold ${minConf}. No trade.`)
            await new Promise(r => setTimeout(r, 1500))
            continue
          }

          addLog('Setup threshold met. Checking contract availability...')
        } else {
          addLog('Waiting for a fresh Analysis Tool signal...', true)
        }

        let proposalReq
        if (connectedMode) {
          const signal = [...signalsRef.current].find(item => isFreshSignal(item) && !consumedSignalsRef.current.has(item.id))
          if (!signal) { await new Promise(r => setTimeout(r, 1000)); continue }
          consumedSignalsRef.current.add(signal.id)
          const market = VOLATILITY_INDICES.find(name => SYMBOL_MAP[name] === signal.symbol)
          if (!market) { addLog('Rejected signal: unsupported market.'); continue }
          setSelectedMarket(market); setTradeType(signal.tradeType); setSubTradeType(signal.subTradeType || ''); setOption(signal.option); setPredictedDigit(String(signal.predictedDigit ?? predictedDigit)); setDurationValue(Number(signal.duration || durationValue)); setTimeframeUnit(signal.timeframeUnit || timeframeUnit)
          proposalReq = buildProposal(signal, roundStake(currentStakeRef.current), currency)
          setConfidenceScore(Number(signal.setupScore || signal.confidence || 0))
        } else {
          const symbol = SYMBOL_MAP[selectedMarket]
          const tradeStake = roundStake(currentStakeRef.current)
          const recentTicks = tickHistoryRef.current.slice(-20); const spot = recentTicks.at(-1); const atr = recentTicks.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-recentTicks[index]),0)/Math.max(1,recentTicks.length-1); const down = ['Fall','Lower','Down','Put','No Touch'].includes(independentOption); const distance = Math.max(atr*(tradeType==='Touch & No Touch'?3:2),Math.abs(spot||1)*0.0001); const barrier = tradeType==='Digits'?String(predictedDigit):(['Touch & No Touch'].includes(tradeType)||subTradeType==='Higher/Lower')?(down?'-':'+')+distance.toFixed(4):''; const signal = {symbol,tradeType,subTradeType,option:independentOption,predictedDigit,barrier,duration:durationValue,timeframeUnit,expiryEpoch:Math.floor(Date.now()/1000)+Math.max(60,durationValue*60)}
          proposalReq = buildProposal(signal, tradeStake, currency)
        }
        const available = await wsRequest({ contracts_for: proposalReq.underlying_symbol, currency })
        const offeredContracts = available.contracts_for?.available || []
        if (!offeredContracts.some(contract => contract.contract_type === proposalReq.contract_type)) {
          throw new Error(`Deriv does not offer ${proposalReq.contract_type} for ${proposalReq.underlying_symbol} in ${currency}. No order was sent.`)
        }

        addLog(`Requesting ${proposalReq.contract_type} proposal on ${proposalReq.underlying_symbol}...`)
        const proposalRes = await wsRequest(proposalReq)
        const proposal = proposalRes.proposal
        if (!proposal?.id || !Number.isFinite(Number(proposal.ask_price)) || Number(proposal.ask_price) <= 0) {
          throw new Error('Deriv returned an incomplete or invalid trade proposal. No order was sent.')
        }
        if (!isRunningRef.current) break
        addLog('Proposal received. Sending purchase request...')
        const buyRes = await wsRequest({ buy: proposal.id, price: Number(proposal.ask_price) })
        if (!buyRes.buy?.contract_id) throw new Error('Deriv did not confirm the purchase. Check your account statement before retrying.')
        if (!isRunningRef.current) break

        addLog(`✅ Contract purchased: ${buyRes.buy.contract_id}`)
        const contractResult = await monitorContract(buyRes.buy.contract_id)
        if (!contractResult) break

        const profit = parseFloat(contractResult.profit || 0)
        const isWin = profit > 0
        totalTradesRef.current += 1
        sessionPLRef.current += profit
        
        if (isWin) {
          winsRef.current += 1
          consecutiveLossesRef.current = 0
          currentStakeRef.current = parseFloat(stake)
          addLog(`✅ WON +$${profit.toFixed(2)} | Stake reset`)
        } else {
          lossesRef.current += 1
          consecutiveLossesRef.current += 1
          const martingale = parseFloat(martingaleFactor) || 1.5
          currentStakeRef.current = boundedNextStake(stake, currentStakeRef.current, martingale, consecutiveLossesRef.current)
          addLog(`❌ LOST -${profit.toFixed(2)} | Bounded next stake: ${currentStakeRef.current.toFixed(2)}`)
          if (consecutiveLossesRef.current >= 2) { addLog('🛑 Recovery limit reached after two consecutive losses. Stopping.'); isRunningRef.current = false; setIsRunning(false) }
        }

        setTotalTrades(totalTradesRef.current)
        setWins(winsRef.current)
        setLosses(lossesRef.current)
        setConsecutiveLosses(consecutiveLossesRef.current)
        setCurrentStake(currentStakeRef.current)
        setCurrentPL(sessionPLRef.current)

        if (sessionPLRef.current >= parseFloat(targetProfit)) { addLog(`🏆 TARGET HIT! $${sessionPLRef.current.toFixed(2)}`); setIsRunning(false); isRunningRef.current = false; break }
        if (sessionPLRef.current <= -parseFloat(stopLoss)) { addLog(` STOP LOSS HIT! $${sessionPLRef.current.toFixed(2)}`); setIsRunning(false); isRunningRef.current = false; break }

        addLog(`📊 P/L: $${sessionPLRef.current.toFixed(2)} | Trades: ${totalTradesRef.current}`)
        await new Promise(r => setTimeout(r, 1000))
      } catch (error) {
        if (!isRunningRef.current) break
        addLog(`❌ Error: ${error.message}`)
        await new Promise(r => setTimeout(r, 3000))
      }
    }
  }

  const startBot = () => {
    setValidationError('')
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }
    isRunningRef.current = true
    setIsRunning(true)
    sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0; consecutiveLossesRef.current = 0
    currentStakeRef.current = parseFloat(stake)
    setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setConsecutiveLosses(0); setCurrentStake(parseFloat(stake)); setConfidenceScore(0); setLogs([])
    addLog('🚀 DENNY BOT STARTED')
    addLog(`Market: ${selectedMarket} | Stake: $${stake} | Martingale: ${martingaleFactor}x`)
    addLog(`Target: $${targetProfit} | Stop: $${stopLoss} | Min Conf: ${minConfidence}%`)
    runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); addLog(`⏹️ Stopped new entries; any open contract remains monitored until settlement.`) }
  const resetBot = () => { stopBot(); setLogs(['System reset.']); setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setConsecutiveLosses(0); setCurrentStake(parseFloat(stake)); setValidationError(''); setConfidenceScore(0); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0; consecutiveLossesRef.current = 0; currentStakeRef.current = parseFloat(stake) }
  const rules = TIMEFRAME_RULES[tradeType]
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'
  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-950 text-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0"><div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-green-500 rounded-lg flex items-center justify-center"><Activity size={16} className="text-white" /></div><div><h2 className="text-base font-bold text-white">Denny Bots</h2></div></div>
      {validationError && <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0"><AlertCircle size={12} className="text-red-500" /><p className="text-red-400 text-[10px] font-medium">{validationError}</p></div>}
      <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 min-h-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-orange-500" /> Parameters</h3>
        <label className="flex items-center justify-between bg-black/60 border border-sky-500/30 rounded px-2 py-2 mb-2 text-xs"><span className="font-bold text-sky-300">Connect Analysis Tool</span><input type="checkbox" checked={connectedMode} onChange={e => setConnectedMode(e.target.checked)} disabled={isRunning} /></label>
        {connectedMode && <p className="text-[10px] text-sky-300 mb-2">Analysis Tool supplies the strategy. Stake, target, stop loss and recovery remain local.</p>}
        
        <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Market</label><select value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)} disabled={isRunning || connectedMode} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{VOLATILITY_INDICES.map(m => <option key={m} className="text-white">{m}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Type</label><select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning || connectedMode} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{TRADE_TYPES.map(t => <option key={t} className="text-white">{t}</option>)}</select></div>{SUB_TRADE_TYPES[tradeType]?.length > 0 && <div><label className="text-[10px] text-gray-400 uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning || connectedMode} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{SUB_TRADE_TYPES[tradeType].map(t => <option key={t} className="text-white">{t}</option>)}</select></div>}</div>
        {subTradeType && OPTIONS[subTradeType] && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-1">{OPTIONS[subTradeType].map(opt => <button key={opt} onClick={() => setOption(opt)} disabled={isRunning || connectedMode} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-gray-700 text-gray-400'}`}>{opt}</button>)}</div></div>}
        {tradeType === 'Digits' && subTradeType === 'Over/Under' && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Digit (0-9)</label><input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning || connectedMode} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Time</label>{rules.fixed ? <input type="text" value={rules.label} disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-gray-500" /> : <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning || connectedMode} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{rules.units.map(u => <option key={u} className="text-white">{u}</option>)}</select>}</div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Duration</label><input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || connectedMode || rules.fixed} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stake</label><input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Martingale</label><input type="number" step="0.1" value={martingaleFactor} onChange={e => setMartingaleFactor(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Min Confidence %</label><input type="number" min="50" max="95" value={minConfidence} onChange={e => setMinConfidence(e.target.value)} disabled={isRunning || connectedMode} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Current Setup Score</label><div className={`w-full border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 font-bold ${confidenceScore >= 70 ? 'text-green-400' : confidenceScore >= 50 ? 'text-orange-400' : 'text-red-400'}`}>{confidenceScore.toFixed(0)}%</div></div></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Target</label><input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stop Loss</label><input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
      </div>
      <div className="bg-gray-900 rounded-lg p-2 border border-green-500/30 mb-2 flex-shrink-0"><h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-500" /> Performance</h3><div className="grid grid-cols-4 gap-1 text-center"><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">P/L</p><p className={`font-bold text-xs ${currentPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Win Rate</p><p className="text-sky-400 font-bold text-xs">{winRate}%</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Trades</p><p className="text-white font-bold text-xs">{totalTrades}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Next</p><p className="text-orange-400 font-bold text-xs">{currentStake.toFixed(2)}</p></div></div></div>
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2"><button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-black'}`}><Play size={14} /> Run</button><button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}><Square size={14} /> Stop</button><button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-gray-800 border border-gray-700 text-orange-400"><RefreshCw size={14} /> Reset</button></div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-gray-900 px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">ANALYSIS LOG</span></div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{scrollBehavior: 'smooth'}}>
          {logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') || log.includes('TARGET') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') || log.includes('Error') ? 'text-red-500' : log.includes('🚀') || log.includes('📊') || log.includes('') ? 'text-sky-400' : log.includes('⏹️') || log.includes('⚠️') ? 'text-orange-400' : 'text-gray-400'}>{log}</p>)}
        </div>
      </div>
    </div>
  )
}
