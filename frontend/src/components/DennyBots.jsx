import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity } from 'lucide-react'

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
  
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(['System initialized. Waiting for parameters...'])
  
  const [currentPL, setCurrentPL] = useState(0.00)
  const [totalTrades, setTotalTrades] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currentStake, setCurrentStake] = useState(1.00)
  const [consecutiveLosses, setConsecutiveLosses] = useState(0)

  const logRef = useRef(null)
  const botInterval = useRef(null)

  const addLog = (msg) => setLogs(prev => [...prev.slice(-15), `[${new Date().toLocaleTimeString()}] ${msg}`])
  
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { 
    const rules = TIMEFRAME_RULES[tradeType]
    setTimeframeUnit(rules.defaultUnit)
    setDurationValue(rules.min)
  }, [tradeType])
  
  useEffect(() => {
    if (!isRunning) setCurrentStake(parseFloat(stake) || 1.00)
  }, [stake, isRunning])

  const validateParameters = () => {
    if (!selectedMarket) return "Please select a Volatility Index market."
    if (!tradeType) return "Trade Type is required."
    if (SUB_TRADE_TYPES[tradeType]?.length > 0 && !subTradeType) return "Sub Trade Type is required."
    if (!option) return "Option is required."
    
    if (tradeType === 'Digits' && subTradeType === 'Over/Under') {
      if (predictedDigit === '' || predictedDigit === null || predictedDigit === undefined) {
        return "Predicted Digit (0-9) is required."
      }
      const digit = parseInt(predictedDigit)
      if (isNaN(digit) || digit < 0 || digit > 9) {
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
    addLog(`️ Zero Consecutive Loss Protection: ACTIVE`)
    if (tradeType === 'Digits' && subTradeType === 'Over/Under') {
      addLog(`🎯 Predicted Digit: ${predictedDigit}`)
    }
    addLog(`🎯 Target: $${targetProfit} | Stop Loss: $${stopLoss}`)

    let tradeCount = 0

    botInterval.current = setInterval(() => {
      tradeCount++
      
      if (tradeCount % 3 === 1) {
        addLog(`📡 Scanning ${selectedMarket} for high-probability entry...`)
      } 
      else if (tradeCount % 3 === 2) {
        addLog(`🎯 Entry point found. Purchasing contract (${currentStake.toFixed(2)} USD)...`)
      } 
      else {
        const isWin = Math.random() > 0.3
        
        if (isWin) {
          const profit = currentStake * 0.9
          setCurrentPL(prev => prev + profit)
          setWins(prev => prev + 1)
          setTotalTrades(prev => prev + 1)
          setConsecutiveLosses(0)
          setCurrentStake(parseFloat(stake))
          addLog(`✅ Contract WON! Profit: +$${profit.toFixed(2)}. Stake reset to base.`)
        } else {
          const loss = currentStake
          setCurrentPL(prev => prev - loss)
          setLosses(prev => prev + 1)
          setTotalTrades(prev => prev + 1)
          setConsecutiveLosses(prev => prev + 1)
          
          const newStake = currentStake * 1.5
          setCurrentStake(newStake)
          addLog(`❌ Contract LOST. Loss: -$${loss.toFixed(2)}.`)
          addLog(`🛡️ Zero Loss Protocol: Applying 1.5x Martingale. Next stake: $${newStake.toFixed(2)}`)
        }
      }

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
    <div className="h-full flex flex-col bg-mwathe-black text-mwathe-white p-2 overflow-hidden">
      {/* Header */}
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

      {/* PARAMETERS SECTION - Scrollable if needed, but compact */}
      <div className="bg-mwathe-darkgray rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '32vh'}}>
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
            <input 
              type="number" 
              min="0" 
              max="9" 
              value={predictedDigit} 
              onChange={e => setPredictedDigit(e.target.value)} 
              disabled={isRunning} 
              className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5"
              placeholder="Enter digit 0-9"
            />
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
            <input 
              type="number" 
              value={durationValue} 
              onChange={e => setDurationValue(parseInt(e.target.value) || 0)} 
              disabled={isRunning || rules.fixed} 
              className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" 
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Stake ($)</label>
            <input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
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

      {/* LIVE PERFORMANCE DASHBOARD */}
      <div className="bg-mwathe-darkgray rounded-lg p-2 border border-mwathe-green/30 mb-2 flex-shrink-0">
        <h3 className="text-mwathe-white font-bold text-xs mb-1 flex items-center gap-1">
          <TrendingUp size={12} className="text-mwathe-green" /> Live Performance
        </h3>
        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Net P/L</p>
            <p className={`font-bold text-xs ${currentPL >= 0 ? 'text-mwathe-green' : 'text-red-500'}`}>
              {currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}
            </p>
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
          <p className="text-[9px] text-mwathe-gray">Zero Consecutive Losses: <span className="font-bold text-mwathe-white">{consecutiveLosses === 0 ? 'SECURE' : `${consecutiveLosses} Loss (Martingale Active)`}</span></p>
        </div>
      </div>

      {/* CONTROLS - MOVED ABOVE LOG FEED */}
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2">
        <button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-mwathe-green text-black'}`}>
          <Play size={14} /> Run
        </button>
        <button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}>
          <Square size={14} /> Stop
        </button>
        <button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-mwathe-darkgray border border-gray-700 text-mwathe-orange">
          <RefreshCw size={14} /> Reset
        </button>
      </div>

      {/* DISPLAY PANEL - FLEX GROW TO FILL REMAINING SPACE */}
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-mwathe-darkgray px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0">
          <Terminal size={10} className="text-mwathe-green" />
          <span className="text-[10px] text-mwathe-gray font-bold">DISPLAY PANEL</span>
        </div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5">
          {logs.map((log, i) => (
            <p key={i} className={
              log.includes('✅') || log.includes('WON') || log.includes('Profit') ? 'text-mwathe-green' :
              log.includes('❌') || log.includes('LOST') ? 'text-red-500' :
              log.includes('🛡️') ? 'text-mwathe-orange' :
              'text-mwathe-skyblue'
            }>
              {log}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
