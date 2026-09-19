import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity } from 'lucide-react'

const VOLATILITY_INDICES = ['Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index', 'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index']
const SYMBOL_MAP = { 'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10', 'Volatility 15 (1s) Index': 'R_15', 'Volatility 25 (1s) Index': 'R_25', 'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30', 'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50', 'Volatility 75 (1s) Index': 'R_75', 'Volatility 75 Index': 'R_75', 'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100', 'Volatility 100 Index': 'R_100' }
const TRADE_TYPES = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'], 'Multipliers': ['Multipliers'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Turbos': ['Up', 'Down', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks' }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto' }, 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false } }

const roundStake = (value) => Math.round(value * 100) / 100

// --- DIGIT-SPECIFIC STRATEGIES ---
const analyzeDigitFrequency = (digits, window = 50) => {
  const recent = digits.slice(-window)
  const freq = Array(10).fill(0)
  recent.forEach(d => freq[d]++)
  return { freq, total: recent.length, leastFrequent: freq.indexOf(Math.min(...freq)), mostFrequent: freq.indexOf(Math.max(...freq)) }
}

const calculateDigitEntropy = (digits) => {
  const freq = {}
  digits.forEach(d => { freq[d] = (freq[d] || 0) + 1 })
  const len = digits.length
  let entropy = 0
  Object.values(freq).forEach(count => { const p = count / len; entropy -= p * Math.log2(p) })
  return entropy
}

const analyzeDigitPattern = (digits, window = 30) => {
  const recent = digits.slice(-window)
  const pattern = {}
  for (let i = 0; i < recent.length - 1; i++) {
    const current = recent[i], next = recent[i + 1]
    if (!pattern[current]) pattern[current] = Array(10).fill(0)
    pattern[current][next]++
  }
  return pattern
}

const calculateDigitDeviation = (digits, targetDigit) => {
  const freq = analyzeDigitFrequency(digits, 50)
  const expected = freq.total / 10
  const actual = freq.freq[targetDigit]
  return (actual - expected) / expected
}

const analyzeDigitTrade = (tickHistory, predictedDigit, option) => {
  if (tickHistory.length < 20) return { confidence: 10, signal: 'CALL', reasons: ['Gathering initial data...'] }
  
  const digits = tickHistory.map(t => parseInt(t.toString().slice(-1)))
  const targetDigit = parseInt(predictedDigit)
  const analysis = analyzeDigitFrequency(digits, 50)
  const entropy = calculateDigitEntropy(digits)
  const pattern = analyzeDigitPattern(digits, 30)
  const deviation = calculateDigitDeviation(digits, targetDigit)
  
  let confidence = 20 // Base confidence
  let reasons = []
  
  // Strategy 1: Frequency
  if (analysis.leastFrequent === targetDigit) { confidence += 25; reasons.push(`Digit ${targetDigit} is cold (due)`) }
  else if (analysis.mostFrequent === targetDigit) { confidence += 10; reasons.push(`Digit ${targetDigit} is hot`) }
  
  // Strategy 2: Entropy
  if (entropy < 2.8) { confidence += 20; reasons.push(`Low entropy (${entropy.toFixed(2)}) = predictable`) }
  else { confidence += 5 }
  
  // Strategy 3: Pattern
  const lastDigit = digits[digits.length - 1]
  if (pattern[lastDigit]) {
    const totalTransitions = pattern[lastDigit].reduce((a,b) => a+b, 0)
    const nextDigitProb = pattern[lastDigit][targetDigit] / totalTransitions
    if (nextDigitProb > 0.25) { confidence += 25; reasons.push(`${(nextDigitProb*100).toFixed(0)}% chance after ${lastDigit}`) }
    else if (nextDigitProb > 0.12) { confidence += 15 }
  }
  
  // Strategy 4: Deviation
  if (deviation < -0.2) { confidence += 20; reasons.push(`Digit ${targetDigit} is statistically due`) }
  
  const signal = confidence > 50 ? (option === 'Over' ? 'CALL' : 'PUT') : 'CALL'
  return { confidence: Math.min(confidence, 99), signal, reasons }
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

export default function DennyBots({ token, accountId, onBalanceUpdate }) {
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
  const currentStakeRef = useRef(1.00)
  const sessionPLRef = useRef(0.00)
  const totalTradesRef = useRef(0)
  const winsRef = useRef(0)
  const lossesRef = useRef(0)
  const consecutiveLossesRef = useRef(0)

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
        }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.msg_type === 'tick') tickHistoryRef.current = [...tickHistoryRef.current, msg.tick.quote].slice(-100)
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
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return reject(new Error('WebSocket not connected'))
      const req_id = reqIdRef.current++
      const requestWithId = { ...request, req_id }
      const onMessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.req_id === req_id) {
            wsRef.current.removeEventListener('message', onMessage)
            if (msg.error) reject(new Error(msg.error.message || 'API Error'))
            else resolve(msg)
          }
        } catch (e) {}
      }
      wsRef.current.addEventListener('message', onMessage)
      wsRef.current.send(JSON.stringify(requestWithId))
      setTimeout(() => { wsRef.current.removeEventListener('message', onMessage); reject(new Error('Timeout')) }, 15000)
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

        addLog('🔬 Analyzing market setup...')
        let analysis
        if (tradeType === 'Digits') {
          analysis = analyzeDigitTrade(tickHistoryRef.current, predictedDigit, option)
        } else {
          analysis = analyzePriceTrade(tickHistoryRef.current)
        }
        
        setConfidenceScore(analysis.confidence)
        addLog(`📊 Confidence: ${analysis.confidence}% | Signals: ${analysis.reasons.join(', ')}`)

        const minConf = parseFloat(minConfidence) || 70
        let waitTime = 0
        
        // Wait silently for up to 20 seconds for a better setup
        while (analysis.confidence < minConf && waitTime < 20000 && isRunningRef.current) {
          addLog(`⏳ Waiting for stronger setup... (${analysis.confidence}%)`, true)
          await new Promise(r => setTimeout(r, 5000))
          waitTime += 5000
          
          if (tradeType === 'Digits') analysis = analyzeDigitTrade(tickHistoryRef.current, predictedDigit, option)
          else analysis = analyzePriceTrade(tickHistoryRef.current)
          setConfidenceScore(analysis.confidence)
        }

        if (analysis.confidence < minConf) {
          addLog(`⚠️ Setup not perfect (${analysis.confidence}%), executing best available signal...`)
        } else {
          addLog(`✅ High confidence setup detected! Executing...`)
        }

        const symbol = SYMBOL_MAP[selectedMarket]
        const contractType = getContractType()
        const tradeStake = roundStake(currentStakeRef.current)
        addLog(`🚀 Trade: ${contractType} ${durationValue}${timeframeUnit[0]} $${tradeStake.toFixed(2)}`)

        const proposalReq = { proposal: 1, amount: tradeStake, basis: 'stake', contract_type: contractType, currency: 'USD', duration: durationValue, duration_unit: timeframeUnit === 'Minutes' ? 'm' : 't', underlying_symbol: symbol }
        if (tradeType === 'Digits' && subTradeType === 'Over/Under' && predictedDigit) proposalReq.barrier = predictedDigit

        const proposalRes = await wsRequest(proposalReq)
        if (!isRunningRef.current) break
        const buyRes = await wsRequest({ buy: proposalRes.proposal.id, price: proposalRes.proposal.ask_price })
        if (!isRunningRef.current) break

        addLog(`✅ Contract purchased: ${buyRes.buy.contract_id}`)
        const contractResult = await monitorContract(buyRes.buy.contract_id)
        if (!isRunningRef.current || !contractResult) break

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
          currentStakeRef.current = roundStake(currentStakeRef.current * martingale)
          addLog(`❌ LOST -$${profit.toFixed(2)} | Next stake: $${currentStakeRef.current.toFixed(2)}`)
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
    addLog(`🚀 DENNY BOT - INSTITUTIONAL MODE`)
    addLog(`Market: ${selectedMarket} | Stake: $${stake} | Martingale: ${martingaleFactor}x`)
    addLog(`Target: $${targetProfit} | Stop: $${stopLoss} | Min Conf: ${minConfidence}%`)
    runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); if (wsRef.current) wsRef.current.send(JSON.stringify({ forget: 'all', req_id: reqIdRef.current++ })); addLog(`⏹️ Stopped`) }
  const resetBot = () => { stopBot(); setLogs(['System reset.']); setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setConsecutiveLosses(0); setCurrentStake(parseFloat(stake)); setValidationError(''); setConfidenceScore(0); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0; consecutiveLossesRef.current = 0; currentStakeRef.current = parseFloat(stake) }
  const rules = TIMEFRAME_RULES[tradeType]
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'
  return (
    <div className="h-full flex flex-col bg-gray-950 text-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0"><div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-green-500 rounded-lg flex items-center justify-center"><Activity size={16} className="text-white" /></div><div><h2 className="text-base font-bold text-white">Denny Bots <span className="text-xs text-orange-400">INSTITUTIONAL</span></h2><p className="text-[10px] text-gray-400 flex items-center gap-1"><ShieldCheck size={10} /> Multi-Strategy Analysis System</p></div></div>
      {validationError && <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0"><AlertCircle size={12} className="text-red-500" /><p className="text-red-400 text-[10px] font-medium">{validationError}</p></div>}
      <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-orange-500" /> Parameters</h3>
        <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Market</label><select value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{VOLATILITY_INDICES.map(m => <option key={m} className="text-white">{m}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Type</label><select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{TRADE_TYPES.map(t => <option key={t} className="text-white">{t}</option>)}</select></div>{SUB_TRADE_TYPES[tradeType]?.length > 0 && <div><label className="text-[10px] text-gray-400 uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{SUB_TRADE_TYPES[tradeType].map(t => <option key={t} className="text-white">{t}</option>)}</select></div>}</div>
        {subTradeType && OPTIONS[subTradeType] && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-1">{OPTIONS[subTradeType].map(opt => <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-gray-700 text-gray-400'}`}>{opt}</button>)}</div></div>}
        {tradeType === 'Digits' && subTradeType === 'Over/Under' && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Digit (0-9)</label><input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Time</label>{rules.fixed ? <input type="text" value={rules.label} disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-gray-500" /> : <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{rules.units.map(u => <option key={u} className="text-white">{u}</option>)}</select>}</div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Duration</label><input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || rules.fixed} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stake</label><input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Martingale</label><input type="number" step="0.1" value={martingaleFactor} onChange={e => setMartingaleFactor(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Min Confidence %</label><input type="number" min="50" max="95" value={minConfidence} onChange={e => setMinConfidence(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Current Confidence</label><div className={`w-full border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 font-bold ${confidenceScore >= 70 ? 'text-green-400' : confidenceScore >= 50 ? 'text-orange-400' : 'text-red-400'}`}>{confidenceScore.toFixed(0)}%</div></div></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Target</label><input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stop Loss</label><input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
      </div>
      <div className="bg-gray-900 rounded-lg p-2 border border-green-500/30 mb-2 flex-shrink-0"><h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-500" /> Performance</h3><div className="grid grid-cols-4 gap-1 text-center"><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">P/L</p><p className={`font-bold text-xs ${currentPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Win Rate</p><p className="text-sky-400 font-bold text-xs">{winRate}%</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Trades</p><p className="text-white font-bold text-xs">{totalTrades}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Next</p><p className="text-orange-400 font-bold text-xs">{currentStake.toFixed(2)}</p></div></div></div>
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2"><button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-black'}`}><Play size={14} /> Run</button><button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}><Square size={14} /> Stop</button><button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-gray-800 border border-gray-700 text-orange-400"><RefreshCw size={14} /> Reset</button></div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-gray-900 px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">ANALYSIS LOG (Scrollable)</span></div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{scrollBehavior: 'smooth'}}>
          {logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') || log.includes('TARGET') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') || log.includes('Error') ? 'text-red-500' : log.includes('🚀') || log.includes('📊') || log.includes('') ? 'text-sky-400' : log.includes('⏹️') || log.includes('⚠️') ? 'text-orange-400' : 'text-gray-400'}>{log}</p>)}
        </div>
      </div>
    </div>
  )
}
