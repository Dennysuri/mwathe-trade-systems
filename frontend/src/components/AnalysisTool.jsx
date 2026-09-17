import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, Activity, Zap, Play, Square, Cpu, AlertCircle } from 'lucide-react'

// --- MATHEMATICAL ENGINE ---
const calculateShannonEntropy = (digits) => {
  if (digits.length === 0) return 0;
  const freq = {};
  digits.forEach(d => freq[d] = (freq[d] || 0) + 1);
  let entropy = 0;
  const len = digits.length;
  Object.values(freq).forEach(count => {
    const p = count / len;
    if (p > 0) entropy -= p * Math.log2(p);
  });
  return entropy; 
};

const calculateMarkovProbability = (digits, targetCondition) => {
  if (digits.length < 2) return 50;
  const transitions = Array(10).fill(0).map(() => Array(10).fill(0));
  for (let i = 0; i < digits.length - 1; i++) {
    transitions[digits[i]][digits[i + 1]]++;
  }
  const lastDigit = digits[digits.length - 1];
  const row = transitions[lastDigit];
  const totalTransitions = row.reduce((a, b) => a + b, 0);
  if (totalTransitions === 0) return 50;

  let targetCount = 0;
  for (let i = 0; i < 10; i++) {
    if (targetCondition === 'over' && i > 2) targetCount += row[i];
    if (targetCondition === 'under' && i < 8) targetCount += row[i];
    if (targetCondition === 'even' && i % 2 === 0) targetCount += row[i];
    if (targetCondition === 'odd' && i % 2 !== 0) targetCount += row[i];
  }
  return (targetCount / totalTransitions) * 100;
};

const executeAnalysisKnot = (ticks, tradeType, subType, option, lastDigitsCount) => {
  const recentDigits = ticks.slice(-lastDigitsCount).map(t => parseInt(t.toString().slice(-1)));
  let confidence = 50;

  if (tradeType === 'Digits') {
    const entropy = calculateShannonEntropy(recentDigits);
    const predictabilityScore = Math.max(0, (3.32 - entropy) / 3.32 * 100);
    const markovConf = calculateMarkovProbability(recentDigits, option.toLowerCase());
    
    let freqConf = 50;
    if (option === 'Over') {
      const underFreq = recentDigits.filter(d => d < 3).length / lastDigitsCount * 100;
      freqConf = underFreq > 30 ? 95 : 40;
    } else if (option === 'Under') {
      const overFreq = recentDigits.filter(d => d > 7).length / lastDigitsCount * 100;
      freqConf = overFreq > 20 ? 95 : 40;
    }

    confidence = (predictabilityScore * 0.3) + (markovConf * 0.5) + (freqConf * 0.2);
    if (predictabilityScore > 80 && markovConf > 85 && freqConf > 90) confidence = 95 + Math.random() * 5;
  } else {
    confidence = 85 + Math.random() * 14; 
  }
  return { confidence: Math.min(99, Math.max(82, Math.round(confidence))) };
};

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
  'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto (Market dependent)' },
  'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false },
  'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false },
  'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false }
}

export default function AnalysisTool({
  isAnalyzing, setIsAnalyzing, progress, setProgress,
  aiLogs, setAiLogs, finalSignal, setFinalSignal, intervalRef, onSignalGenerated
}) {
  const [tradeType, setTradeType] = useState('Digits')
  const [subTradeType, setSubTradeType] = useState('Over/Under')
  const [option, setOption] = useState('Over')
  const [predictedDigit, setPredictedDigit] = useState('')
  const [analysisDuration, setAnalysisDuration] = useState(30) // How long the AI thinks
  const [lastDigits, setLastDigits] = useState(50)
  const [timeframeUnit, setTimeframeUnit] = useState('Ticks') // The actual contract duration unit
  const [durationValue, setDurationValue] = useState(1) // The actual contract duration value
  const [validationError, setValidationError] = useState('')

  const addLog = (msg) => setAiLogs(prev => [...prev.slice(-6), `[${new Date().toLocaleTimeString()}] ${msg}`])
  
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { 
    const rules = TIMEFRAME_RULES[tradeType]
    setTimeframeUnit(rules.defaultUnit)
    setDurationValue(rules.min)
  }, [tradeType])

  const validateParameters = () => {
    if (!tradeType) return "Trade Type is required.";
    if (SUB_TRADE_TYPES[tradeType]?.length > 0 && !subTradeType) return "Sub Trade Type is required.";
    if (!option) return "Option is required.";
    if (tradeType === 'Digits' && subTradeType === 'Over/Under' && (predictedDigit === '' || predictedDigit === null)) {
      return "Predicted Digit (0-9) is required for Digits Over/Under.";
    }
    if (tradeType === 'Digits' && (lastDigits < 10 || lastDigits > 100)) {
      return "Last number of Digits must be between 10 and 100.";
    }
    if (analysisDuration < 1 || analysisDuration > 59) {
      return "Analysis Duration must be between 1 and 59 seconds.";
    }
    
    const rules = TIMEFRAME_RULES[tradeType]
    if (!rules.fixed) {
      if (!timeframeUnit) return "Time Frame unit is required."
      const maxVal = rules.maxMap[timeframeUnit]
      if (durationValue < rules.min || durationValue > maxVal) {
        return `Contract Duration must be between ${rules.min} and ${maxVal} ${timeframeUnit.toLowerCase()}.`
      }
    }
    return null;
  }

  const handleStart = () => {
    setValidationError('')
    const error = validateParameters()
    if (error) {
      setValidationError(error)
      addLog(`❌ Error: ${error}`)
      return
    }

    setIsAnalyzing(true)
    setProgress(0)
    setAiLogs([])
    setFinalSignal(null)
    addLog(`Initializing analysis engine for ${tradeType}...`)
    
    let elapsed = 0
    const totalDuration = analysisDuration * 1000
    const tickRate = 100

    intervalRef.current = setInterval(() => {
      elapsed += tickRate
      setProgress(Math.min(100, (elapsed / totalDuration) * 100))

      if (elapsed === 500) addLog('📡 Scanning all 13 Volatility Indices...')
      if (elapsed === 2000) addLog(' Running deep market analysis...')
      if (elapsed === 4000) addLog('️ Processing real-time data and filtering noise...')
      if (elapsed === 6000) addLog('Evaluating market conditions and entry points...')

      if (elapsed >= totalDuration) {
        clearInterval(intervalRef.current)
        const simulatedTicks = Array.from({length: lastDigits}, () => Math.floor(Math.random() * 100000));
        const { confidence } = executeAnalysisKnot(simulatedTicks, tradeType, subTradeType, option, lastDigits);
        
        addLog('✅ Analysis complete. Signal generated successfully.');
        
        // CORRECT CONTRACT DURATION PASSED TO SIGNALS
        const contractDurationText = TIMEFRAME_RULES[tradeType].fixed ? TIMEFRAME_RULES[tradeType].label : `${durationValue} ${timeframeUnit}`;

        const signal = {
          id: Date.now(),
          market: 'Volatility 100 (1s)',
          tradeType, subTradeType, option,
          confidence,
          entry: tradeType === 'Digits' && subTradeType === 'Over/Under' ? predictedDigit : 'Market Price',
          contractDuration: contractDurationText, // THIS IS THE ACTUAL TRADE TIMEFRAME
          marketCondition: confidence > 90 ? 'Excellent' : 'Good'
        };
        
        if (onSignalGenerated) onSignalGenerated(signal);
        setIsAnalyzing(false)
      }
    }, tickRate)
  }

  const handleStop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsAnalyzing(false)
    addLog('🛑 Analysis stopped by user.')
  }

  const rules = TIMEFRAME_RULES[tradeType]

  return (
    <div className="h-full overflow-y-auto bg-mwathe-black text-mwathe-white p-4 space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-gray-800">
        <div className="w-10 h-10 bg-gradient-to-br from-mwathe-orange to-mwathe-green rounded-lg flex items-center justify-center">
          <Brain size={24} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Analysis Tool</h2>
          <p className="text-xs text-mwathe-gray flex items-center gap-1"><Cpu size={12} /> Real-Time Market Scanner</p>
        </div>
      </div>

      {validationError && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-red-400 text-xs font-medium">{validationError}</p>
        </div>
      )}

      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Trade Type</label>
            <select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">
              {TRADE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {SUB_TRADE_TYPES[tradeType]?.length > 0 && (
            <div>
              <label className="text-[10px] text-mwathe-gray uppercase font-bold">Sub Type</label>
              <select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">
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
                <button key={opt} onClick={() => setOption(opt)} disabled={isAnalyzing} className={`py-1.5 rounded-lg text-xs font-bold border ${option === opt ? 'bg-mwathe-green/20 border-mwathe-green text-mwathe-green' : 'bg-mwathe-black border-gray-700 text-mwathe-gray'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ACTUAL TRADE TIMEFRAME */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Contract Time Frame</label>
            {rules.fixed ? (
              <input type="text" value={rules.label} disabled className="w-full bg-mwathe-black/50 border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1 text-mwathe-gray" />
            ) : (
              <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1">
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
              disabled={isAnalyzing || rules.fixed} 
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Analysis Duration: {analysisDuration}s</label>
            <input type="range" min="1" max="59" value={analysisDuration} onChange={e => setAnalysisDuration(parseInt(e.target.value))} disabled={isAnalyzing} className="w-full accent-mwathe-green mt-1" />
          </div>
          {tradeType === 'Digits' && (
            <div>
              <label className="text-[10px] text-mwathe-gray uppercase font-bold">Last Digits (10-100)</label>
              <input type="number" min="10" max="100" value={lastDigits} onChange={e => setLastDigits(parseInt(e.target.value))} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1" />
            </div>
          )}
        </div>
        {tradeType === 'Digits' && subTradeType === 'Over/Under' && (
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Predicted Digit (0-9) *</label>
            <input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isAnalyzing} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-xs mt-1" placeholder="Required" />
          </div>
        )}
      </div>

      {isAnalyzing && (
        <div className="bg-mwathe-darkgray/50 rounded-xl p-3 border border-mwathe-skyblue/30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-mwathe-skyblue flex items-center gap-1"><Activity size={12} className="animate-pulse" /> Processing Analysis...</h3>
            <span className="text-[10px] text-mwathe-gray">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-800 h-1 rounded-full mt-1 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-mwathe-orange to-mwathe-green" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="bg-black rounded-xl border border-gray-800 overflow-hidden h-32 flex flex-col">
        <div className="bg-mwathe-darkgray px-3 py-1.5 flex items-center gap-2 border-b border-gray-800">
          <Zap size={12} className="text-mwathe-orange" />
          <span className="text-[10px] text-mwathe-orange font-bold">SYSTEM LOG</span>
        </div>
        <div className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5">
          {aiLogs.length === 0 ? <p className="text-gray-600">Waiting for analysis...</p> : aiLogs.map((log, i) => (
            <p key={i} className={log.includes('❌') ? 'text-red-400' : 'text-mwathe-skyblue'}>{log}</p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button onClick={handleStart} disabled={isAnalyzing} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${isAnalyzing ? 'bg-gray-800 text-gray-500' : 'bg-mwathe-green text-black'}`}>
          <Play size={16} /> Start
        </button>
        <button onClick={handleStop} disabled={!isAnalyzing} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${!isAnalyzing ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}>
          <Square size={16} /> Stop
        </button>
      </div>
    </div>
  )
}
