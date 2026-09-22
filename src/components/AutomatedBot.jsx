import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity, Zap } from 'lucide-react'

// Only 5 markets for speed and accuracy
const SYMBOL_MAP = { 
  'Volatility 10 (1s) Index': 'R_10', 
  'Volatility 25 (1s) Index': 'R_25', 
  'Volatility 50 (1s) Index': 'R_50', 
  'Volatility 75 (1s) Index': 'R_75', 
  'Volatility 100 (1s) Index': 'R_100' 
}
const TRADE_TYPES = ['Digits']
const SUB_TRADE_TYPES = { 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'] }
const TIMEFRAME_RULES = { 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false } }

const ALLOWED_DIGITS_MARKETS = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100']
const roundStake = (v) => Math.round(v * 100) / 100

// TIGHTENED THRESHOLDS
const calcFastEntropy = (arr) => { const unique = new Set(arr.slice(-20)).size; return unique <= 3 ? 1.5 : 3.2 }
const calcFastMarkov = (digits, target) => { const matches = digits.slice(-20).filter(d => d === target).length; return matches >= 5 ? 0.45 : 0.10 }
const calcFastFrequency = (digits, target) => (digits.filter(d => d === target).length / digits.length) < 0.05
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
  const hasLoggedRecoveryRef = useRef(false)
  const cooldownActiveRef = useRef(false)

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
      } catch (err) { addLog(` Connection failed`) }
    }
    connectWS()
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [token, accountId])

  const loadAllHistory = () => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve()
      let loadedCount = 0
      const totalMarkets = Object.values(SYMBOL_MAP).length // Only 5 markets
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
      setTimeout(() => { historyLoadedRef.current = true; resolve() }, 3000) // Reduced to 3 seconds for 5 markets
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
    return 'CALL'
  }

  const calculateConfluence = (symbol, targetDigit) => {
    const ticks = tickDataRef.current[symbol]
    if (!ticks || ticks.length < 30) return { score: 50, signal: 'CALL', reasons: [] }
    let score = 50, reasons = [], signal = 'CALL'
    const digits = ticks.map(t => parseInt(t.toString().slice(-1)))
    const td = parseInt(targetDigit)
    
    if (tradeType === 'Digits') {
      if (calcFastMarkov(digits, td) > 0.40) { score += 20; reasons.push('m') }
      if (calcFastEntropy(digits) < 2.0) { score += 20; reasons.push('e') }
      if (calcFastFrequency(digits, td)) { score += 20; reasons.push('f') }
      signal = (option === 'Over' && td < 5) || (option === 'Under' && td > 4) ? 'CALL' : 'PUT'
    } else {
      const hurst = calcHurst(ticks)
      if (hurst > 0.65) { score += 30; reasons.push('h') }
      const rsi = calcRSI(ticks)
      if (rsi < 30 || rsi > 70) { score += 25; reasons.push('r') }
      signal = hurst > 0.5 ? 'CALL' : 'PUT'
    }
    return { score: Math.min(score, 99), signal, reasons }
  }

  const scanMarkets = () => {
    let bestSym = null, bestScore = -1, bestSignal = 'CALL', bestReasons = []
    const blacklisted = blacklistedMarketsRef.current
    Object.keys(SYMBOL_MAP).forEach(name => {
      const sym = SYMBOL_MAP[name]
      if (blacklisted.includes(sym)) return
      const res = calculateConfluence(sym, predictedDigit)
      // STRICT: Requires 3 strategies to align
      if (res.reasons.length >= 3 && res.score > bestScore) { 
        bestScore = res.score; bestSym = sym; bestSignal = res.signal; bestReasons = res.reasons 
      }
    })
    return bestSym ? { symbol: bestSym, score: bestScore, signal: bestSignal, reasons: bestReasons } : { symbol: null, score: 0, signal: 'CALL', reasons: [] }
  }

  const runTradeCycle = async () => {
    if (!historyLoadedRef.current) {
      addLog('🔬 Analyzing 5 markets...')
      await loadAllHistory()
    }
    let lastLossTime = 0
    while (isRunningRef.current) {
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { await new Promise(r => setTimeout(r, 2000)); continue }
        if (Date.now() - lastLossTime < 15000) { await new Promise(r => setTimeout(r, 2000)); continue }
        
        if (consecutiveLossesRef.current >= 2 && !cooldownActiveRef.current) {
          addLog('🛑 2 CONSECUTIVE LOSSES. 30-SECOND COOLDOWN...')
          cooldownActiveRef.current = true
          await new Promise(r => setTimeout(r, 30000))
          cooldownActiveRef.current = false
          continue
        }

        const best = scanMarkets()
        
        // SILENT RECOVERY: Logs exactly ONCE
        if (!best.symbol) { 
          if (consecutiveLossesRef.current > 0 && !hasLoggedRecoveryRef.current) {
            addLog(' RECOVERY MODE:  [O]')
            hasLoggedRecoveryRef.current = true
          }
          await new Promise(r => setTimeout(r, 2000)); continue 
        }
        
        setBestMarket(Object.keys(SYMBOL_MAP).find(key => SYMBOL_MAP[key] === best.symbol) || best.symbol)
        setConfluenceScore(best.score)
        addLog(`🎯 LOCKED: ${best.symbol} | Score: ${best.score}%`)
        addLog(' EXECUTING...')
        
        const proposalReq = { proposal: 1, amount: roundStake(currentStakeRef.current), basis: 'stake', contract_type: getContractType(), currency: 'USD', duration: durationValue, duration_unit: timeframeUnit === 'Minutes' ? 'm' : 't', underlying_symbol: best.symbol }
        if (tradeType === 'Digits' && subTradeType === 'Over/Under' && predictedDigit) proposalReq.barrier = predictedDigit
        
        const proposalRes = await wsRequest(proposalReq)
        if (!isRunningRef.current) break
        const buyRes = await wsRequest({ buy: proposalRes.proposal.id, price: proposalRes.proposal.ask_price })
        if (!isRunningRef.current) break
        
        addLog(`✅ Contract: ${buyRes.buy.contract_id}`)
        const contractResult = await monitorContract(buyRes.buy.contract_id)
        if (!isRunningRef.current || !contractResult) break
        
        const profit = parseFloat(contractResult.profit || 0)
        const isWin = profit > 0
        totalTradesRef.current += 1
        sessionPLRef.current += profit
        
        if (isWin) {
          winsRef.current += 1; consecutiveLossesRef.current = 0; currentStakeRef.current = parseFloat(stake)
          blacklistedMarketsRef.current = []
          hasLoggedRecoveryRef.current = false
          addLog(`✅ WON +$${profit.toFixed(2)}`)
          addLog('🟢 NORMAL MODE')
        } else {
          lossesRef.current += 1; consecutiveLossesRef.current += 1; lastLossTime = Date.now()
          if (!blacklistedMarketsRef.current.includes(best.symbol)) blacklistedMarketsRef.current.push(best.symbol)
          addLog(`🛡️ Blacklisted ${best.symbol}`)
          currentStakeRef.current = roundStake(currentStakeRef.current * (parseFloat(martingaleFactor) || 1.5))
          addLog(` LOST -$${profit.toFixed(2)} | Next: $${currentStakeRef.current.toFixed(2)}`)
        }
        
        setTotalTrades(totalTradesRef.current); setWins(winsRef.current); setLosses(lossesRef.current)
        setConsecutiveLosses(consecutiveLossesRef.current); setCurrentStake(currentStakeRef.current); setCurrentPL(sessionPLRef.current)
        
        if (sessionPLRef.current >= parseFloat(targetProfit)) { addLog(`🎯 TARGET HIT! $${sessionPLRef.current.toFixed(2)}`); setIsRunning(false); isRunningRef.current = false; break }
        if (sessionPLRef.current <= -parseFloat(stopLoss)) { addLog(' STOP LOSS HIT!'); setIsRunning(false); isRunningRef.current = false; break }
        
        addLog(`📊 P/L: $${sessionPLRef.current.toFixed(2)} | Trades: ${totalTradesRef.current}`)
        await new Promise(r => setTimeout(r, 1000))
      } catch (error) {
        if (!isRunningRef.current) break
        addLog(`❌ Error: ${error.message}`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

  const startBot = () => {
    setValidationError('')
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }
    isRunningRef.current = true; setIsRunning(true)
    sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0; consecutiveLossesRef.current = 0
    currentStakeRef.current = parseFloat(stake); blacklistedMarketsRef.current = []; historyLoadedRef.current = false
    hasLoggedRecoveryRef.current = false; cooldownActiveRef.current = false
    setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setConsecutiveLosses(0); setCurrentStake(parseFloat(stake)); setConfluenceScore(0); setLogs([])
    addLog('⚡ AUTOMATED BOT ACTIVATED (5 Markets)')
    addLog(`Type: ${tradeType} | Stake: $${stake} | Martingale: ${martingaleFactor}x`)
    addLog(`Target: $${targetProfit} | Stop: $${stopLoss}`)
    runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); if (wsRef.current) wsRef.current.send(JSON.stringify({ forget: 'all', req_id: reqIdRef.current++ })); addLog('⏹️ Stopped') }
  const resetBot = () => { stopBot(); setLogs(['System reset.']); setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setConsecutiveLosses(0); setCurrentStake(parseFloat(stake)); setValidationError(''); setConfluenceScore(0); setBestMarket('Scanning...'); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0; consecutiveLossesRef.current = 0; currentStakeRef.current = parseFloat(stake); blacklistedMarketsRef.current = []; historyLoadedRef.current = false; hasLoggedRecoveryRef.current = false; cooldownActiveRef.current = false }
  
  const rules = TIMEFRAME_RULES[tradeType]
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-green-500 rounded-lg flex items-center justify-center"><Zap size={16} className="text-white" /></div>
        <div><h2 className="text-base font-bold text-white">Automated Bot</h2><p className="text-[10px] text-gray-400 flex items-center gap-1"><ShieldCheck size={10} /> 5 Markets Only</p></div>
      </div>
      {validationError && <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0"><AlertCircle size={12} className="text-red-500" /><p className="text-red-400 text-[10px] font-medium">{validationError}</p></div>}
      <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-orange-500" /> Parameters</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Type</label><select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{TRADE_TYPES.map(t => <option key={t} className="text-white">{t}</option>)}</select></div>
          {SUB_TRADE_TYPES[tradeType]?.length > 0 && <div><label className="text-[10px] text-gray-400 uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{SUB_TRADE_TYPES[tradeType].map(t => <option key={t} className="text-white">{t}</option>)}</select></div>}
        </div>
        {subTradeType && OPTIONS[subTradeType] && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-1">{OPTIONS[subTradeType].map(opt => <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-gray-700 text-gray-400'}`}>{opt}</button>)}</div></div>}
        {tradeType === 'Digits' && subTradeType === 'Over/Under' && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Digit (0-9)</label><input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Time</label>{rules.fixed ? <input type="text" value={rules.label} disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-gray-500" /> : <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{rules.units.map(u => <option key={u} className="text-white">{u}</option>)}</select>}</div>
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
        <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Confluence Score:</span><span className={`text-[10px] font-bold ${confluenceScore >= 80 ? 'text-green-400' : 'text-orange-400'}`}>{confluenceScore.toFixed(0)}%</span></div>
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
        <button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-gray-800 border border-gray-700 text-orange-400"><RefreshCw size={14} /> Reset</button>
      </div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-gray-900 px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">EXECUTION LOG</span></div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{scrollBehavior: 'auto'}}>
          {logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') || log.includes('TARGET') || log.includes('NORMAL') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') || log.includes('Error') || log.includes('RECOVERY') || log.includes('COOLDOWN') ? 'text-red-500' : log.includes('🚀') || log.includes('🎯') || log.includes('🔬') || log.includes('🛡️') || log.includes('⏳') ? 'text-sky-400' : log.includes('⚠️') || log.includes('LOCKDOWN') ? 'text-orange-400' : log.includes('━━') ? 'text-gray-600' : 'text-gray-400'}>{log}</p>)}
        </div>
      </div>
    </div>
  )
}
