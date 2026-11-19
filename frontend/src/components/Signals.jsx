import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, AlertCircle } from 'lucide-react'

const formatValue = value => value === undefined || value === null || value === '' ? '—' : String(value)

export default function Signals({ signals = [], onReset = () => {} }) {
  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <div><h2 className="text-2xl font-bold text-mwathe-white">Signals</h2><p className="text-mwathe-gray text-sm">Live trade setups and entry details</p></div>
        <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-mwathe-darkgray border border-gray-700 text-mwathe-orange text-sm font-bold hover:bg-gray-800"><RefreshCw size={16}/>Reset</button>
      </div>
      {signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-mwathe-darkgray rounded-xl border border-gray-800"><AlertCircle className="text-mwathe-gray mb-3" size={40}/><p className="text-mwathe-gray text-center max-w-xs">No active signals. Start the Analysis Tool to scan live Deriv markets.</p></div>
      ) : (
        <div className="space-y-3"><AnimatePresence>{signals.map(signal => (
          <motion.div key={signal.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.9}} className="bg-mwathe-darkgray rounded-xl p-4 border border-mwathe-green/20 shadow-lg">
            <div className="flex justify-between items-start mb-3"><div><h3 className="text-mwathe-white font-bold text-lg">{formatValue(signal.market || signal.symbol)}</h3><p className="text-mwathe-gray text-xs">{formatValue(signal.tradeType)} • {formatValue(signal.subTradeType)} • <span className="text-mwathe-skyblue font-medium">{formatValue(signal.option)}</span></p></div><div className="text-right"><p className="text-mwathe-green font-bold text-lg">{formatValue(signal.setupScore ?? signal.confidence)}<span className="text-xs">/94</span></p><p className="text-mwathe-gray text-xs">Relative setup score</p></div></div>
            <div className="grid grid-cols-2 gap-3 bg-mwathe-black/50 rounded-lg p-3">
              <div><p className="text-mwathe-gray text-xs mb-1">Entry Point</p><p className="text-mwathe-white font-mono font-bold">{formatValue(signal.entryPoint ?? signal.entry)}</p></div>
              <div><p className="text-mwathe-gray text-xs mb-1">Contract Duration</p><p className="text-mwathe-skyblue font-bold">{formatValue(signal.contractDuration || (signal.duration ? `${signal.duration} ${signal.timeframeUnit || ''}` : null))}</p></div>
              <div><p className="text-mwathe-gray text-xs mb-1">Market Condition</p><p className="text-mwathe-orange font-medium text-sm">{formatValue(signal.marketCondition)}</p></div>
              {signal.tradeType === 'Digits' ? <div><p className="text-mwathe-gray text-xs mb-1">Predicted Digit / Barrier</p><p className="text-mwathe-white font-mono font-bold">{formatValue(signal.predictedDigit ?? signal.barrier)}</p></div> : <div><p className="text-mwathe-gray text-xs mb-1">Contract Barrier</p><p className="text-mwathe-white font-mono font-bold">{formatValue(signal.barrier)}</p></div>}
              {signal.entryDigit !== undefined && <div><p className="text-mwathe-gray text-xs mb-1">Entry Last Digit</p><p className="text-mwathe-white font-mono font-bold">{signal.entryDigit}</p></div>}
              <div><p className="text-mwathe-gray text-xs mb-1">Signal Age</p><p className="text-mwathe-white text-xs">{signal.createdAt ? `${Math.max(0,Math.floor((Date.now()-signal.createdAt)/1000))}s ago` : '—'}</p></div>
            </div>
          </motion.div>
        ))}</AnimatePresence></div>
      )}
    </div>
  )
}
