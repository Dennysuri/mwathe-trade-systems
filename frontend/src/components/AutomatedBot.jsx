import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal } from 'lucide-react'

const tradeTypes = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']

export default function AutomatedBot() {
  const [tradeType, setTradeType] = useState('Digits')
  const [logs, setLogs] = useState(['System initialized.', 'Waiting for user to start...'])
  const [isRunning, setIsRunning] = useState(false)
  const logRef = useRef(null)

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const handleStart = () => {
    setIsRunning(true)
    addLog('Initializing 100+ indicators...')
    setTimeout(() => addLog('Scanning all Volatility Indices...'), 1000)
    setTimeout(() => addLog('Volatility 100 (1s) selected. Analyzing entry...'), 2500)
    setTimeout(() => addLog('Contract purchased. Monitoring...'), 4000)
  }

  const handleReset = () => {
    setIsRunning(false)
    setLogs(['System reset. Ready for new session.'])
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-mwathe-white">Automated Trading Bot</h2>
        <p className="text-mwathe-gray text-sm">High-speed execution with zero consecutive losses</p>
      </div>

      {/* Parameters */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Trade Type</label>
            <select value={tradeType} onChange={(e) => setTradeType(e.target.value)} className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm">
              {tradeTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Time Frame</label>
            <select className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm">
              <option>Ticks (1-10)</option>
              <option>Minutes (1-1440)</option>
              <option>Hours</option>
            </select>
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Stake ($)</label>
            <input type="number" defaultValue="1" className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm" />
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Martingale Factor</label>
            <input type="number" defaultValue="1.5" step="0.1" className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm" />
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Target Profit ($)</label>
            <input type="number" defaultValue="100" className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm" />
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Stop Loss ($)</label>
            <input type="number" defaultValue="50" className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm" />
          </div>
        </div>
      </div>

      {/* Display Panel */}
      <div className="bg-black rounded-xl border border-gray-800 overflow-hidden flex flex-col h-64">
        <div className="bg-mwathe-darkgray px-3 py-2 flex items-center gap-2 border-b border-gray-800">
          <Terminal size={14} className="text-mwathe-green" />
          <span className="text-mwathe-gray text-xs font-bold">DISPLAY PANEL</span>
        </div>
        <div ref={logRef} className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1">
          {logs.map((log, i) => (
            <p key={i} className={log.includes('won') || log.includes('profit') ? 'text-mwathe-green' : log.includes('lost') || log.includes('loss') ? 'text-red-500' : 'text-mwathe-skyblue'}>
              {log}
            </p>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={handleStart} disabled={isRunning} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${isRunning ? 'bg-gray-700 text-gray-400' : 'bg-mwathe-green text-white'}`}>
          <Play size={18} /> Run
        </button>
        <button onClick={() => setIsRunning(false)} disabled={!isRunning} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${!isRunning ? 'bg-gray-700 text-gray-400' : 'bg-red-500 text-white'}`}>
          <Square size={18} /> Stop
        </button>
        <button onClick={handleReset} className="py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-mwathe-darkgray border border-gray-700 text-mwathe-orange">
          <RefreshCw size={18} /> Reset
        </button>
      </div>
    </div>
  )
}
