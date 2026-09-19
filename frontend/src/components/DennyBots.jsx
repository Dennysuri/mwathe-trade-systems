import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity, Zap } from 'lucide-react'

const VOLATILITY_INDICES = ['Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index', 'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index']
const SYMBOL_MAP = { 'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10', 'Volatility 15 (1s) Index': 'R_15', 'Volatility 25 (1s) Index': 'R_25', 'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30', 'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50', 'Volatility 75 (1s) Index': 'R_75', 'Volatility 75 Index': 'R_75', 'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100', 'Volatility 100 Index': 'R_100' }
const TRADE_TYPES = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'], 'Multipliers': ['Multipliers'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Turbos': ['Up', 'Down', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks' }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto' }, 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false } }

const roundStake = (value) => Math.round(value * 100) / 100

// Strategy 1: RSI
const calculateRSI = (ticks, period = 14) => {
  if (ticks.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = ticks.length - period; i < ticks.length; i++) {
    const change = ticks[i] - ticks[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }
  const rs = gains / (losses || 1)
  return 100 - (100 / (1 + rs))
}

// Strategy 2: MACD
const calculateMACD = (ticks) => {
  if (ticks.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  const ema12 = calculateEMA(ticks, 12)
  const ema26 = calculateEMA(ticks, 26)
  const macd = ema12 - ema26
  const signal = calculateEMA([macd], 9)
  return { macd, signal, histogram: macd - signal }
}

const calculateEMA = (ticks, period) => {
  const multiplier = 2 / (period + 1)
  let ema = ticks[0]
  for (let i = 1; i < ticks.length; i++) ema = (ticks[i] - ema) * multiplier + ema
  return ema
}

// Strategy 3: Bollinger Bands
const calculateBollingerBands = (ticks, period = 20) => {
  if (ticks.length < period) return { upper: 0, middle: 0, lower: 0, position: 0 }
  const sma = ticks.slice(-period).reduce((a, b) => a + b, 0) / period
  const squaredDiffs = ticks.slice(-period).map(tick => Math.pow(tick - sma, 2))
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period)
  const upper = sma + (2 * stdDev)
  const lower = sma - (2 * stdDev)
  const currentPrice = ticks[ticks.length - 1]
  const position = (currentPrice - lower) / (upper - lower || 1)
  return { upper, middle: sma, lower, position }
}

// Strategy 4: Momentum
const calculateMomentum = (ticks, period = 10) => {
  if (ticks.length < period) return 0
  return ticks[ticks.length - 1] - ticks[ticks.length - period]
}

// Strategy 5: Hurst Exponent
const calculateHurstExponent = (ticks) => {
  if (ticks.length < 20) return 0.5
  const n = ticks.length
  const mean = ticks.reduce((a, b) => a + b, 0) / n
  const deviations = ticks.map(t => t - mean)
  const cumulative = deviations.reduce((acc, d, i) => [...acc, (acc[i - 1] || 0) + d], [])
  const range = Math.max(...cumulative) - Math.min(...cumulative)
  const stdDev = Math.sqrt(deviations.map(d => d * d).reduce((a, b) => a + b, 0) / n)
  return Math.log(range / (stdDev || 1)) / Math.log(n)
}

// Strategy 6: Shannon Entropy & Digit Analysis
const calculateShannonEntropy = (digits) => {
  const freq = {}
  digits.forEach(d => { freq[d] = (freq[d] || 0) + 1 })
  const len = digits.length
  let entropy = 0
  Object.values(freq).forEach(count => {
    const p = count / len
    entropy -= p * Math.log2(p)
  })
  return entropy
}

const analyzeDigitFrequency = (digits, window = 50) => {
  const recent = digits.slice(-window)
  const freq = Array(10).fill(0)
  recent.forEach(d => freq[d]++)
  const leastFrequent = freq.indexOf(Math.min(...freq))
  const mostFrequent = freq.indexOf(Math.max(...freq))
  const hotDigits = freq.map((count, digit) => ({ digit, count })).sort((a, b) => b.count - a.count).slice(0, 3)
  return { leastFrequent, mostFrequent, hotDigits, frequencies: freq }
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
  const [minConfidence, setMinConfidence] = useState('85')
  
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(['System initialized. Ready for institutional trading.'])
  
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

  const addLog = (msg) => setLogs(prev => [...prev.slice(-40), `[${new Date().toLocaleTimeString()}] ${msg}`])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { const rules = TIMEFRAME_RULES[tradeType]; setTimeframeUnit(rules.defaultUnit); setDurationValue(rules.min) }, [tradeType])
  useEffect(() => { if (!isRunning) { const s = parseFloat(stake) || 1.00; setCurrentStake(s); currentStakeRef.current = s } }, [stake, isRunning])

  // WebSocket Connection
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
            if (msg.msg_type === 'tick') {
              tickHistoryRef.current = [...tickHistoryRef.current, msg.tick.quote].slice(-100)
            }
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
      setTimeout(() => { wsRef.current.removeEventListener('message', onMessage); reject(new Error('Request timeout')) }, 15000)
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
            } else {
              const profit = parseFloat(msg.proposal_open_contract.profit || 0)
              setCurrentPL(profit)
            }
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

  // Multi-Strategy Analysis
  const performInstitutionalAnalysis = () => {
    const ticks = tickHistoryRef.current
    if (ticks.length < 50) return { confidence: 0, signal: null, analysis: 'Insufficient data' }

    addLog(' Running institutional-grade analysis...')
    
    const rsi = calculateRSI(ticks)
    addLog(`📊 RSI: ${rsi.toFixed(2)} ${rsi < 30 ? '(Oversold - BULLISH)' : rsi > 70 ? '(Overbought - BEARISH)' : '(Neutral)'}`)
    
    const macd = calculateMACD(ticks)
    const macdSignal = macd.histogram > 0 ? 'BULLISH' : 'BEARISH'
    addLog(`📊 MACD: ${macd.macd.toFixed(4)} | Signal: ${macdSignal}`)
    
    const bb = calculateBollingerBands(ticks)
    const bbSignal = bb.position < 0.2 ? 'BULLISH (Lower Band)' : bb.position > 0.8 ? 'BEARISH (Upper Band)' : 'NEUTRAL'
    addLog(`📊 Bollinger: Position ${ (bb.position * 100).toFixed(1) }% | ${bbSignal}`)
    
    const momentum = calculateMomentum(ticks)
    const momSignal = momentum > 0 ? 'BULLISH' : 'BEARISH'
    addLog(`📊 Momentum: ${momentum.toFixed(4)} | ${momSignal}`)
    
    const hurst = calculateHurstExponent(ticks)
    const hurstSignal = hurst > 0.6 ? 'TRENDING' : hurst < 0.4 ? 'MEAN REVERTING' : 'RANDOM'
    addLog(` Hurst Exponent: ${hurst.toFixed(3)} | ${hurstSignal}`)
    
    let entropyAnalysis = '', digitAnalysis = ''
    if (tradeType === 'Digits' && subTradeType === 'Over/Under') {
      const digits = ticks.map(t => parseInt(t.toString().slice(-1)))
      const entropy = calculateShannonEntropy(digits)
      const digitFreq = analyzeDigitFrequency(digits)
      entropyAnalysis = `Entropy: ${entropy.toFixed(2)} (Max: 3.32)`
      digitAnalysis = `Hot digits: ${digitFreq.hotDigits.map(h => h.digit).join(', ')}`
      addLog(`📊 ${entropyAnalysis}`)
      addLog(` ${digitAnalysis}`)
    }
    
    let bullishSignals = 0, bearishSignals = 0
    if (rsi < 30) bullishSignals++
    else if (rsi > 70) bearishSignals++
    if (macd.histogram > 0) bullishSignals++
    else bearishSignals++
    if (bb.position < 0.3) bullishSignals++
    else if (bb.position > 0.7) bearishSignals++
    if (momentum > 0) bullishSignals++
    else bearishSignals++
    
    const totalStrategies = 4
    const confidence = Math.max(bullishSignals, bearishSignals) / totalStrategies * 100
    const signal = bullishSignals > bearishSignals ? 'CALL' : 'PUT'
    
    addLog(` Combined Confidence: ${confidence.toFixed(1)}% | Signal: ${signal}`)
    return { confidence, signal, rsi, macd, bb, momentum, hurst, entropy: entropyAnalysis, digits: digitAnalysis }
  }

  const runTradeCycle = async () => {
    while (isRunningRef.current) {
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          addLog('⚠️ Waiting for connection...')
          await new Promise(r => setTimeout(r, 2000))
          continue
        }

        addLog('🔬 STEP 1: Analyzing market conditions...')
        await new Promise(r => setTimeout(r, 3000))
        
        const analysis = performInstitutionalAnalysis()
        setConfidenceScore(analysis.confidence)
        
        const minConf = parseFloat(minConfidence) || 85
        if (analysis.confidence < minConf) {
          addLog(`️ Confidence ${analysis.confidence.toFixed(1)}% below threshold ${minConf}% - SKIPPING TRADE`)
          addLog('⏳ Waiting for better setup...')
          await new Promise(r => setTimeout(r, 5000))
          continue
        }
        
        addLog(`✅ STEP 2: Confidence ${analysis.confidence.toFixed(1)}% meets threshold - PROCEEDING`)
        await new Promise(r => setTimeout(r, 2000))
        
        const symbol = SYMBOL_MAP[selectedMarket]
        const contractType = getContractType()
        const tradeStake = roundStake(currentStakeRef.current)
        addLog(`🚀 STEP 3: Executing trade - ${contractType} ${durationValue}${timeframeUnit[0]} $${tradeStake.toFixed(2)}`)

        const proposalReq = { proposal: 1, amount: tradeStake, basis: 'stake', contract_type: contractType, currency: 'USD', duration: durationValue, duration_unit: timeframeUnit === 'Minutes' ? 'm' : 't', underlying_symbol: symbol }
        if (tradeType === 'Digits' && subTradeType === 'Over/Under' && predictedDigit) proposalReq.barrier = predictedDigit

        const proposalRes = await wsRequest(proposalReq)
        if (!isRunningRef.current) break

        const buyRes = await wsRequest({ buy: proposalRes.proposal.id, price: proposalRes.proposal.ask_price })
        if (!isRunningRef.current) break

        const contractId = buyRes.buy.contract_id
        addLog(`✅ Contract purchased: ${contractId}`)

        addLog('👁️ STEP 4: Monitoring contract in real-time...')
        const contractResult = await monitorContract(contractId)
        if (!isRunningRef.current || !contractResult) break

        const profit = parseFloat(contractResult.profit || 0)
        const isWin = profit > 0
        
        totalTradesRef.current += 1
        sessionPLRef.current += profit
        
        if (isWin) {
          winsRef.current += 1
          consecutiveLossesRef.current = 0
          currentStakeRef.current = parseFloat(stake)
          addLog(`✅ WON +$${profit.toFixed(2)} | Stake reset to base $${currentStakeRef.current.toFixed(2)}`)
        } else {
          lossesRef.current += 1
          consecutiveLossesRef.current += 1
          const martingale = parseFloat(martingaleFactor) || 1.5
          const newStake = roundStake(currentStakeRef.current * martingale)
          currentStakeRef.current = newStake
          addLog(` LOST -$${profit.toFixed(2)} | Martingale ${martingale}x applied → Next: $${newStake.toFixed(2)}`)
        }

        setTotalTrades(totalTradesRef.current)
        setWins(winsRef.current)
        setLosses(lossesRef.current)
        setConsecutiveLosses(consecutiveLossesRef.current)
        setCurrentStake(currentStakeRef.current)
        setCurrentPL(sessionPLRef.current)

        if (sessionPLRef.current >= parseFloat(targetProfit)) { 
          addLog(` TARGET PROFIT REACHED! $${sessionPLRef.current.toFixed(2)}`)
          setIsRunning(false)
          isRunningRef.current = false
          break
        }
        if (sessionPLRef.current <= -parseFloat(stopLoss)) { 
          addLog(` STOP LOSS HIT! $${sessionPLRef.current.toFixed(2)}`)
          setIsRunning(false)
          isRunningRef.current = false
          break
        }

        const winRate = totalTradesRef.current > 0 ? ((winsRef.current / totalTradesRef.current) * 100).toFixed(1) : '0.0'
        addLog(`📊 Session: P/L $${sessionPLRef.current.toFixed(2)} | Win Rate: ${winRate}% | Trades: ${totalTradesRef.current}`)
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        await new Promise(r => setTimeout(r, 2000))
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
    addLog(`🚀 DENNY BOT - INSTITUTIONAL MODE ACTIVATED`)
    addLog(`Market: ${selectedMarket}`)
    addLog(`Base Stake: $${stake} | Martingale: ${martingaleFactor}x`)
    addLog(`Target: $${targetProfit} | Stop: $${stopLoss} | Min Confidence: ${minConfidence}%`)
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); if (wsRef.current) wsRef.current.send(JSON.stringify({ forget: 'all', req_id: reqIdRef.current++ })); addLog(`⏹️ Stopped by user`) }
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
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Min Confidence %</label><input type="number" min="70" max="95" value={minConfidence} onChange={e => setMinConfidence(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Current Confidence</label><div className={`w-full border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 font-bold ${confidenceScore >= 85 ? 'text-green-400' : confidenceScore >= 70 ? 'text-orange-400' : 'text-red-400'}`}>{confidenceScore.toFixed(1)}%</div></div></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Target</label><input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stop Loss</label><input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
      </div>
      <div className="bg-gray-900 rounded-lg p-2 border border-green-500/30 mb-2 flex-shrink-0"><h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-500" /> Performance</h3><div className="grid grid-cols-4 gap-1 text-center"><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">P/L</p><p className={`font-bold text-xs ${currentPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Win Rate</p><p className="text-sky-400 font-bold text-xs">{winRate}%</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Trades</p><p className="text-white font-bold text-xs">{totalTrades}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Next</p><p className="text-orange-400 font-bold text-xs">{currentStake.toFixed(2)}</p></div></div></div>
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2"><button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-black'}`}><Play size={14} /> Run</button><button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}><Square size={14} /> Stop</button><button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-gray-800 border border-gray-700 text-orange-400"><RefreshCw size={14} /> Reset</button></div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-gray-900 px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">ANALYSIS LOG (Scrollable)</span></div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{scrollBehavior: 'smooth'}}>
          {logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') || log.includes('TARGET') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') || log.includes('Error') ? 'text-red-500' : log.includes('') || log.includes('') || log.includes('📊') || log.includes('🔬') ? 'text-sky-400' : log.includes('⏹️') || log.includes('⚠️') ? 'text-orange-400' : log.includes('━━') ? 'text-gray-600' : 'text-gray-400'}>{log}</p>)}
        </div>
      </div>
    </div>
  )
}
