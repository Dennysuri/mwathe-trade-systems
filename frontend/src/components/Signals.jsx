import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react'

export default function Signals() {
  const [signals, setSignals] = useState([
    { id: 1, asset: 'Volatility 100 (1s)', type: 'Digits', subType: 'Over/Under', option: 'Over', entry: '5', accuracy: '87%', condition: 'Strong Uptrend' },
    { id: 2, asset: 'Volatility 75', type: 'Ups & Downs', subType: 'Rise/Fall', option: 'Rise', entry: '1245.50', accuracy: '82%', condition: 'Bullish Momentum' }
  ])

  const resetSignals = () => setSignals([])

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-mwathe-white">Signals</h2>
          <p className="text-mwathe-gray text-sm">Real-time analysis results</p>
        </div>
        <button 
          onClick={resetSignals}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-mwathe-darkgray border border-gray-700 text-mwathe-orange text-sm font-bold hover:bg-gray-800"
        >
          <RefreshCw size={16} /> Reset
        </button>
      </div>

      {signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-mwathe-darkgray rounded-xl border border-gray-800">
          <AlertCircle className="text-mwathe-gray mb-3" size={40} />
          <p className="text-mwathe-gray text-center">No active signals. Start an analysis to generate signals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {signals.map((signal) => (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-mwathe-darkgray rounded-xl p-4 border border-mwathe-green/20 shadow-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-mwathe-white font-bold text-lg">{signal.asset}</h3>
                    <p className="text-mwathe-gray text-xs">{signal.type} • {signal.subType} • <span className="text-mwathe-skyblue font-medium">{signal.option}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-mwathe-green font-bold text-lg">{signal.accuracy}</p>
                    <p className="text-mwathe-gray text-xs">Confidence</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 bg-mwathe-black/50 rounded-lg p-3">
                  <div>
                    <p className="text-mwathe-gray text-xs mb-1">Entry Point</p>
                    <p className="text-mwathe-white font-mono font-bold">{signal.entry}</p>
                  </div>
                  <div>
                    <p className="text-mwathe-gray text-xs mb-1">Market Condition</p>
                    <p className="text-mwathe-orange font-medium text-sm">{signal.condition}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
