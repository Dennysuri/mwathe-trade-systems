import { useState } from 'react'
import { Play, Square, TrendingUp, Activity, DollarSign } from 'lucide-react'

const subTradeTypes = [
  'Rise/Fall',
  'Higher/Lower',
  'Over/Under',
  'Matches/Differs',
  'Even/Odd',
  'Touch/No Touch',
  'Call/Put',
  'Turbos',
  'Multipliers',
  'Accumulators'
]

export default function DennyBots() {
  const [selectedBot, setSelectedBot] = useState('Over/Under')
  const [isRunning, setIsRunning] = useState(false)
  const [stake, setStake] = useState('1')
  const [targetProfit, setTargetProfit] = useState('50')
  const [stopLoss, setStopLoss] = useState('20')

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-mwathe-white">Denny Bots</h2>
        <p className="text-mwathe-gray text-sm">Specialized bots with zero consecutive losses</p>
      </div>

      {/* Bot Selector */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
        <label className="text-mwathe-gray text-xs block mb-2">Select Specialized Bot</label>
        <select 
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
          className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm"
        >
          {subTradeTypes.map(type => (
            <option key={type} value={type}>{type} Bot</option>
          ))}
        </select>
      </div>

      {/* Parameters */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 space-y-3">
        <h3 className="text-mwathe-white font-bold text-sm">Bot Parameters</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Stake ($)</label>
            <input 
              type="number" 
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm"
            />
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Target ($)</label>
            <input 
              type="number" 
              value={targetProfit}
              onChange={(e) => setTargetProfit(e.target.value)}
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm"
            />
          </div>
          <div>
            <label className="text-mwathe-gray text-xs block mb-1">Stop Loss ($)</label>
            <input 
              type="number" 
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-2 py-2 text-mwathe-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => setIsRunning(true)}
          disabled={isRunning}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold ${
            isRunning 
              ? 'bg-gray-700 text-gray-400' 
              : 'bg-gradient-to-r from-mwathe-green to-mwathe-skyblue text-white'
          }`}
        >
          <Play size={18} />
          Start Bot
        </button>
        <button 
          onClick={() => setIsRunning(false)}
          disabled={!isRunning}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold ${
            !isRunning 
              ? 'bg-gray-700 text-gray-400' 
              : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
          }`}
        >
          <Square size={18} />
          Stop Bot
        </button>
      </div>

      {/* Performance Dashboard */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
        <h3 className="text-mwathe-white font-bold text-sm mb-3 flex items-center gap-2">
          <Activity size={16} className="text-mwathe-orange" />
          Live Performance
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-mwathe-black/50 rounded-lg p-2">
            <p className="text-mwathe-gray text-xs">Net P/L</p>
            <p className="text-mwathe-green font-bold">+$12.50</p>
          </div>
          <div className="bg-mwathe-black/50 rounded-lg p-2">
            <p className="text-mwathe-gray text-xs">Win Rate</p>
            <p className="text-mwathe-skyblue font-bold">84%</p>
          </div>
          <div className="bg-mwathe-black/50 rounded-lg p-2">
            <p className="text-mwathe-gray text-xs">Trades</p>
            <p className="text-mwathe-white font-bold">24</p>
          </div>
        </div>
      </div>
    </div>
  )
}
