import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, Lock, Cpu } from 'lucide-react'

export default function AutoDAI() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const logRef = useRef(null)

  const handleLogin = () => {
    if (password === 'Denny@1249') {
      setIsAuthenticated(true)
      setLogs([
        '[System] AutoD AI Core initialized.',
        '[System] Password verified. Access granted.'
      ])
    } else {
      setError('Invalid Password')
    }
  }

  const addLog = (msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const handleRun = () => {
    setIsRunning(true)
    addLog('Analyzing last 50 digits for PRNG anomalies...')
    setTimeout(() => addLog('Pattern detected: Heavy clustering of 0, 1, 2.'), 1500)
    setTimeout(() => addLog('Decision: Execute "Over 2" on Volatility 100 (1s).'), 3000)
    setTimeout(() => addLog('Contract purchased. Confidence: 94%.'), 4500)
    setTimeout(() => addLog('Contract WON. Profit secured.'), 6000)
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-mwathe-darkgray rounded-2xl p-6 border border-mwathe-orange/30 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-mwathe-orange/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-mwathe-orange" size={32} />
          </div>
          <h2 className="text-xl font-bold text-mwathe-white mb-2">AutoD AI Security</h2>
          <p className="text-mwathe-gray text-sm mb-6">Enter password to access the AI core.</p>
          <input 
            type="password" 
            value={password}
            onChange={(e) => { 
              setPassword(e.target.value)
              setError('')
            }}
            className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-4 py-3 text-mwathe-white text-center text-lg mb-3 focus:border-mwathe-orange outline-none"
            placeholder="Enter Password"
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button 
            onClick={handleLogin}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-mwathe-orange to-mwathe-green text-white font-bold"
          >
            Unlock AI
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-mwathe-orange/20 rounded-lg flex items-center justify-center">
          <Cpu className="text-mwathe-orange" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-mwathe-white">The AutoD AI</h2>
          <p className="text-mwathe-gray text-xs">Specialized in Digits Over 2 / Under 8</p>
        </div>
      </div>

      {/* Parameters */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 space-y-3">
        <h3 className="text-mwathe-white font-bold text-sm">Parameters</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Stake ($)</label>
            <input 
              type="number" 
              defaultValue="0.35"
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm"
            />
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Target Profit ($)</label>
            <input 
              type="number" 
              defaultValue="20"
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm"
            />
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Stop Loss ($)</label>
            <input 
              type="number" 
              defaultValue="10"
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm"
            />
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Time Frame</label>
            <select className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm">
              <option>Ticks (1-10)</option>
            </select>
          </div>
        </div>
        <div className="bg-mwathe-black/50 rounded-lg p-2 text-center">
          <p className="text-mwathe-gray text-xs">Martingale Factor (Fixed)</p>
          <p className="text-mwathe-orange font-bold">1.5x</p>
        </div>
      </div>

      {/* Display Panel */}
      <div className="bg-black rounded-xl border border-mwathe-orange/30 overflow-hidden flex flex-col h-56">
        <div className="bg-mwathe-darkgray px-3 py-2 flex items-center gap-2 border-b border-gray-800">
          <Terminal size={14} className="text-mwathe-orange" />
          <span className="text-mwathe-orange text-xs font-bold">AI DECISION LOG</span>
        </div>
        <div 
          ref={logRef}
          className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1"
        >
          {logs.map((log, i) => (
            <p 
              key={i} 
              className={
                log.includes('WON') || log.includes('profit') ? 'text-mwathe-green' :
                log.includes('Decision') ? 'text-mwathe-skyblue' :
                'text-mwathe-gray'
              }
            >
              {log}
            </p>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={handleRun}
          disabled={isRunning}
          className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
            isRunning 
              ? 'bg-gray-700 text-gray-400' 
              : 'bg-mwathe-orange text-white'
          }`}
        >
          <Play size={18} />
          Run
        </button>
        <button 
          onClick={() => setIsRunning(false)}
          disabled={!isRunning}
          className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
            !isRunning 
              ? 'bg-gray-700 text-gray-400' 
              : 'bg-red-500 text-white'
          }`}
        >
          <Square size={18} />
          Stop
        </button>
        <button 
          onClick={() => { setIsRunning(false); setLogs([]) }}
          className="py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-mwathe-darkgray border border-gray-700 text-mwathe-white"
        >
          <RefreshCw size={18} />
          Reset
        </button>
      </div>
    </div>
  )
}
