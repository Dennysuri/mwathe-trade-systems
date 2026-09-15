import { useState } from 'react'
import { Play, Square, Activity, AlertCircle, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'

const tradeTypes = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']

const subTradeTypes = {
  'Accumulators': [],
  'Vanillas': ['Call/Put'],
  'Turbos': ['Turbos'],
  'Multipliers': ['Multipliers'],
  'Ups & Downs': ['Rise/Fall', 'Higher/Lower'],
  'Touch & No Touch': ['Touch/No Touch'],
  'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd']
}

const options = {
  'Over/Under': ['Over', 'Under', 'Both'],
  'Even/Odd': ['Even', 'Odd', 'Both'],
  'Matches/Differs': ['Matches', 'Differs', 'Both'],
  'Turbos': ['Up', 'Down', 'Both'],
  'Rise/Fall': ['Rise', 'Fall', 'Both'],
  'Higher/Lower': ['Higher', 'Lower', 'Both'],
  'Touch/No Touch': ['Touch', 'No Touch', 'Both'],
  'Call/Put': ['Call', 'Put', 'Both'],
  'Multipliers': ['Up', 'Down', 'Both']
}

export default function AnalysisTool() {
  const [tradeType, setTradeType] = useState('Digits')
  const [subTradeType, setSubTradeType] = useState('Over/Under')
  const [option, setOption] = useState('Over')
  const [predictedDigit, setPredictedDigit] = useState('')
  const [analysisDuration, setAnalysisDuration] = useState(30)
  const [lastDigits, setLastDigits] = useState(50)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedMarket, setSelectedMarket] = useState(null)

  const handleStartAnalysis = () => {
    setIsAnalyzing(true)
    setTimeout(() => setSelectedMarket('Volatility 100 (1s)'), 2000)
  }

  const handleStopAnalysis = () => {
    setIsAnalyzing(false)
    setSelectedMarket(null)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-mwathe-white">Analysis Tool</h2>
        <p className="text-mwathe-gray text-sm">Real-time market analysis with 100+ indicators</p>
      </div>

      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 space-y-4">
        <h3 className="text-mwathe-white font-bold flex items-center gap-2">
          <BarChart3 size={18} className="text-mwathe-orange" />
          Parameters
        </h3>

        <div>
          <label className="text-mwathe-gray text-xs block mb-2">Trade Type</label>
          <select value={tradeType} onChange={(e) => setTradeType(e.target.value)} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm">
            {tradeTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        {subTradeTypes[tradeType]?.length > 0 && (
          <div>
            <label className="text-mwathe-gray text-xs block mb-2">Sub Trade Type</label>
            <select value={subTradeType} onChange={(e) => setSubTradeType(e.target.value)} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm">
              {subTradeTypes[tradeType].map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        )}

        {options[subTradeType] && (
          <div>
            <label className="text-mwathe-gray text-xs block mb-2">Option</label>
            <div className="space-y-2">
              {options[subTradeType].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="option" value={opt} checked={option === opt} onChange={(e) => setOption(e.target.value)} className="w-4 h-4 text-mwathe-green" />
                  <span className="text-mwathe-white text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {tradeType === 'Digits' && subTradeType === 'Over/Under' && (
          <div>
            <label className="text-mwathe-gray text-xs block mb-2">Predicted Digit (0-9)</label>
            <input type="number" min="0" max="9" value={predictedDigit} onChange={(e) => setPredictedDigit(e.target.value)} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm" placeholder="Enter digit..." />
          </div>
        )}

        <div>
          <label className="text-mwathe-gray text-xs block mb-2">Analysis Duration (seconds)</label>
          <input type="number" min="1" max="59" value={analysisDuration} onChange={(e) => setAnalysisDuration(parseInt(e.target.value))} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm" />
        </div>

        {tradeType === 'Digits' && (
          <div>
            <label className="text-mwathe-gray text-xs block mb-2">Last Number of Digits to Analyze</label>
            <input type="number" min="10" max="100" value={lastDigits} onChange={(e) => setLastDigits(parseInt(e.target.value))} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleStartAnalysis} disabled={isAnalyzing} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold ${isAnalyzing ? 'bg-gray-700 text-gray-400' : 'bg-gradient-to-r from-mwathe-green to-mwathe-skyblue text-white'}`}>
          <Play size={18} /> Start
        </button>
        <button onClick={handleStopAnalysis} disabled={!isAnalyzing} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold ${!isAnalyzing ? 'bg-gray-700 text-gray-400' : 'bg-gradient-to-r from-red-500 to-red-600 text-white'}`}>
          <Square size={18} /> Stop
        </button>
      </div>

      {isAnalyzing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-mwathe-darkgray rounded-xl p-4 border border-mwathe-green/30">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="text-mwathe-green animate-pulse" size={20} />
            <span className="text-mwathe-white font-bold">Analysis in Progress</span>
          </div>
          {selectedMarket ? (
            <div className="space-y-2">
              <p className="text-mwathe-gray text-sm">Selected Market: <span className="text-mwathe-skyblue font-bold">{selectedMarket}</span></p>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-mwathe-orange to-mwathe-green h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
              </div>
            </div>
          ) : (
            <p className="text-mwathe-gray text-sm">Scanning all volatility indices...</p>
          )}
        </motion.div>
      )}
    </div>
  )
}
