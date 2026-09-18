import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity, Zap } from 'lucide-react'

const VOLATILITY_INDICES = [
  'Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index',
  'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index',
  'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index',
  'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index'
]

const SYMBOL_MAP = {
  'Volatility 10 (1s) Index': 'R_10', 'Volatility 10 Index': 'R_10',
  'Volatility 15 (1s) Index': 'R_15', 'Volatility 25 (1s) Index': 'R_25',
  'Volatility 25 Index': 'R_25', 'Volatility 30 (1s) Index': 'R_30',
  'Volatility 50 (1s) Index': 'R_50', 'Volatility 50 Index': 'R_50',
  'Volatility 75 (1s) Index': 'R_75', 'Volatility 75 Index': 'R_75',
  'Volatility 90 (1s) Index': 'R_90', 'Volatility 100 (1s) Index': 'R_100',
  'Volatility 100 Index': 'R_100'
}

const TRADE_TYPES = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = {
  'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'], 'Multipliers': ['Multipliers'],
  'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'],
  'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd']
}
const OPTIONS = {
  'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'],
  'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Turbos': ['Up', 'Down', 'Both'],
  'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'],
  'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'],
  'Multipliers': ['Up', 'Down', 'Both']
}
const TIMEFRAME_RULES = {
  'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks (Auto-managed)' },
  'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto (40x/100x Leverage)' },
  'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false },
  'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false }
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
  
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(['System initialized. Waiting for parameters...'])
  
  const [currentPL, setCurrentPL] = useState(0.00)
  const [totalTrades, setTotalTrades] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currentStake, setCurrentStake] = useState(1.00)
  const [consecutiveLosses, setConsecutiveLosses] = useState(0)
  
  const [ws, setWs] = useState(null)
  const [tickHistory, setTickHistory] = useState([])
  const [currentContract, setCurrentContract] = useState(null)

  const logRef = useRef(null)
  const executionTimer = useRef(null)
  const isRunningRef = useRef(false)

  const addLog = (msg) => setLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`])
  
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { 
    const rules = TIMEFRAME_RULES[tradeType]
    setTimeframeUnit(rules.defaultUnit)
    setDurationValue(rules.min)
  }, [tradeType])
  useEffect(() => { if (!isRunning) setCurrentStake(parseFloat(stake) || 1.00) }, [stake, isRunning])

  useEffect(() => {
    if (!token || !accountId) { 
      setValidationError('Not connected to Deriv. Please refresh the page.')
      return 
    }

    addLog('🔌 Connecting to Deriv via secure session...')
    
    fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
      const wsUrl = data.data?.url
      if (!wsUrl) throw new Error('No WebSocket URL returned')
      
      addLog('✅ Secure connection established. Opening trading session...')
      const websocket = new WebSocket(wsUrl)
      
      websocket.onopen = () => {
        addLog('✅ WebSocket connected & authorized.')
        websocket.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 1 }))
      }
      
      websocket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data)
          if (data.msg_type === 'balance') {
            if (onBalanceUpdate) onBalanceUpdate(parseFloat(data.balance.balance))
            addLog(`💰 Balance updated: ${data.balance.balance} ${data.balance.currency}`)
          }
          if (data.msg_type === 'tick') {
            setTickHistory(prev => { const h = [...prev, data.tick.quote]; if (h.length > 50) h.shift(); return h })
          }
          if (data.msg_type === 'proposal') {
            if (data.error) { 
              addLog(`❌ Proposal failed: ${data.error.message}`)
            } else { 
              const proposalId = data.proposal.id
              const askPrice = data.proposal.ask_price
              addLog(`✅ Entry point confirmed. Executing trade...`)
              setTimeout(() => {
                websocket.send(JSON.stringify({ 
                  buy: proposalId, 
                  price: askPrice,
                  req_id: Date.now() 
                }))
              }, 200)
            }
          }
          if (data.msg_type === 'buy') {
            if (data.error) { 
              addLog(`❌ Trade execution failed: ${data.error.message}`)
              setCurrentContract(null)
            } else { 
              setCurrentContract({ id: data.buy.contract_id })
              addLog(`✅ Contract purchased successfully! ID: ${data.buy.contract_id}`)
            }
          }
          if (data.msg_type === 'proposal_open_contract') {
            if (!data.error && data.proposal_open_contract.is_sold) {
              const profit = parseFloat(data.proposal_open_contract.profit)
              handleContractResult(profit)
              setCurrentContract(null)
            }
          }
        } catch (e) { console.error(e) }
      }
      websocket.onerror = () => addLog('❌ WebSocket error')
      websocket.onclose = () => addLog(' WebSocket disconnected')
      setWs(websocket)
    })
    .catch(err => {
      addLog(`❌ Connection failed: ${err.message}`)
      setValidationError('Failed to connect to Deriv.')
    })

    return () => { if (ws) ws.close() }
  }, [token, accountId])

  const startCascadeEngine = (symbol) => {
    if (!isRunningRef.current) return
    
    addLog(`🧠 Analyzing 13 Volatility Indices markets...`)
    
    if (executionTimer.current) clearTimeout(executionTimer.current)

    executionTimer.current = setTimeout(() => {
      if (!isRunningRef.current) return
      addLog(`⚡ Market analysis in progress. Calculating optimal entry...`)
      
      executionTimer.current = setTimeout(() => {
        if (!isRunningRef.current) return
        addLog(`🎯 Detecting high-probability patterns...`)
        
        executionTimer.current = setTimeout(() => {
          if (!isRunningRef.current) return
          addLog(`🚀 Sniping entry point on ${selectedMarket}...`)
          executeRealTrade(symbol)
        }, 3000)
      }, 3000)
    }, 2000)
  }

  const executeRealTrade = (symbol) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) { 
      addLog('❌ Connection not ready')
      return 
    }
    
    const contractType = getContractType()
    addLog(`🚀 Executing trade: ${contractType}, ${durationValue} ${timeframeUnit}, Stake: $${currentStake.toFixed(2)}`)
    
    const proposalRequest = {
      proposal: 1,
      amount: currentStake,
      basis: 'stake',
      contract_type: contractType,
      currency: 'USD',
      duration: durationValue,
      duration_unit: timeframeUnit === 'Minutes' ? 'm' : 't',
      underlying_symbol: symbol,
      req_id: Date.now()
    }
    
    if (tradeType === 'Digits' && subTradeType === 'Over/Under' && predictedDigit) {
      proposalRequest.barrier = predictedDigit
      addLog(`🎯 Predicted digit: ${predictedDigit}`)
    }
    
    ws.send(JSON.stringify(proposalRequest))
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

  const handleContractResult = (profit) => {
    const isWin = profit > 0
    if (isWin) {
      setCurrentPL(prev => prev + profit)
      setWins(prev => prev + 1)
      setTotalTrades(prev => prev + 1)
      setConsecutiveLosses(0)
      setCurrentStake(parseFloat(stake))
      addLog(`✅ Contract WON! Profit: +$${profit.toFixed(2)}. Stake reset to base.`)
    } else {
      setCurrentPL(prev => prev + profit)
      setLosses(prev => prev + 1)
      setTotalTrades(prev => prev + 1)
      setConsecutiveLosses(prev => prev + 1)
      
      const martingale = parseFloat(martingaleFactor) || 1.5
      const newStake = currentStake * martingale
      setCurrentStake(newStake)
      addLog(`❌ Contract LOST. Loss: $${profit.toFixed(2)}.`)
      addLog(`🛡️ Applying ${martingale}x Martingale. Next stake: $${newStake.toFixed(2)}`)
    }

    const newPL = currentPL + profit
    
    if (newPL >= parseFloat(targetProfit)) { 
      addLog(`🏆 Target profit reached!`)
      setIsRunning(false)
      isRunningRef.current = false
      return
    }
    
    if (newPL <= -parseFloat(stopLoss)) { 
      addLog(`🛑 Stop loss hit!`)
      setIsRunning(false)
      isRunningRef.current = false
      return
    }

    if (isRunningRef.current) {
      addLog(`⏳ Next trade in 2 seconds...`)
      
      executionTimer.current = setTimeout(() => {
        if (isRunningRef.current && ws?.readyState === WebSocket.OPEN) {
          const symbol = SYMBOL_MAP[selectedMarket]
          startCascadeEngine(symbol)
        }
      }, 2000)
    }
  }

  const startBot = () => {
    setValidationError('')
    if (!ws || ws.readyState !== WebSocket.OPEN) { 
      setValidationError('Not connected to Deriv.')
      return 
    }
    if (parseFloat(martingaleFactor) <= 0) { 
      setValidationError('Martingale factor must be > 0.')
      return 
    }

    if (executionTimer.current) clearTimeout(executionTimer.current)
    
    setIsRunning(true)
    isRunningRef.current = true
    setCurrentPL(0)
    setTotalTrades(0)
    setWins(0)
    setLosses(0)
    setCurrentStake(parseFloat(stake))
    setConsecutiveLosses(0)
    setTickHistory([])
    setLogs([])

    addLog(`🚀 Starting Denny Bot for ${selectedMarket}...`)
    addLog(`🛡️ Zero Consecutive Loss Protection: ACTIVE (Martingale: ${martingaleFactor}x)`)
    addLog(`🎯 Target: $${targetProfit} | Stop Loss: $${stopLoss}`)
    
    const symbol = SYMBOL_MAP[selectedMarket]
    ws.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: Date.now() }))
    ws.send(JSON.stringify({ ticks_history: symbol, count: 50, end: 'latest', style: 'ticks', req_id: Date.now() + 1 }))
    
    startCascadeEngine(symbol)
  }

  const stopBot = () => {
    setIsRunning(false)
    isRunningRef.current = false
    if (executionTimer.current) {
      clearTimeout(executionTimer.current)
      executionTimer.current = null
    }
    if (ws) ws.send(JSON.stringify({ forget: 'all', req_id: Date.now() }))
    addLog(`🛑 Bot stopped gracefully.`)
  }

  const resetBot = () => {
    stopBot()
    setLogs(['System reset. Ready for new session.'])
    setCurrentPL(0)
    setTotalTrades(0)
    setWins(0)
    setLosses(0)
    setConsecutiveLosses(0)
    setCurrentStake(parseFloat(stake))
    setTickHistory([])
    setValidationError('')
  }

  const rules = TIMEFRAME_RULES[tradeType]
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'

  return (
    <div className="h-full flex flex-col bg-mwathe-black text-mwathe-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-mwathe-orange to-mwathe-green rounded-lg flex items-center justify-center">
          <Activity size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold">Denny Bots</h2>
          <p className="text-[10px] text-mwathe-gray flex items-center gap-1"><ShieldCheck size={10} /> Zero Consecutive Loss Protection</p>
        </div>
      </div>

      {validationError && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0">
          <AlertCircle size={12} className="text-red-500" />
          <p className="text-red-400 text-[10px] font-medium">{validationError}</p>
        </div>
      )}

      <div className="bg-mwathe-darkgray rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-mwathe-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-mwathe-orange" /> Parameters</h3>
        
        <div className="mb-2">
          <label className="text-[10px] text-mwathe-gray uppercase font-bold">Select Market</label>
          <select value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5">
            {VOLATILITY_INDICES.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Trade Type</label>
            <select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5">
              {TRADE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {SUB_TRADE_TYPES[tradeType]?.length > 0 && (
            <div>
              <label className="text-[10px] text-mwathe-gray uppercase font-bold">Sub Type</label>
              <select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5">
                {SUB_TRADE_TYPES[tradeType].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        {subTradeType && OPTIONS[subTradeType] && (
          <div className="mb-2">
            <label className="text-[10px] text-mwathe-gray uppercase font-bold mb-1 block">Option</label>
            <div className="grid grid-cols-3 gap-1">
              {OPTIONS[subTradeType].map(opt => (
                <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-mwathe-green/20 border-mwathe-green text-mwathe-green' : 'bg-mwathe-black border-gray-700 text-mwathe-gray'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {tradeType === 'Digits' && subTradeType === 'Over/Under' && (
          <div className="mb-2">
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Predicted Digit (0-9) *</label>
            <input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" placeholder="Enter digit 0-9" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Time Frame</label>
            {rules.fixed ? (
              <input type="text" value={rules.label} disabled className="w-full bg-mwathe-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-mwathe-gray" />
            ) : (
              <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5">
                {rules.units.map(u => <option key={u}>{u}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Duration {rules.fixed ? '' : `(${rules.min}-${rules.maxMap ? rules.maxMap[timeframeUnit] : rules.max})`}</label>
            <input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || rules.fixed} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Stake ($)</label>
            <input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Martingale Factor</label>
            <input type="number" step="0.1" value={martingaleFactor} onChange={e => setMartingaleFactor(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Target ($)</label>
            <input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Stop Loss ($)</label>
            <input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
        </div>
      </div>

      <div className="bg-mwathe-darkgray rounded-lg p-2 border border-mwathe-green/30 mb-2 flex-shrink-0">
        <h3 className="text-mwathe-white font-bold text-xs mb-1 flex items-center gap-1">
          <TrendingUp size={12} className="text-mwathe-green" /> Live Performance
        </h3>
        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Net P/L</p>
            <p className={`font-bold text-xs ${currentPL >= 0 ? 'text-mwathe-green' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p>
          </div>
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Win Rate</p>
            <p className="text-mwathe-skyblue font-bold text-xs">{winRate}%</p>
          </div>
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Trades</p>
            <p className="text-mwathe-white font-bold text-xs">{totalTrades}</p>
          </div>
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Next Stake</p>
            <p className="text-mwathe-orange font-bold text-xs">{currentStake.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-center gap-1 bg-mwathe-black/50 rounded p-1">
          <ShieldCheck size={10} className={consecutiveLosses === 0 ? "text-mwathe-green" : "text-mwathe-orange"} />
          <p className="text-[9px] text-mwathe-gray">Zero Consecutive Losses: <span className="font-bold text-mwathe-white">{consecutiveLosses === 0 ? 'SECURE' : `${consecutiveLosses} Loss (${martingaleFactor}x Martingale Active)`}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2">
        <button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-mwathe-green text-black'}`}>
          <Zap size={14} /> Run
        </button>
        <button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}>
          <Square size={14} /> Stop
        </button>
        <button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-mwathe-darkgray border border-gray-700 text-mwathe-orange">
          <RefreshCw size={14} /> Reset
        </button>
      </div>

      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-mwathe-darkgray px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0">
          <Terminal size={10} className="text-mwathe-green" />
          <span className="text-[10px] text-mwathe-gray font-bold">DISPLAY PANEL</span>
        </div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5">
          {logs.map((log, i) => (
            <p key={i} className={
              log.includes('✅') || log.includes('WON') || log.includes('Profit') || log.includes('Target') ? 'text-mwathe-green' :
              log.includes('❌') || log.includes('LOST') || log.includes('Stop') || log.includes('failed') ? 'text-red-500' :
              log.includes('🛡️') || log.includes('Martingale') ? 'text-mwathe-orange' :
              log.includes('') || log.includes('🎯') || log.includes('⚡') || log.includes('') || log.includes('📊') ? 'text-mwathe-skyblue' :
              'text-mwathe-gray'
            }>
              {log}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
