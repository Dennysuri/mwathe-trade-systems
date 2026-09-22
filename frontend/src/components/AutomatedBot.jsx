import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Zap } from 'lucide-react'

const SYMBOL_MAP = { 
  'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10', 'Volatility 15 (1s) Index': 'R_15',
  'Volatility 25 (1s) Index': 'R_25', 'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30',
  'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50', 'Volatility 75 (1s) Index': 'R_75',
  'Volatility 75 Index': 'R_75', 'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100', 'Volatility 100 Index': 'R_100' 
}
const TRADE_TYPES = ['Digits', 'Ups & Downs', 'Touch & No Touch', 'Multipliers', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Multipliers': ['Multipliers'], 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Turbos': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10 }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, fixed: true }, 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85 }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1 }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 } }

const roundStake = (v) => Math.round(v * 100) / 100

// Fast Math Functions
const calcEntropy = (arr) => { const unique = new Set(arr.slice(-20)).size; return unique <= 3 ? 1.5 : 3.2 }
const calcRSI = (ticks, p=14) => { if(ticks.length<p+1) return 50; let g=0,l=0; for(let i=ticks.length-p;i<ticks.length;i++){const c=ticks[i]-ticks[i-1]; if(c>0)g+=c; else l-=c} return 100-(100/(1+(g/(l||1)))) }
const calcATR = (ticks, p=14) => { if(ticks.length<p+1) return 0; let tr=0; for(let i=ticks.length-p;i<ticks.length;i++) tr+=Math.abs(ticks[i]-ticks[i-1]); return tr/p }
const calcHurst = (ticks) => { if(ticks.length<20) return 0.5; const n=ticks.length; const mean=ticks.reduce((a,b)=>a+b,0)/n; const dev=ticks.map(t=>t-mean); const cum=dev.reduce((acc,d,i)=>[...acc,(acc[i-1]||0)+d],[]); const range=Math.max(...cum)-Math.min(...cum); const std=Math.sqrt(dev.map(d=>d*d).reduce((a,b)=>a+b,0)/n); return Math.log(range/(std||1))/Math.log(n) }
const calcKalman = (ticks) => { let x=ticks[0], p=1, q=0.01, r=0.1; for(let i=1;i<ticks.length;i++){ const k=p/(p+r); x=x+k*(ticks[i]-x); p=(1-k)*p+q } return x }

export default function AutomatedBot({ token, accountId, onBalanceUpdate }) {
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
  
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(['System initialized.'])
  const [currentPL, setCurrentPL] = useState(0.00)
  const [totalTrades, setTotalTrades] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currentStake, setCurrentStake] = useState(1.00)
  const [bestMarket, setBestMarket] = useState('Scanning...')
  const [confluenceScore, setConfluenceScore] = useState(0)
  
  const logRef = useRef(null); const wsRef = useRef(null); const isRunningRef = useRef(false); const reqIdRef = useRef(1)
  const tickDataRef = useRef({}); const currentStakeRef = useRef(1.00); const sessionPLRef = useRef(0.00)
  const totalTradesRef = useRef(0); const winsRef = useRef(0); const lossesRef = useRef(0)
  const blacklistedMarketsRef = useRef([]); const historyLoadedRef = useRef(false)

  const addLog = (msg) => setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`])
  useEffect(() => { if (logRef.current) requestAnimationFrame(() => { logRef.current.scrollTop = logRef.current.scrollHeight }) }, [logs])
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
        if (!data.data?.url) throw new Error('No WebSocket URL')
        if (wsRef.current) wsRef.current.close()
        const ws = new WebSocket(data.data.url)
        wsRef.current = ws
        ws.onopen = () => { ws.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: reqIdRef.current++ })) }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.msg_type === 'history' && msg.history.prices) tickDataRef.current[msg.history.symbol] = msg.history.prices.map(p => parseFloat(p))
            if (msg.msg_type === 'tick') {
              if (!tickDataRef.current[msg.tick.symbol]) tickDataRef.current[msg.tick.symbol] = []
              tickDataRef.current[msg.tick.symbol] = [...tickDataRef.current[msg.tick.symbol], msg.tick.quote].slice(-100)
            }
            if (msg.msg_type === 'balance' && onBalanceUpdate) onBalanceUpdate(parseFloat(msg.balance.balance))
          } catch (e) {}
        }
      } catch (err) { addLog(`❌ Connection failed`) }
    }
    connectWS()
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [token, accountId])

  const loadAllHistory = () => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve()
      let loadedCount = 0
      const totalMarkets = Object.values(SYMBOL_MAP).length
      const checkDone = () => { loadedCount++; if (loadedCount >= totalMarkets) { historyLoadedRef.current = true; resolve() } }
      Object.values(SYMBOL_MAP).forEach(sym => {
        const reqId = reqIdRef.current++
        const onMessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.req_id === reqId && msg.msg_type === 'history') {
              wsRef.current.removeEventListener('message', onMessage)
              if (msg.history.prices) tickDataRef.current[sym] = msg.history.prices.map(p => parseFloat(p))
              checkDone()
            }
          } catch (e) {}
        }
        wsRef.current.addEventListener('message', onMessage)
        wsRef.current.send(JSON.stringify({ ticks_history: sym, count: 50, end: 'latest', style: 'ticks', subscribe: 1, req_id: reqId }))
      })
      setTimeout(() => { historyLoadedRef.current = true; resolve() }, 4000)
    })
  }

  const wsRequest = (request) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return reject(new Error('WebSocket not connected'))
      const req_id = reqIdRef.current++
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
      wsRef.current.send(JSON.stringify({ ...request, req_id }))
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
            } else {
              setCurrentPL(sessionPLRef.current + parseFloat(msg.proposal_open_contract.profit || 0))
            }
          }
        } catch (e) {}
      }
      wsRef.current.addEventListener('message', onMessage)
      wsRef.current.send(JSON.stringify({ proposal_open_contract: 1, contract_id, subscribe: 1, req_id: reqIdRef.current++ }))
    })
  }

  const getContractType = () => {
    if (tradeType === 'Digits') {
      if (subTradeType === 'Over/Under') return option === 'Over' ? 'DIGITOVER' : 'DIGITUNDER'
      if (subTradeType === 'Even/Odd') return option === 'Even' ? 'DIGITEVEN' : 'DIGITODD'
      return 'DIGITDIFF'
    }
    if (tradeType === 'Ups & Downs') return option === 'Rise' || option === 'Higher' ? 'CALL' : 'PUT'
    if (tradeType === 'Touch & No Touch') return option === 'Touch' ? 'TOUCH' : 'NOTOUCH'
    if (tradeType === 'Multipliers' || tradeType === 'Turbos') return option === 'Up' ? 'CALL' : 'PUT'
    return option === 'Call' ? 'CALL' : 'PUT'
  }

  // UNIVERSAL ADDITIVE SCORING ENGINE
  const calculateConfluence = (symbol) => {
    const ticks = tickDataRef.current[symbol]
    if (!ticks || ticks.length < 30) return { score: 0 }
    let score = 0
    const digits = ticks.map(t => parseInt(t.toString().slice(-1)))
    const td = parseInt(predictedDigit)
    
    if (tradeType === 'Digits') {
      // Cold Digit Trigger
      const last10 = digits.slice(-10)
      if (!last10.includes(td)) score += 40
      const freq = digits.filter(d => d === td).length / digits.length
      if (freq < 0.08) score += 30
      if (freq < 0.05) score += 20
    } else if (tradeType === 'Ups & Downs') {
      // Trend Exhaustion
      const rsi = calcRSI(ticks)
      if (option === 'Rise' || option === 'Higher') { if (rsi < 30) score += 40; if (rsi < 40) score += 20 }
      else { if (rsi > 70) score += 40; if (rsi > 60) score += 20 }
      const last5 = ticks.slice(-5)
      const trend = last5.every((v, i) => i === 0 || v >= last5[i-1])
      if ((option === 'Rise' || option === 'Higher') && !trend) score += 30
    } else if (tradeType === 'Touch & No Touch') {
      // Volatility vs Distance
      const atr = calcATR(ticks)
      const currentPrice = ticks[ticks.length-1]
      const distance = Math.abs(currentPrice - parseFloat(predictedDigit || 0)) // Simplified barrier logic
      if (option === 'Touch' && atr > 0.005) score += 50
      if (option === 'No Touch' && atr < 0.001) score += 50
    } else if (tradeType === 'Multipliers') {
      // Strong Momentum
      const hurst = calcHurst(ticks)
      const kalman = calcKalman(ticks)
      if (hurst > 0.6) score += 40
      if ((option === 'Up' && ticks[ticks.length-1] > kalman) || (option === 'Down' && ticks[ticks.length-1] < kalman)) score += 40
    } else if (tradeType === 'Accumulators') {
      // Low Volatility
      const entropy = calcEntropy(digits)
      const atr = calcATR(ticks)
      if (entropy < 2.5) score += 40
      if (atr < 0.002) score += 40
    } else if (tradeType === 'Vanillas') {
      // Time-Based Momentum
      const rsi = calcRSI(ticks, 20)
      if ((option === 'Call' && rsi > 50) || (option === 'Put' && rsi < 50)) score += 40
      if (ticks[ticks.length-1] > ticks[ticks.length-20]) score += 30
    } else if (tradeType === 'Turbos') {
      // Micro-Momentum
      const last3 = ticks.slice(-3)
      if (last3.every((v, i) => i === 0 || v >= last3[i-1]) && (option === 'Up')) score += 50
      if (last3.every((v, i) => i === 0 || v <= last3[i-1]) && (option === 'Down')) score += 50
    }
    return { score: Math.min(score, 99) }
  }

  const scanMarkets = () => {
    const scoredMarkets = []
    const blacklisted = blacklistedMarketsRef.current
    Object.keys(SYMBOL_MAP).forEach(name => {
      const sym = SYMBOL_MAP[name]
      if (blacklisted.includes(sym)) return
      const res = calculateConfluence(sym)
      if (res.score > 0) scoredMarkets.push({ symbol: sym, score: res.score, name })
    })
    // Sort from highest score to lowest for Rotation Recovery
    scoredMarkets.sort((a, b) => b.score - a.score)
    return scoredMarkets
  }

  const runTradeCycle = async () => {
    if (!historyLoadedRef.current) { addLog('🔬 Analyzing 13 markets...'); await loadAllHistory() }
    let recoveryQueue = []
    let recoveryIndex = 0
    
    while (isRunningRef.current) {
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { await new Promise(r => setTimeout(r, 2000)); continue }
        
        // Rescan if queue is empty
        if (recoveryIndex >= recoveryQueue.length) {
          addLog('🔬 Scanning 13 markets...')
          recoveryQueue = scanMarkets()
          recoveryIndex = 0
          if (recoveryQueue.length === 0) { await new Promise(r => setTimeout(r, 3000)); continue }
        }

        const currentTarget = recoveryQueue[recoveryIndex]
        setBestMarket(currentTarget.name)
        setConfluenceScore(currentTarget.score)
        addLog(`🎯 LOCKED: ${currentTarget.name} | Score: ${currentTarget.score}%`)
        addLog('🚀 EXECUTING...')
        
        const proposalReq = { proposal: 1, amount: roundStake(currentStakeRef.current), basis: 'stake', contract_type: getContractType(), currency: 'USD', duration: durationValue, duration_unit: timeframeUnit === 'Minutes' ? 'm' : 't', underlying_symbol: currentTarget.symbol }
        if (tradeType === 'Digits' && subTradeType === 'Over/Under' && predictedDigit) proposalReq.barrier = predictedDigit
        if (tradeType === 'Touch & No Touch' && predictedDigit) proposalReq.barrier = predictedDigit
        
        const proposalRes = await wsRequest(proposalReq); if (!isRunningRef.current) break
        const buyRes = await wsRequest({ buy: proposalRes.proposal.id, price: proposalRes.proposal.ask_price }); if (!isRunningRef.current) break
        addLog(`✅ Contract: ${buyRes.buy.contract_id}`)
        
        const contractResult = await monitorContract(buyRes.buy.contract_id); if (!isRunningRef.current || !contractResult) break
        const profit = parseFloat(contractResult.profit || 0); const isWin = profit > 0
        totalTradesRef.current += 1; sessionPLRef.current += profit
        
        if (isWin) {
          winsRef.current += 1; currentStakeRef.current = parseFloat(stake)
          blacklistedMarketsRef.current = [] // Clear blacklist on win
          recoveryIndex = 0 // Reset rotation to start of queue
          addLog(`✅ WON +$${profit.toFixed(2)} | Stake reset to base`)
        } else {
          lossesRef.current += 1
          // MARKET ROTATION RECOVERY: Move to next best market, don't spam the same one
          recoveryIndex++ 
          currentStakeRef.current = roundStake(currentStakeRef.current * (parseFloat(martingaleFactor) || 1.5))
          addLog(`❌ LOST -$${profit.toFixed(2)} | Rotating to next market → Next: $${currentStakeRef.current.toFixed(2)}`)
        }
        
        setTotalTrades(totalTradesRef.current); setWins(winsRef.current); setLosses(lossesRef.current)
        setCurrentStake(currentStakeRef.current); setCurrentPL(sessionPLRef.current)
        
        if (sessionPLRef.current >= parseFloat(targetProfit)) { addLog(` TARGET HIT! $${sessionPLRef.current.toFixed(2)}`); setIsRunning(false); isRunningRef.current = false; break }
        if (sessionPLRef.current <= -parseFloat(stopLoss)) { addLog('🛑 STOP LOSS HIT!'); setIsRunning(false); isRunningRef.current = false; break }
        
        addLog(`📊 P/L: $${sessionPLRef.current.toFixed(2)} | Trades: ${totalTradesRef.current}`)
        await new Promise(r => setTimeout(r, 1000))
      } catch (error) { if (!isRunningRef.current) break; addLog(`❌ Error: ${error.message}`); await new Promise(r => setTimeout(r, 2000)) }
    }
  }

  const startBot = () => {
    setValidationError(''); if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }
    isRunningRef.current = true; setIsRunning(true); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0
    currentStakeRef.current = parseFloat(stake); blacklistedMarketsRef.current = []; historyLoadedRef.current = false
    setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setCurrentStake(parseFloat(stake)); setConfluenceScore(0); setLogs([])
    addLog('⚡ AUTOMATED BOT ACTIVATED (13 Markets)'); addLog(`Type: ${tradeType} | Stake: $${stake} | Martingale: ${martingaleFactor}x`); addLog(`Target: $${targetProfit} | Stop: $${stopLoss}`); runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); if (wsRef.current) wsRef.current.send(JSON.stringify({ forget: 'all', req_id: reqIdRef.current++ })); addLog('⏹️ Stopped') }
  const resetBot = () => { stopBot(); setLogs(['System reset.']); setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setCurrentStake(parseFloat(stake)); setValidationError(''); setConfluenceScore(0); setBestMarket('Scanning...'); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0; currentStakeRef.current = parseFloat(stake); blacklistedMarketsRef.current = []; historyLoadedRef.current = false }
  const rules = TIMEFRAME_RULES[tradeType]; const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'
