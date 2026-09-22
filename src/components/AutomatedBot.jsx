import { useState, useRef, useEffect } from 'react'
import { Play, Square, Terminal, Zap } from 'lucide-react'

const VOLATILITY_INDICES = ['Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index', 'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index']
const SYMBOL_MAP = { 'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10', 'Volatility 15 (1s) Index': 'R_15', 'Volatility 25 (1s) Index': 'R_25', 'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30', 'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50', 'Volatility 75 (1s) Index': 'R_75', 'Volatility 75 Index': 'R_75', 'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100', 'Volatility 100 Index': 'R_100' }
const TRADE_TYPES = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'], 'Multipliers': ['Multipliers'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Turbos': ['Up', 'Down', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks' }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto' }, 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false } }

const roundStake = (v) => Math.round(v * 100) / 100

const calcFastEntropy = (arr) => { const unique = new Set(arr.slice(-20)).size; return unique <= 3 ? 1.5 : 3.2 }
const calcFastMarkov = (digits, target) => { const matches = digits.slice(-20).filter(d => d === target).length; return matches >= 5 ? 0.45 : 0.10 }
const calcDormancy = (digits, target) => { const lastIdx = digits.lastIndexOf(target); return lastIdx === -1 ? 50 : digits.length - 1 - lastIdx }

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
  const subscribedSymbolsRef = useRef(new Set())

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
            if (msg.msg_type === 'tick') {
              const sym = msg.tick.symbol
              if (!tickDataRef.current[sym]) tickDataRef.current[sym] = []
              tickDataRef.current[sym] = [...tickDataRef.current[sym], msg.tick.quote].slice(-20)
            }
            if (msg.msg_type === 'balance' && onBalanceUpdate) onBalanceUpdate(parseFloat(msg.balance.balance))
          } catch (e) {}
        }
      } catch (err) { addLog(`Connection failed`) }
    }
    connectWS()
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [token, accountId])

  const findBestMarket = () => {
    let best = null
    let highestScore = 0

    for (const [sym, ticks] of Object.entries(tickDataRef.current)) {
      if (!ticks || ticks.length < 10) continue // Wait until at least 10 ticks accumulate continuously

      const digits = ticks.map(t => parseInt(t.toString().slice(-1)))
      const lastDigit = digits[digits.length - 1]
      
      const entropy = calcFastEntropy(digits)
      const markov = calcFastMarkov(digits, lastDigit)
      const dormancy = calcDormancy(digits, lastDigit)
      
      const score = (entropy > 2.0 ? 40 : 10) + (markov < 0.2 ? 40 : 10) + (dormancy > 10 ? 20 : 5)

      if (score > highestScore) {
        highestScore = score
        best = sym
      }
    }
    return { bestMarket: best, score: highestScore }
  }

  const executeTrade = (sym) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const reqId = reqIdRef.current++
    const stakeVal = currentStakeRef.current

    let proposal = {
      proposal: 1, amount: stakeVal, basis: 'stake', currency: 'USD',
      symbol: sym, duration: parseInt(durationValue) || 1, duration_unit: 't'
    }

    if (tradeType === 'Digits') {
      proposal.contract_type = option === 'Over' ? 'DIGITOVER' : option === 'Under' ? 'DIGITUNDER' : 'DIGITMATCH'
      proposal.barrier = String(predictedDigit)
    } else {
      proposal.contract_type = 'CALL'
    }

    const onProposalMsg = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.req_id === reqId && msg.proposal) {
          wsRef.current.removeEventListener('message', onProposalMsg)
          buyContract(msg.proposal.id, stakeVal)
        }
      } catch (e) {}
    }
    wsRef.current.addEventListener('message', onProposalMsg)
    wsRef.current.send(JSON.stringify({ ...proposal, req_id: reqId }))
  }

  const buyContract = (proposalId, stakeVal) => {
    const reqId = reqIdRef.current++
    const onBuyMsg = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.req_id === reqId && msg.buy) {
          wsRef.current.removeEventListener('message', onBuyMsg)
          addLog(`⚡ Trade Placed: ID ${msg.buy.contract_id} | Stake: $${stakeVal}`)
          monitorContract(msg.buy.contract_id, stakeVal)
        }
      } catch (e) {}
    }
    wsRef.current.addEventListener('message', onBuyMsg)
    wsRef.current.send(JSON.stringify({ buy: proposalId, price: stakeVal, req_id: reqId }))
  }

  const monitorContract = (contractId, stakeVal) => {
    const reqId = reqIdRef.current++
    const subId = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return clearInterval(subId)
      wsRef.current.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, req_id: reqId }))
    }, 1000)

    const onContractMsg = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.proposal_open_contract && msg.proposal_open_contract.contract_id === contractId) {
          const c = msg.proposal_open_contract
          if (c.is_sold) {
            clearInterval(subId)
            wsRef.current.removeEventListener('message', onContractMsg)
            handleTradeOutcome(c.profit, stakeVal)
          }
        }
      } catch (e) {}
    }
    wsRef.current.addEventListener('message', onContractMsg)
  }

  const handleTradeOutcome = (profit, stakeVal) => {
    const isWin = profit > 0
    totalTradesRef.current += 1
    sessionPLRef.current = roundStake(sessionPLRef.current + profit)
    
    setTotalTrades(totalTradesRef.current)
    setCurrentPL(sessionPLRef.current)

    if (isWin) {
      winsRef.current += 1
      setWins(winsRef.current)
      consecutiveLossesRef.current = 0
      setConsecutiveLosses(0)
      currentStakeRef.current = parseFloat(stake) || 1.00
      setCurrentStake(currentStakeRef.current)
      addLog(`✅ WIN: +$${profit.toFixed(2)}`)
    } else {
      lossesRef.current += 1
      setLosses(lossesRef.current)
      consecutiveLossesRef.current += 1
      setConsecutiveLosses(consecutiveLossesRef.current)
      
      const mf = parseFloat(martingaleFactor) || 1.5
      currentStakeRef.current = roundStake(currentStakeRef.current * mf)
      setCurrentStake(currentStakeRef.current)
      addLog(`❌ LOSS: -$${Math.abs(profit).toFixed(2)} | Martingale active`)
    }

    if (sessionPLRef.current >= (parseFloat(targetProfit) || 50)) {
      addLog(`🎯 Target Profit Reached! Stopping bot.`)
      stopBot()
    } else if (sessionPLRef.current <= -(parseFloat(stopLoss) || 20)) {
      addLog(`🛑 Stop Loss Reached! Stopping bot.`)
      stopBot()
    }
  }

  const startBot = () => {
    setIsRunning(true)
    isRunningRef.current = true
    sessionPLRef.current = 0.00
    totalTradesRef.current = 0
    winsRef.current = 0
    lossesRef.current = 0
    consecutiveLossesRef.current = 0
    setCurrentPL(0)
    setTotalTrades(0)
    setWins(0)
    setLosses(0)
    
    const initialS = parseFloat(stake) || 1.00
    setCurrentStake(initialS)
    currentStakeRef.current = initialS

    addLog('⚡ AUTOMATED BOT ACTIVATED')
    addLog(`Type: ${tradeType} | Stake: $${initialS} | Martingale: ${martingaleFactor}x`)
    addLog('📡 Subscribing to continuous tick streams across all markets...')

    // Subscribe to live ticks for all symbols immediately on start
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      Object.values(SYMBOL_MAP).forEach(sym => {
        if (!subscribedSymbolsRef.current.has(sym)) {
          subscribedSymbolsRef.current.add(sym)
          wsRef.current.send(JSON.stringify({ ticks: sym, subscribe: 1, req_id: reqIdRef.current++ }))
        }
      })
    }

    addLog('🔄 Collecting ticks continuously. Analyzing buffer...')
    runTradingLoop()
  }

  const runTradingLoop = () => {
    if (!isRunningRef.current) return

    const { bestMarket: foundMarket, score } = findBestMarket()
    
    if (foundMarket && score >= 60) {
      setBestMarket(foundMarket)
      setConfluenceScore(score)
      executeTrade(foundMarket)
    } else {
      setBestMarket('Collecting ticks...')
      setConfluenceScore(score)
    }

    setTimeout(runTradingLoop, 1500)
  }

  const stopBot = () => {
    setIsRunning(false)
    isRunningRef.current = false
    setBestMarket('Scanning...')
    setConfluenceScore(0)
    addLog('🛑 Automated Bot Stopped.')
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 shadow-lg">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3 text-emerald-400">
          <Zap className="w-5 h-5" /> Automated Bot Parameters
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-400">Trade Type</label>
            <select value={tradeType} onChange={(e) => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm mt-1">
              {TRADE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Sub Type</label>
            <select value={subTradeType} onChange={(e) => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm mt-1">
              {SUB_TRADE_TYPES[tradeType]?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Stake ($)</label>
            <input type="number" value={stake} onChange={(e) => setStake(e.target.value)} disabled={isRunning} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Martingale Factor</label>
            <input type="number" step="0.1" value={martingaleFactor} onChange={(e) => setMartingaleFactor(e.target.value)} disabled={isRunning} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm mt-1" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400">Best Market</div>
          <div className="text-sm font-bold text-cyan-400 truncate mt-1">{bestMarket}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400">Confluence Score</div>
          <div className="text-sm font-bold text-emerald-400 mt-1">{confluenceScore}%</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400">Session P/L</div>
          <div className={`text-sm font-bold mt-1 ${currentPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${currentPL.toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400">Win / Loss</div>
          <div className="text-sm font-bold mt-1 text-slate-200">{wins} / {losses}</div>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        {!isRunning ? (
          <button onClick={startBot} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition">
            <Play className="w-5 h-5" /> Run Bot
          </button>
        ) : (
          <button onClick={stopBot} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition">
            <Square className="w-5 h-5" /> Stop Bot
          </button>
        )}
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col min-h-[200px]">
        <div className="flex items-center gap-2 text-xs text-slate-400 border-b border-slate-800 pb-2 mb-2">
          <Terminal className="w-4 h-4" /> Execution Log
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto font-mono text-xs space-y-1 text-slate-300">
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
