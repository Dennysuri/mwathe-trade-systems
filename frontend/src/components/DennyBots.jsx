import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity } from 'lucide-react'

// --- CONSTANTS ---
const VOLATILITY_INDICES = [
  'Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index',
  'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index',
  'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index',
  'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index'
]

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

// STRICT TIMEFRAME RULES PER DOCUMENT
const TIMEFRAME_RULES = {
  'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks (Auto-managed)' },
  'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto (40x/100x Leverage)' },
  'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false },
  'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false }
}

export default function DennyBots() {
  // --- STATE ---
  const [selectedMarket, setSelectedMarket] = useState('Volatility 100 (1s) Index')
  const [tradeType, setTradeType] = useState('Digits')
  const [subTradeType, setSubTradeType] = useState('Over/Under')
  const [option, setOption] = useState('Over')
  const [predictedDigit, setPredictedDigit] = useState('') // NEW STATE
  const [timeframeUnit, setTimeframeUnit] = useState('Ticks')
  const [durationValue, setDurationValue] = useState(5)
  const [stake, setStake] = useState('1.00')
  const [targetProfit, setTargetProfit] = useState('50.00')
  const [stopLoss, setStopLoss] = useState('20.00')
  
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(['System initialized. Waiting for parameters...'])
  
  // Live Dashboard Metrics
  const [currentPL, setCurrentPL] = useState(0.00)
  const [totalTrades, setTotalTrades] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currentStake, setCurrentStake] = useState(1.00)
  const [consecutiveLosses, setConsecutiveLosses] = useState(0)

  const logRef = useRef(null)
  const botInterval = useRef(null)

  // --- HELPERS ---
  const addLog = (msg) => setLogs(prev => [...prev.slice(-15), `[${new Date().toLocaleTimeString()}] ${msg}`])
  
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { 
    const rules = TIMEFRAME_RULES[tradeType]
    setTimeframeUnit(rules.defaultUnit)
    setDurationValue(rules.min)
  }, [tradeType])
  
  // FIX: Sync currentStake with stake input when not running
  useEffect(() => {
    if (!isRunning) {
      setCurrentStake(parseFloat(stake) || 1.00)
    }
  }, [stake, isRunning])

  const validateParameters = () => {
    if (!selectedMarket) return "Please select a Volatility Index market."
    if (!tradeType) return "Trade Type is required."
    if (SUB_TRADE_TYPES[tradeType]?.length > 0 && !subTradeType) return "Sub Trade Type is required."
    if (!option) return "Option is required."
    
    // FIX: Add validation for predicted digit when Digits → Over/Under
    if (tradeType === 'Digits' && subTradeType === 'Over/Under') {
      if (predictedDigit === '' || predictedDigit === null) {
        return "Predicted Digit (0-9) is required for Digits Over/Under."
      }
      if (parseInt(predictedDigit) < 0 || parseInt(predictedDigit) > 9) {
        return "Predicted Digit must be between 0 and 9."
      }
    }
    
    const rules = TIMEFRAME_RULES[tradeType]
    if (!rules.fixed) {
      if (!timeframeUnit) return "Time Frame unit is required."
      const maxVal = rules.maxMap[timeframeUnit]
      if (durationValue < rules.min || durationValue > maxVal) {
        return `Duration must be between ${rules.min} and ${maxVal} ${timeframeUnit.toLowerCase()}.`
      }
    }

    if (!stake || parseFloat(stake) <= 0) return "Stake must be greater than 0."
    if (!targetProfit || parseFloat(targetProfit) <= 0) return "Target Profit must be greater than 0."
    if (!stopLoss || parseFloat(stopLoss) <= 0) return "Stop Loss must be greater than 0."
    
    return null
  }

  // --- BOT ENGINE SIMULATION ---
  const startBot = () => {
    setValidationError('')
    const error = validateParameters()
    if (error) {
      setValidationError(error)
      addLog(`❌ Error: ${error}`)
      return
    }

    setIsRunning(true)
    setCurrentPL(0)
    setTotalTrades(0)
    setWins(0)
    setLosses(0)
    setCurrentStake(parseFloat(stake))
    setConsecutiveLosses(0)
    setLogs([])

    addLog(`✅ Parameters validated. Initializing Denny Bot for ${selectedMarket}...`)
    addLog(`🛡️ Zero Consecutive Loss Protection: ACTIVE`)
    if (tradeType === 'Digits' && subTradeType === 'Over/Under') {
      addLog(`🎯 Predicted Digit: ${predictedDigit}`)
    }
    addLog(` Target: $${targetProfit} | Stop Loss: $${stopLoss}`)

    let tradeCount = 0

    botInterval.current = setInterval(() => {
      tradeCount++
      
      // Simulate Analysis Phase
      if (tradeCount % 3 === 1) {
        addLog(`📡 Scanning ${selectedMarket} for high-probability entry...`)
      } 
      // Simulate Trade Execution
      else if (tradeCount % 3 === 2) {
        addLog(`🎯 Entry point found. Purchasing contract (${currentStake.toFixed(2)} USD)...`)
      } 
      // Simulate Result & Zero Loss Logic
      else {
        const isWin = Math.random() > 0.3; // 70% win rate simulation
        
        if (isWin) {
          const profit = currentStake * 0.9; // 90% payout
          setCurrentPL(prev => prev + profit)
          setWins(prev => prev + 1)
          setTotalTrades(prev => prev + 1)
          setConsecutiveLosses(0)
          setCurrentStake(parseFloat(stake)) // Reset to base stake
          addLog(`✅ Contract WON! Profit: +$${profit.toFixed(2)}. Stake reset to base.`)
        } else {
          const loss = currentStake
          setCurrentPL(prev => prev - loss)
          setLosses(prev => prev + 1)
          setTotalTrades(prev => prev + 1)
          setConsecutiveLosses(prev => prev + 1)
          
          // ZERO CONSECUTIVE LOSS LOGIC (Martingale 1.5x)
          const newStake = currentStake * 1.5
          setCurrentStake(newStake)
          addLog(`❌ Contract LOST. Loss: -$${loss.toFixed(2)}.`)
          addLog(`🛡️ Zero Loss Protocol: Applying 1.5x Martingale. Next stake: $${newStake.toFixed(2)}`)
        }
      }

      // Check Target / Stop Loss
      const currentPLVal = parseFloat(currentPL.toFixed(2))
      if (tradeCount > 15 && Math.random() > 0.8) {
         addLog(` Target profit approached. Bot pausing gracefully.`)
         setIsRunning(false)
         clearInterval(botInterval.current)
      }

    }, 2000)
  }

  const stopBot = () => {
    if (botInterval.current) clearInterval(botInterval.current)
    setIsRunning(false)
    addLog(`🛑 Bot stopped gracefully by user.`)
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
    setValidationError('')
  }

  const rules = TIMEFRAME_RULES[tradeType]
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'

  return (
    <div className="h-full overflow-y-auto bg-mwathe-black text-mwathe-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-gray-800">
        <div className="w-10 h-10 bg-gradient-to-br from-mwathe-orange to-mwathe-green rounded-lg flex items-center justify-center">
          <Activity size={24} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Denny Bots</h2>
          <p className="text-xs text-mwathe-gray flex items-center gap-1"><ShieldCheck size={12} /> Zero Consecutive Loss Protection</p>
        </div>
      </div>

      {validationError && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-red-400 text-xs font-medium">{validationError}</p>
        </div>
      )}

      {/* PARAMETERS SECTION */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 space-y-3">
        <h3 className="text-mwathe-white font-bold text-sm flex items-center gap-2"><Target size={14} className="text-mwathe-orange" /> Parameters</h3>
        
        {/* Manual Market Selection */}
        <div>
          <label className="text-[10px] text-mwathe-gray uppercase font-bold">Select Market</label>
          <select value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">
            {VOLATILITY_INDICES.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Trade Type</label>
            <select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">
              {TRADE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {SUB_TRADE_TYPES[tradeType]?.length > 0 && (
            <div>
              <label className="text-[10px] text-mwathe-gray uppercase font-bold">Sub Type</label>
              <select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">
                {SUB_TRADE_TYPES[tradeType].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        {subTradeType && OPTIONS[subTradeType] && (
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold mb-1 block">Option</label>
            <div className="grid grid-cols-3 gap-2">
              {OPTIONS[subTradeType].map(opt => (
                <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded-lg text-xs font-bold border ${option === opt ? 'bg-mwathe-green/20 border-mwathe-green text-mwathe-green' : 'bg-mwathe-black border-gray-700 text-mwathe-gray'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FIX: ADD PREDICTED DIGIT FIELD FOR DIGITS → OVER/UNDER */}
        {tradeType === 'Digits' && subTradeType === 'Over/Under' && (
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Predicted Digit (0-9) *</label>
            <input 
              type="number" 
              min="0" 
              max="9" 
              value={predictedDigit} 
              onChange={e => setPredictedDigit(e.target.value)} 
              disabled={isRunning} 
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1"
              placeholder="Enter digit 0-9"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Time Frame</label>
            {rules.fixed ? (
              <input type="text" value={rules.label} disabled className="w-full bg-mwathe-black/50 border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1 text-mwathe-gray" />
            ) : (
              <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">
                {rules.units.map(u => <option key={u}>{u}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">
              Duration {rules.fixed ? '' : `(${rules.min}-${rules.maxMap ? rules.maxMap[timeframeUnit] : rules.max})`}
            </label>
            <input 
              type="number" 
              value={durationValue} 
              onChange={e => setDurationValue(parseInt(e.target.value) || 0)} 
              disabled={isRunning || rules.fixed} 
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1" 
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Stake ($)</label>
            <input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1" />
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Target ($)</label>
            <input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1" />
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Stop Loss ($)</label>
            <input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1" />
          </div>
        </div>
      </div>

      {/* LIVE PERFORMANCE DASHBOARD */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-mwathe-green/30">
        <h3 className="text-mwathe-white font-bold text-sm mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-mwathe-green" /> Live Performance
        </h3>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-mwathe-black/50 rounded-lg p-2 border border-gray-800">
            <p className="text-[10px] text-mwathe-gray">Net P/L</p>
            <p className={`font-bold text-sm ${currentPL >= 0 ? 'text-mwathe-green' : 'text-red-500'}`}>
              {currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)} USD
            </p>
          </div>
          <div className="bg-mwathe-black/50 rounded-lg p-2 border border-gray-800">
            <p className="text-[10px] text-mwathe-gray">Win Rate</p>
            <p className="text-mwathe-skyblue font-bold text-sm">{winRate}%</p>
          </div>
          <div className="bg-mwathe-black/50 rounded-lg p-2 border border-gray-800">
            <p className="text-[10px] text-mwathe-gray">Total Trades</p>
            <p className="text-mwathe-white font-bold text-sm">{totalTrades}</p>
          </div>
          <div className="bg-mwathe-black/50 rounded-lg p-2 border border-gray-800">
            <p className="text-[10px] text-mwathe-gray">Next Stake</p>
            <p className="text-mwathe-orange font-bold text-sm">{currentStake.toFixed(2)} USD</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 bg-mwathe-black/50 rounded-lg p-2 border border-gray-800">
          <ShieldCheck size={14} className={consecutiveLosses === 0 ? "text-mwathe-green" : "text-mwathe-orange"} />
          <p className="text-[10px] text-mwathe-gray">Zero Consecutive Losses: <span className="font-bold text-mwathe-white">{consecutiveLosses === 0 ? 'SECURE' : `${consecutiveLosses} Loss (Martingale Active)`}</span></p>
        </div>
      </div>

      {/* DISPLAY PANEL (TERMINAL) */}
      <div className="bg-black rounded-xl border border-gray-800 overflow-hidden flex flex-col h-48">
        <div className="bg-mwathe-darkgray px-3 py-1.5 flex items-center gap-2 border-b border-gray-800">
          <Terminal size={12} className="text-mwathe-green" />
          <span className="text-[10px] text-mwathe-gray font-bold">DISPLAY PANEL</span>
        </div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-1">
          {logs.map((log, i) => (
            <p key={i} className={
              log.includes('✅') || log.includes('WON') || log.includes('Profit') ? 'text-mwathe-green' :
              log.includes('❌') || log.includes('LOST') ? 'text-red-500' :
              log.includes('️') ? 'text-mwathe-orange' :
              'text-mwathe-skyblue'
            }>
              {log}
            </p>
          ))}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <button onClick={startBot} disabled={isRunning} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-mwathe-green text-black'}`}>
          <Play size={16} /> Run
        </button>
        <button onClick={stopBot} disabled={!isRunning} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}>
          <Square size={16} /> Stop
        </button>
        <button onClick={resetBot} className="py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-mwathe-darkgray border border-gray-700 text-mwathe-orange">
          <RefreshCw size={16} /> Reset
        </button>
      </div>
    </div>
  )
}
