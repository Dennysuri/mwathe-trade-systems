import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, AlertCircle } from 'lucide-react'

export default function Signals({ signals, onReset }) {
  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-mwathe-white">Signals</h2>
          <p className="text-mwathe-gray text-sm">Real-time analysis results</p>
        </div>
        <button 
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-mwathe-darkgray border border-gray-700 text-mwathe-orange text-sm font-bold hover:bg-gray-800"
        >
          <RefreshCw size={16} />
          Reset
        </button>
      </div>

      {signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-mwathe-darkgray rounded-xl border border-gray-800">
          <AlertCircle className="text-mwathe-gray mb-3" size={40} />
          <p className="text-mwathe-gray text-center max-w-xs">
            No active signals. Start an analysis in the Analysis Tool to generate signals with 95-100% confidence.
          </p>
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
                    <h3 className="text-mwathe-white font-bold text-lg">{signal.market}</h3>
                    <p className="text-mwathe-gray text-xs">
                      {signal.tradeType} • {signal.subTradeType} • <span className="text-mwathe-skyblue font-medium">{signal.option}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-mwathe-green font-bold text-lg">{signal.confidence}%</p>
                    <p className="text-mwathe-gray text-xs">Confidence</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 bg-mwathe-black/50 rounded-lg p-3">
                  <div>
                    <p className="text-mwathe-gray text-xs mb-1">Entry Point</p>
                    <p className="text-mwathe-white font-mono font-bold">{signal.entry}</p>
                  </div>
                  <div>
                    <p className="text-mwathe-gray text-xs mb-1">Contract Duration</p>
                    <p className="text-mwathe-skyblue font-bold">{signal.contractDuration}</p>
                  </div>
                  <div>
                    <p className="text-mwathe-gray text-xs mb-1">Market Condition</p>
                    <p className="text-mwathe-orange font-medium text-sm">{signal.marketCondition}</p>
                  </div>
                  <div>
                    <p className="text-mwathe-gray text-xs mb-1">Signal Accuracy</p>
                    <p className="text-mwathe-green font-bold">{signal.confidence}%</p>
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
