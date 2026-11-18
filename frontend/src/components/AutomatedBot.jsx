import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Zap } from 'lucide-react'
import { boundedNextStake, buildProposal } from '../services/tradingCore'
import { evaluateStrategyEnsemble, validateEntryWindow } from '../services/strategyIntelligence'
import { recordContractOutcome } from '../services/contractOutcomeIntelligence'
import { appendTickBuffer, seedTickBuffer } from '../services/marketTickBuffer'

const SYMBOL_MAP = { 
  'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10', 'Volatility 15 (1s) Index': 'R_15',
  'Volatility 25 (1s) Index': 'R_25', 'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30',
  'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50', 'Volatility 75 (1s) Index': 'R_75',
  'Volatility 75 Index': 'R_75', 'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100', 'Volatility 100 Index': 'R_100' 
}
const UNIQUE_MARKETS = Object.entries(SYMBOL_MAP).filter((entry,index,all)=>all.findIndex(item=>item[1]===entry[1])===index)
const TRADE_TYPES = ['Digits', 'Ups & Downs', 'Touch & No Touch', 'Multipliers', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Multipliers': ['Multipliers'], 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Turbos': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10 }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, fixed: true }, 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85 }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1 }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 } }

const roundStake = (v) => Math.round(v * 100) / 100
const getLastDigit = value => { const text=String(value); const decimals=text.includes('.')?text.split('.')[1]:''; return Number((decimals||text).slice(-1)) }
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
  const tickDataRef = useRef({}); const historySeededRef = useRef({}); const pendingLiveTicksRef = useRef({}); const currentStakeRef = useRef(1.00); const sessionPLRef = useRef(0.00)
  const totalTradesRef = useRef(0); const winsRef = useRef(0); const lossesRef = useRef(0)
  const historyLoadedRef = useRef(false)
  const hasLoggedScanningRef = useRef(false); const reconnectAttemptsRef = useRef(0)
  const pingIntervalRef = useRef(null)
  const lastFailedDirectionRef = useRef(null)
  const consecutiveLossesRef = useRef(0)
  const recoveryStartTimeRef = useRef(null)
  const lastResearchNoticeRef = useRef('')

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  useEffect(() => { if (logRef.current) requestAnimationFrame(() => { logRef.current.scrollTop = logRef.current.scrollHeight }) }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { const rules = TIMEFRAME_RULES[tradeType]; setTimeframeUnit(rules.defaultUnit); setDurationValue(rules.min) }, [tradeType])
  useEffect(() => { if (!isRunning) { const s = parseFloat(stake) || 1.00; setCurrentStake(s); currentStakeRef.current = s } }, [stake, isRunning])

  useEffect(() => {
    if (!token || !accountId) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunningRef.current) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectAttemptsRef.current = 0
          connectWS()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    
    const connectWS = async () => {
      try {
        const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        const data = await response.json()
        if (!data.data?.url) throw new Error('No WebSocket URL')
        if (wsRef.current) wsRef.current.close()
        const ws = new WebSocket(data.data.url)
        wsRef.current = ws
        ws.onopen = () => { 
          reconnectAttemptsRef.current = 0
          if(isRunningRef.current) addLog('✅ Connection Restored')
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1, req_id: reqIdRef.current++ }))
          }, 20000)
        }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.msg_type === 'history' && msg.history?.prices) {
              const symbol = msg.history.symbol || msg.echo_req?.ticks_history
              if (symbol) {
                tickDataRef.current[symbol] = seedTickBuffer(msg.history.prices, pendingLiveTicksRef.current[symbol] || [])
                historySeededRef.current[symbol] = true
                delete pendingLiveTicksRef.current[symbol]
              }
            }
            if (msg.msg_type === 'tick' && msg.tick?.symbol) {
              const symbol = msg.tick.symbol
              if (historySeededRef.current[symbol]) {
                tickDataRef.current[symbol] = appendTickBuffer(tickDataRef.current[symbol], msg.tick.quote)
              } else {
                pendingLiveTicksRef.current[symbol] = appendTickBuffer(pendingLiveTicksRef.current[symbol], msg.tick.quote)
              }
            }
            if (msg.msg_type === 'balance' && onBalanceUpdate) onBalanceUpdate(parseFloat(msg.balance.balance))
          } catch (e) {}
        }
        ws.onclose = () => {
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
          if (isRunningRef.current) {
            reconnectAttemptsRef.current++
            const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000)
            setTimeout(connectWS, delay)
            if (reconnectAttemptsRef.current >= 20) {
              addLog('❌ Max reconnection attempts reached. Stopping bot.')
              setIsRunning(false); isRunningRef.current = false
            }
          }
        }
      } catch (err) { addLog(`❌ Connection failed`) }
    }
    connectWS()
    return () => { 
      if (wsRef.current) wsRef.current.close()
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [token, accountId])

  const loadAllHistory = () => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve()
      let loadedCount = 0
      const totalMarkets = UNIQUE_MARKETS.length
      const checkDone = () => { loadedCount++; if (loadedCount >= totalMarkets) { historyLoadedRef.current = true; resolve() } }
      UNIQUE_MARKETS.forEach(([,sym]) => {
        const reqId = reqIdRef.current++
        const onMessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.req_id === reqId && msg.msg_type === 'history') {
              wsRef.current.removeEventListener('message', onMessage)
              checkDone()
            }
          } catch (e) {}
        }
        wsRef.current.addEventListener('message', onMessage)
        wsRef.current.send(JSON.stringify({ ticks_history: sym, count: 250, end: 'latest', style: 'ticks', subscribe: 1, req_id: reqId }))
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
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: reqIdRef.current++ }));
              }
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

  // HARD GATES & SCORING ENGINE
  const calculateConfluence = (symbol, isRecovery) => {
    const ticks = tickDataRef.current[symbol]
    if (!ticks || ticks.length < 30) return { score: 0, selectedDigit: null, selectedOption: null }
    
    let score = 0
    const digits = ticks.map(getLastDigit)
    let selectedDigit = null
    let selectedOption = option
    
    // Sub-Type Intelligence
    if (tradeType === 'Digits' && subTradeType === 'Matches/Differs') {
      if (isRecovery && (option === 'Matches' || option === 'Both')) selectedOption = 'Differs'
      else if (option === 'Both') selectedOption = 'Differs'
      else selectedOption = option
    }
    
    // Calculate Global Indicators for Gates
    const hurst = calcHurst(ticks)
    const atr = calcATR(ticks, 14)
    const kalman = calcKalman(ticks)
    const currentPrice = ticks[ticks.length - 1]
    const last5 = ticks.slice(-5)
    const last20 = ticks.slice(-20)
    const slope5 = last5[last5.length-1] - last5[0]
    const slope20 = last20[last20.length-1] - last20[0]

    if (tradeType === 'Digits') {
      const td = Math.max(0,Math.min(9,parseInt(predictedDigit,10)||0))
      const previous = digits[digits.length-1]
      const transitions = digits.slice(0,-1).reduce((acc,d,i)=>{if(d===previous)acc.push(digits[i+1]);return acc},[])
      if (transitions.length < 8) return { score: 0, selectedDigit: null, selectedOption: null }
      const eventRate = predicate => (transitions.filter(predicate).length + 1) / (transitions.length + 2)
      const candidates = subTradeType === 'Over/Under'
        ? [{name:'Over',p:eventRate(d=>d>td),base:(9-td)/10},{name:'Under',p:eventRate(d=>d<td),base:td/10}]
        : subTradeType === 'Matches/Differs'
          ? [{name:'Matches',p:eventRate(d=>d===td),base:0.1},{name:'Differs',p:eventRate(d=>d!==td),base:0.9}]
          : [{name:'Even',p:eventRate(d=>d%2===0),base:0.5},{name:'Odd',p:eventRate(d=>d%2===1),base:0.5}]
      const selected = option === 'Both' ? candidates.sort((x,y)=>(y.p-y.base)-(x.p-x.base))[0] : candidates.find(x=>x.name===option)
      if (!selected) return { score: 0, selectedDigit: null, selectedOption: null }
      const edge=selected.p-selected.base
      score=edge>0.04?Math.min(90,Math.round(50+edge*400)):0
      selectedOption=selected.name
      selectedDigit=td
    } else if (tradeType === 'Ups & Downs' || tradeType === 'Multipliers' || tradeType === 'Turbos' || tradeType === 'Vanillas') {
      // HARD GATE 1: Market Regime (Must be trending)
      if (hurst < 0.55) return { score: 0, selectedDigit: null, selectedOption: null }
      // HARD GATE 2: Volatility (Must have movement)
      if (atr < 0.0005) return { score: 0, selectedDigit: null, selectedOption: null }
      // HARD GATE 3: Multi-Timeframe Alignment
      if ((slope5 > 0 && slope20 < 0) || (slope5 < 0 && slope20 > 0)) return { score: 0, selectedDigit: null, selectedOption: null }

      if (option === 'Both') selectedOption = currentPrice > kalman ? (tradeType === 'Vanillas' ? 'Call' : 'Rise') : (tradeType === 'Vanillas' ? 'Put' : 'Fall')
      if (isRecovery && lastFailedDirectionRef.current) {
         if (tradeType === 'Vanillas') selectedOption = lastFailedDirectionRef.current === 'Call' ? 'Put' : 'Call'
         else selectedOption = lastFailedDirectionRef.current === 'Rise' ? 'Fall' : 'Rise'
      }
      
      const isUp = selectedOption === 'Rise' || selectedOption === 'Higher' || selectedOption === 'Up' || selectedOption === 'Call'
      if (isUp) { 
        if (hurst > 0.7) score += 50; else if (hurst > 0.6) score += 30
        if (currentPrice > kalman) score += 30
        if (ticks[ticks.length-1] > ticks[ticks.length-2]) score += 20 
      } else { 
        if (hurst > 0.7) score += 50; else if (hurst > 0.6) score += 30
        if (currentPrice < kalman) score += 30
        if (ticks[ticks.length-1] < ticks[ticks.length-2]) score += 20 
      }
    } else if (tradeType === 'Touch & No Touch') {
      if (atr < 0.0002) return { score: 0, selectedDigit: null, selectedOption: null }
      const barrier = parseFloat(predictedDigit || 0); const distance = Math.abs(currentPrice - barrier)
      if (option === 'Both') selectedOption = atr > 0.005 ? 'Touch' : 'No Touch'
      if (isRecovery && lastFailedDirectionRef.current) selectedOption = lastFailedDirectionRef.current === 'Touch' ? 'No Touch' : 'Touch'
      if (selectedOption === 'Touch') { if (atr > 0.008) score += 40; if (distance < 0.005) score += 40 } 
      else { if (atr < 0.001) score += 40; if (distance > 0.01) score += 40 }
    } else if (tradeType === 'Accumulators') {
      if (hurst > 0.65) return { score: 0, selectedDigit: null, selectedOption: null }
      const entropy = calcEntropy(digits)
      if (entropy < 2.0) score += 40; else if (entropy < 2.5) score += 25
      if (atr < 0.001) score += 40; else if (atr < 0.002) score += 25
    }
    return { score: Math.min(score, 99), selectedDigit, selectedOption }
  }

  const scanMarkets = (isRecovery) => {
    const allMarkets = [];
    const threshold = isRecovery ? 75 : 70;
    
    UNIQUE_MARKETS.forEach(([name,sym]) => {
      const res = calculateConfluence(sym, isRecovery)
      allMarkets.push({ symbol: sym, score: res.score, name, selectedDigit: res.selectedDigit, selectedOption: res.selectedOption })
    });

    const validMarkets = allMarkets.filter(m => m.score >= threshold);
    
    // Relative Best Logic for Recovery
    if (isRecovery && recoveryStartTimeRef.current) {
      const waitTime = Date.now() - recoveryStartTimeRef.current;
      if (waitTime > 45000 && validMarkets.length === 0) {
        return []; // Do not lower the quality threshold after a timeout
      }
    }

    return validMarkets.sort((a, b) => b.score - a.score);
  }

  const runTradeCycle = async () => {
    if (!historyLoadedRef.current) { addLog(' Analyzing unique volatility markets...'); await loadAllHistory() }
    let recoveryQueue = []
    let recoveryIndex = 0
    
    while (isRunningRef.current) {
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { await new Promise(r => setTimeout(r, 3000)); continue }
        const isRecovery = currentStakeRef.current > parseFloat(stake)
        
        if (recoveryQueue.length === 0 || recoveryIndex >= recoveryQueue.length) {
          recoveryQueue = scanMarkets(isRecovery)
          recoveryIndex = 0
          
          // STRICT NO REPEAT LOGGING
          if (recoveryQueue.length === 0) { 
            if (!hasLoggedScanningRef.current) {
              addLog(' Waiting for worthy signal...');
              hasLoggedScanningRef.current = true;
            }
            await new Promise(r => setTimeout(r, 2000)); continue 
          }
          // Reset flag ONLY when we find a valid queue
          hasLoggedScanningRef.current = false; 
        }

        const currentTarget = recoveryQueue[recoveryIndex]
        const tradeDirection = currentTarget.selectedOption || option
        
        const spot = tickDataRef.current[currentTarget.symbol]?.at(-1)
        const recentTicks = (tickDataRef.current[currentTarget.symbol] || []).slice(-15)
        const atrNow = calcATR(recentTicks, Math.min(14, Math.max(2, recentTicks.length - 1))) || Math.abs(spot || 1) * 0.0001
        let barrier = null
        if (tradeType === 'Digits' && ['Over/Under','Matches/Differs'].includes(subTradeType)) barrier = String(currentTarget.selectedDigit ?? predictedDigit)
        if (tradeType === 'Touch & No Touch' || (tradeType === 'Ups & Downs' && subTradeType === 'Higher/Lower')) {
          const isDown = ['Fall','Lower','Down','Put','No Touch'].includes(tradeDirection)
          barrier = (isDown ? '-' : '+') + Math.max(atrNow * (tradeType === 'Touch & No Touch' ? 3 : 2), Math.abs(spot || 1) * 0.0001).toFixed(4)
        }
        const signal = {
          symbol: currentTarget.symbol, tradeType, subTradeType, option: tradeDirection,
          predictedDigit: currentTarget.selectedDigit ?? predictedDigit, barrier,
          duration: durationValue, timeframeUnit, createdAt: Date.now(),
          expiryEpoch: Math.floor(Date.now()/1000) + Math.max(60, durationValue * (timeframeUnit === 'Hours' ? 3600 : timeframeUnit === 'Days' ? 86400 : timeframeUnit === 'Minutes' ? 60 : 1)),
          growthRate: 0.01, multiplier: 100, takeProfit: 1, contractStopLoss: 1
        }
        const researchReport = await evaluateStrategyEnsemble(tickDataRef.current[currentTarget.symbol] || [], signal)
        if (!researchReport.ready || !researchReport.tradable) {
          const candidate = researchReport.candidate || researchReport.watchCandidate
          const noticeKey = [currentTarget.symbol, tradeType, subTradeType, candidate?.option || tradeDirection, candidate?.score ?? currentTarget.score, researchReport.decision].join('|')
          if (noticeKey !== lastResearchNoticeRef.current) {
            lastResearchNoticeRef.current = noticeKey
            addLog(`🔬 CANDIDATE ONLY: ${currentTarget.name} | ${candidate?.option || tradeDirection} | Relative score ${candidate?.score ?? currentTarget.score}/94. No order sent: execution is gated pending independent calibration and payout validation.`)
          }
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
        lastResearchNoticeRef.current = ''
        setBestMarket(currentTarget.name); setConfluenceScore(currentTarget.score)
        addLog(`🎯 LOCKED: ${currentTarget.name} | Score: ${currentTarget.score}% | Direction: ${tradeDirection}`)
        addLog('🚀 EXECUTING...')
        const proposalReq = buildProposal(signal, roundStake(currentStakeRef.current))
        const available = await wsRequest({ contracts_for: currentTarget.symbol, currency: 'USD' })
        if (!JSON.stringify(available.contracts_for || {}).includes(proposalReq.contract_type)) throw new Error(`Deriv does not offer ${proposalReq.contract_type} for ${currentTarget.name}. No trade was sent.`)
        const proposalRes = await wsRequest(proposalReq); if (!isRunningRef.current) break
        const entryCheck = validateEntryWindow(signal, { maxSignalAgeMs: 15000, proposalBudgetMs: 300, minimumRemainingMs: 250 }); if (!entryCheck.valid) { addLog(`Entry expired before purchase: ${entryCheck.reason}`); continue }
        const buyRes = await wsRequest({ buy: proposalRes.proposal.id, price: proposalRes.proposal.ask_price }); if (!isRunningRef.current) break
        addLog(`✅ Contract: ${buyRes.buy.contract_id}`)
        
        const contractResult = await monitorContract(buyRes.buy.contract_id); if (!contractResult) break
        const profit = parseFloat(contractResult.profit || 0); const isWin = profit > 0
        const performance = recordContractOutcome(signal, { profit, stake: currentStakeRef.current, contractId: contractResult.contract_id, bot: 'Automated Bot' })
        if (performance) addLog(`Thamira history: ${performance.trades} settled for this exact setup; win rate ${performance.winRate === null ? 'n/a' : (performance.winRate * 100).toFixed(1) + '%'}.`)
        totalTradesRef.current += 1; sessionPLRef.current += profit
        
        if (isWin) {
          winsRef.current += 1; currentStakeRef.current = parseFloat(stake); recoveryIndex = 0
          lastFailedDirectionRef.current = null; consecutiveLossesRef.current = 0; recoveryStartTimeRef.current = null
    lastResearchNoticeRef.current = ''
          setCurrentStake(currentStakeRef.current)
          addLog(`✅ WON +$${profit.toFixed(2)} | Stake reset to base`)
        } else {
          lossesRef.current += 1; consecutiveLossesRef.current++
          lastFailedDirectionRef.current = tradeDirection; recoveryIndex++
          if (!recoveryStartTimeRef.current) recoveryStartTimeRef.current = Date.now();
          currentStakeRef.current = boundedNextStake(stake, currentStakeRef.current, martingaleFactor, consecutiveLossesRef.current)
          setCurrentStake(currentStakeRef.current)
          if (consecutiveLossesRef.current >= 2) addLog(`⚠️ ${consecutiveLossesRef.current} consecutive losses - continuing bounded recovery and rotating market`)
          addLog(`❌ LOST -$${profit.toFixed(2)} | Rotating to next market → Next: $${currentStakeRef.current.toFixed(2)}`)
        }
        
        setTotalTrades(totalTradesRef.current); setWins(winsRef.current); setLosses(lossesRef.current); setCurrentPL(sessionPLRef.current)
        if (sessionPLRef.current >= parseFloat(targetProfit)) { addLog(`🎯 TARGET HIT! $${sessionPLRef.current.toFixed(2)}`); setIsRunning(false); isRunningRef.current = false; break }
        if (sessionPLRef.current <= -parseFloat(stopLoss)) { addLog('🛑 STOP LOSS HIT!'); setIsRunning(false); isRunningRef.current = false; break }
        addLog(`📊 P/L: $${sessionPLRef.current.toFixed(2)} | Trades: ${totalTradesRef.current}`)
        await new Promise(r => setTimeout(r, 1000))
      } catch (error) { if (!isRunningRef.current) break; addLog(`❌ Error: ${error.message}`); await new Promise(r => setTimeout(r, 2000)) }
    }
  }

  const startBot = () => {
    setValidationError(''); if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }
    isRunningRef.current = true; setIsRunning(true); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0
    currentStakeRef.current = parseFloat(stake); historyLoadedRef.current = false; hasLoggedScanningRef.current = false; reconnectAttemptsRef.current = 0
    lastFailedDirectionRef.current = null; consecutiveLossesRef.current = 0; recoveryStartTimeRef.current = null
    setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setCurrentStake(parseFloat(stake)); setConfluenceScore(0); setLogs([])
    addLog('⚡ AUTOMATED BOT ACTIVATED (13 Markets | Hard Gates)'); addLog(`Type: ${tradeType} | Stake: $${stake} | Martingale: ${martingaleFactor}x`); addLog(`Target: $${targetProfit} | Stop: $${stopLoss}`); runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); addLog('⏹️ Stopped new entries; any open contract remains monitored until settlement.') }
  const resetBot = () => { if (isRunningRef.current) return; setLogs([]); setValidationError('') }
  const rules = TIMEFRAME_RULES[tradeType]; const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-green-500 rounded-lg flex items-center justify-center"><Zap size={16} className="text-white" /></div>
        <div><h2 className="text-base font-bold text-white">Automated Bot</h2><p className="text-[10px] text-gray-400 flex items-center gap-1"><ShieldCheck size={10} /> 13 Markets | Hard Gates</p></div>
      </div>
      {validationError && <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0"><AlertCircle size={12} className="text-red-500" /><p className="text-red-400 text-[10px] font-medium">{validationError}</p></div>}
      <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-orange-500" /> Parameters</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Type</label><select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{TRADE_TYPES.map(t => <option key={t} className="text-white">{t}</option>)}</select></div>
          {SUB_TRADE_TYPES[tradeType]?.length > 0 && <div><label className="text-[10px] text-gray-400 uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{SUB_TRADE_TYPES[tradeType].map(t => <option key={t} className="text-white">{t}</option>)}</select></div>}
        </div>
        {subTradeType && OPTIONS[subTradeType] && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-1">{OPTIONS[subTradeType].map(opt => <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-gray-700 text-gray-400'}`}>{opt}</button>)}</div></div>}
        {(tradeType === 'Digits' && subTradeType === 'Over/Under') && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Barrier/Digit</label><input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        {tradeType === 'Touch & No Touch' && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Barrier</label><input type="number" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Time</label>{rules.fixed ? <input type="text" value={rules.defaultUnit} disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-gray-500" /> : <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{rules.units.map(u => <option key={u} className="text-white">{u}</option>)}</select>}</div>
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Duration</label><input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || rules.fixed} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Stake</label><input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Martingale</label><input type="number" step="0.1" value={martingaleFactor} onChange={e => setMartingaleFactor(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Target</label><input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Stop Loss</label><input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
        </div>
      </div>
      <div className="bg-gray-900 rounded-lg p-2 border border-green-500/30 mb-2 flex-shrink-0">
        <h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-500" /> Performance</h3>
        <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Best Market:</span><span className="text-[10px] text-orange-400 font-bold">{bestMarket}</span></div>
        <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Confluence Score:</span><span className={`text-[10px] font-bold ${confluenceScore >= 70 ? 'text-green-400' : 'text-orange-400'}`}>{confluenceScore.toFixed(0)}%</span></div>
        <div className="grid grid-cols-4 gap-1 text-center mb-1">
          <div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">P/L</p><p className={`font-bold text-xs ${currentPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p></div>
          <div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Win Rate</p><p className="text-sky-400 font-bold text-xs">{winRate}%</p></div>
          <div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Trades</p><p className="text-white font-bold text-xs">{totalTrades}</p></div>
          <div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Next</p><p className="text-orange-400 font-bold text-xs">{currentStake.toFixed(2)}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-900/20 border border-green-500/30 rounded p-1 text-center"><p className="text-[9px] text-green-400 uppercase font-bold">Trades Won</p><p className="text-green-400 font-bold text-lg">{wins}</p></div>
          <div className="bg-red-900/20 border border-red-500/30 rounded p-1 text-center"><p className="text-[9px] text-red-400 uppercase font-bold">Trades Lost</p><p className="text-red-400 font-bold text-lg">{losses}</p></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2">
        <button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-black'}`}><Play size={14} /> Run</button>
        <button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}><Square size={14} /> Stop</button>
        <button onClick={resetBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning?'bg-gray-900 text-gray-600':'bg-gray-800 border border-gray-700 text-orange-400'}`}><RefreshCw size={14} /> Reset</button>
      </div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-gray-900 px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">EXECUTION LOG</span></div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{scrollBehavior: 'auto'}}>
          {logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') || log.includes('TARGET') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') || log.includes('Error') || log.includes('STOP') ? 'text-red-500' : log.includes('🚀') || log.includes('') || log.includes('🔬') || log.includes('⏳') || log.includes('') || log.includes('⚠️') ? 'text-sky-400' : log.includes('━━') ? 'text-gray-600' : 'text-gray-400'}>{log}</p>)}
        </div>
      </div>
    </div>
  )
}
