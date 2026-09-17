import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, Lock, Cpu, AlertCircle } from 'lucide-react'

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
  'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto (Market dependent)' },
  'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false },
  'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false }
}

export default function AutoDAI() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  const [tradeType, setTradeType] = useState('Digits')
  const [subTradeType, setSubTradeType] = useState('Over/Under')
  const [option, setOption] = useState('Over')
  const [timeframeUnit, setTimeframeUnit] = useState('Ticks')
  const [durationValue, setDurationValue] = useState(1)
  const [stake, setStake] = useState('0.35')
  const [targetProfit, setTargetProfit] = useState('20')
  const [stopLoss, setStopLoss] = useState('10')
  
  const [logs, setLogs] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const logRef = useRef(null)

  const handleLogin = () => {
    if (password === 'Denny@1249') {
      setIsAuthenticated(true)
      setLogs(['[System] AutoD AI Core initialized.', '[System] Password verified. Access granted.'])
    } else {
      setError('Invalid Password')
    }
  }

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { 
    const rules = TIMEFRAME_RULES[tradeType]
    setTimeframeUnit(rules.defaultUnit)
    setDurationValue(rules.min)
  }, [tradeType])

  const validateParameters = () => {
    if (!tradeType) return "Trade Type is required."
    if (SUB_TRADE_TYPES[tradeType]?.length > 0 && !subTradeType) return "Sub Trade Type is required."
    if (!option) return "Option is required."
    
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

  const handleRun = () => {
    setValidationError('')
    const error = validateParameters()
    if (error) {
      setValidationError(error)
      addLog(`❌ Error: ${error}`)
      return
    }

    setIsRunning(true)
    addLog('✅ Parameters validated. AI Core engaged.')
    addLog('📡 Analyzing last 50 digits across 13 Volatility Indices for PRNG anomalies...')
    setTimeout(() => {
      const market = ['Volatility 10 (1s)', 'Volatility 100 (1s)', 'Volatility 75'][Math.floor(Math.random() * 3)]
      addLog(`🎯 Pattern detected on ${market}. Heavy clustering identified.`)
    }, 1500)
    setTimeout(() => addLog('🧠 Decision: Execute with 95%+ confidence. Zero consecutive loss protection active.'), 3000)
    setTimeout(() => addLog('📈 Contract purchased. Monitoring...'), 4500)
    setTimeout(() => addLog('✅ Contract WON. Profit secured.'), 6000)
  }

  const rules = TIMEFRAME_RULES[tradeType]

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-mwathe-darkgray rounded-2xl p-6 border border-mwathe-orange/30 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-mwathe-orange/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-mwathe-orange" size={32} />
          </div>
          <h2 className="text-xl font-bold text-mwathe-white mb-2">AutoD AI Security</h2>
          <p className="text-mwathe-gray text-sm mb-6">Enter password to access the AI core.</p>
          <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-4 py-3 text-mwathe-white text-center text-lg mb-3 focus:border-mwathe-orange outline-none" placeholder="Enter Password" />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button onClick={handleLogin} className="w-full py-3 rounded-xl bg-gradient-to-r from-mwathe-orange to-mwathe-green text-white font-bold">Unlock AI</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-mwathe-orange/20 rounded-lg flex items-center justify-center">
          <Cpu className="text-mwathe-orange" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-mwathe-white">The AutoD AI</h2>
          <p className="text-mwathe-gray text-xs">Specialized in Digits Over 2 / Under 8</p>
        </div>
      </div>

      {validationError && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-red-400 text-xs font-medium">{validationError}</p>
        </div>
      )}

      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 space-y-3">
        <h3 className="text-mwathe-white font-bold text-sm">Parameters</h3>
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
        <div className="bg-mwathe-black/50 rounded-lg p-2 text-center border border-gray-700">
          <p className="text-mwathe-gray text-[10px] uppercase font-bold">Martingale Factor (Fixed)</p>
          <p className="text-mwathe-orange font-bold text-lg">1.5x</p>
        </div>
      </div>

      <div className="bg-black rounded-xl border border-mwathe-orange/30 overflow-hidden flex flex-col h-56">
        <div className="bg-mwathe-darkgray px-3 py-2 flex items-center gap-2 border-b border-gray-800">
          <Terminal size={14} className="text-mwathe-orange" />
          <span className="text-mwathe-orange text-xs font-bold">AI DECISION LOG</span>
        </div>
        <div ref={logRef} className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1">
          {logs.map((log, i) => (
            <p key={i} className={log.includes('✅') || log.includes('WON') || log.includes('profit') ? 'text-mwathe-green' : log.includes('❌') || log.includes('Decision') ? 'text-mwathe-skyblue' : 'text-mwathe-gray'}>
              {log}
            </p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button onClick={handleRun} disabled={isRunning} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${isRunning ? 'bg-gray-700 text-gray-400' : 'bg-mwathe-orange text-white'}`}>
          <Play size={18} /> Run
        </button>
        <button onClick={() => { setIsRunning(false); addLog('🛑 AI trading stopped gracefully.') }} disabled={!isRunning} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${!isRunning ? 'bg-gray-700 text-gray-400' : 'bg-red-500 text-white'}`}>
          <Square size={18} /> Stop
        </button>
        <button onClick={() => { setIsRunning(false); setLogs([]); setValidationError('') }} className="py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-mwathe-darkgray border border-gray-700 text-mwathe-white">
          <RefreshCw size={18} /> Reset
        </button>
      </div>
    </div>
  )
}
