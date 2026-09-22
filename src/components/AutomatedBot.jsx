import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity, Zap } from 'lucide-react'

const VOLATILITY_INDICES = ['Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index', 'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index']
const SYMBOL_MAP = { 'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10', 'Volatility 15 (1s) Index': 'R_15', 'Volatility 25 (1s) Index': 'R_25', 'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30', 'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50', 'Volatility 75 (1s) Index': 'R_75', 'Volatility 75 Index': 'R_75', 'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100', 'Volatility 100 Index': 'R_100' }
const TRADE_TYPES = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'], 'Multipliers': ['Multipliers'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Turbos': ['Up', 'Down', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks' }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto' }, 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false } }

const ALLOWED_DIGITS_MARKETS = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100']
const roundStake = (v) => Math.round(v * 100) / 100

// ADVANCED SNIPER MATH & PROBABILITY ENGINES
const calcFastEntropy = (arr) => { const unique = new Set(arr.slice(-20)).size; return unique <= 3 ? 1.5 : 3.2 }
const calcFastMarkov = (digits, target) => { const matches = digits.slice(-20).filter(d => d === target).length; return matches >= 5 ? 0.45 : 0.10 }
const calcFastFrequency = (digits, target) => (digits.filter(d => d === target).length / digits.length) < 0.05
const calcDormancy = (digits, target) => { const lastIdx = digits.lastIndexOf(target); return lastIdx === -1 ? 50 : digits.length - 1 - lastIdx }
const calcHurst = (ticks) => { if(ticks.length<20) return 0.5; const n=ticks.length; const mean=ticks.reduce((a,b)=>a+b,0)/n; const dev=ticks.map(t=>t-mean); const cum=dev.reduce((acc,d,i)=>[...acc,(acc[i-1]||0)+d],[]); const range=Math.max(...cum)-Math.min(...cum); const std=Math.sqrt(dev.map(d=>d*d).reduce((a,b)=>a+b,0)/n); return Math.log(range/(std||1))/Math.log(n) }
const calcRSI = (ticks, p=14) => { if(ticks.length<p+1) return 50; let g=0,l=0; for(let i=ticks.length-p;i<ticks.length;i++){const c=ticks[i]-ticks[i-1]; if(c>0)g+=c; else l-=c} const rs=g/(l||1); return 100-(100/(1+rs)) }

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
  const [consecutiveLosses, setConsecutiveLosses] = useState(0)
  const [bestMarket, setBestMarket] = useState('Scanning...')
  const [confluenceScore, setConfluenceScore] = useState(0)
  
  const logRef = useRef(null)
  const wsRef = useRef(null)
  const isRunningRef = useRef(false)
  const reqIdRef = useRef(1)
  const tickDataRef = useRef({})
  const currentStakeRef = useRef(1.00)
  const sessionPLRef = useRef(0.00)
  const totalTradesRef = useRef(0)
  const winsRef = useRef(0)
  const lossesRef = useRef(0)
  const consecutiveLossesRef = useRef(0)
  const blacklistedMarketsRef = useRef([])
  const historyLoadedRef = useRef(false)
  const recoveryModeRef = useRef(false)

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
        const wsUrl = data.data?.url
        if (!wsUrl) throw new Error('No WebSocket URL')
        if (wsRef.current) wsRef.current.close()
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        ws.onopen = () => { ws.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: reqIdRef.current++ })) }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.msg_type === 'history') {
              const sym = msg.history.symbol
              if (msg.history.prices && msg.history.prices.length > 0) tickDataRef.current[sym] = msg.history.prices.map(p => parseFloat(p))
            }
            if (msg.msg_type === 'tick') {
              const sym = msg.tick.symbol
              if (!tickDataRef.current[sym]) tickDataRef.current[sym] = []
              tickDataRef.current[sym] = [...tickDataRef.current[sym], msg.tick.quote].slice(-100)
            }
            if (msg.msg_type === 'balance' && onBalanceUpdate) onBalanceUpdate(parseFloat(msg.balance.balance))
          } catch (e) {}
        }
      } catch (err) { addLog(`Connection failed`) }
    }
    connectWS()
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [token, accountId])

  // BULLETPROOF HISTORY LOADER WITH 3.5s FAILSAD TIMEOUT
  const loadAllHistory = () => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve()
      let loadedCount = 0
      const totalMarkets = Object.values(SYMBOL_MAP).length
      let isResolved = false
      
      const finishLoading = () => {
        if (isResolved) return
        isResolved = true
        historyLoadedRef.current = true
        resolve()
      }

      const checkDone = () => { 
        loadedCount++ 
        if (loadedCount >= totalMarkets) finishLoading() 
      }

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
        wsRef.current.send(JSON.stringify({ ticks_history: sym, count: 60, end: 'latest', style: 'ticks', subscribe: 1, req_id: reqId }))
      })

      // Fail-safe timer so it never hangs indefinitely
      setTimeout(() => { finishLoading() }, 3500)
    })
  }
