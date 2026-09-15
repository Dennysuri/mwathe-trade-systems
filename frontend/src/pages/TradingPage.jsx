import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, BarChart3, Signal, Bot, Cpu, Settings, Zap, TrendingUp, Activity, DollarSign } from 'lucide-react'

const menuItems = [
  { name: 'Analysis Tool', icon: BarChart3, id: 'analysis' },
  { name: 'Signals', icon: Signal, id: 'signals', locked: true },
  { name: 'Denny Bots', icon: Bot, id: 'denny' },
  { name: 'Automated Trading Bot', icon: Zap, id: 'automated' },
  { name: 'The AutoD AI', icon: Cpu, id: 'autod' },
  { name: 'Settings', icon: Settings, id: 'settings' },
]

export default function TradingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('analysis')

  const renderSection = () => {
    switch(activeSection) {
      case 'analysis':
        return <AnalysisTool />
      case 'denny':
        return <DennyBots />
      case 'automated':
        return <AutomatedBot />
      case 'autod':
        return <AutoDAI />
      case 'settings':
        return <SettingsSection />
      default:
        return <AnalysisTool />
    }
  }

  return (
    <div className="h-screen w-screen bg-mwathe-black flex flex-col overflow-hidden">
      {/* Header with Logo */}
      <div className="h-12 bg-mwathe-darkgray flex items-center justify-between px-4 border-b border-gray-800 shrink-0">
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-mwathe-white">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Logo" className="w-7 h-7" />
          <span className="text-sm font-bold">
            <span className="text-mwathe-orange">M</span>
            <span className="text-mwathe-green">W</span>
            <span className="text-mwathe-skyblue">A</span>
            <span className="text-mwathe-white">THE</span>
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-mwathe-green animate-pulse"></div>
          <span className="text-mwathe-green text-sm font-bold">$10,000.00</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Side Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute top-0 left-0 h-full w-64 bg-mwathe-darkgray z-50 shadow-2xl flex flex-col pt-4"
          >
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id)
                  setMenuOpen(false)
                }}
                className={`flex items-center gap-3 px-5 py-4 text-left transition-colors ${
                  activeSection === item.id
                    ? 'bg-mwathe-orange/20 text-mwathe-orange border-r-2 border-mwathe-orange'
                    : 'text-mwathe-gray hover:bg-mwathe-black hover:text-mwathe-white'
                } ${item.locked ? 'opacity-40' : ''}`}
              >
                <item.icon size={20} />
                <span className="text-sm font-medium">{item.name}</span>
                {item.locked && <span className="text-xs text-mwathe-gray ml-auto">🔒</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Analysis Tool Component
function AnalysisTool() {
  const markets = [
    { name: 'Volatility 75', symbol: 'V75', change: '+2.4%', trend: 'up' },
    { name: 'Volatility 50', symbol: 'V50', change: '+1.8%', trend: 'up' },
    { name: 'Volatility 25', symbol: 'V25', change: '-0.5%', trend: 'down' },
    { name: 'Volatility 10', symbol: 'V10', change: '+0.9%', trend: 'up' },
  ]

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-mwathe-white mb-2">Market Analysis</h2>
        <p className="text-mwathe-gray text-sm">Real-time analysis across all Volatility Indices</p>
      </div>

      {/* Market Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {markets.map((market) => (
          <div key={market.symbol} className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-mwathe-white font-bold text-sm">{market.symbol}</span>
              <span className={`text-xs font-medium ${market.trend === 'up' ? 'text-mwathe-green' : 'text-red-500'}`}>
                {market.change}
              </span>
            </div>
            <p className="text-mwathe-gray text-xs">{market.name}</p>
            <div className="mt-3 flex items-center gap-2">
              <Activity size={14} className="text-mwathe-skyblue" />
              <span className="text-xs text-mwathe-skyblue">Analyzing...</span>
            </div>
          </div>
        ))}
      </div>

      {/* Analysis Stats */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
        <h3 className="text-mwathe-white font-bold mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-mwathe-green" />
          100+ Technical Indicators
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-mwathe-gray text-sm">RSI (14)</span>
            <span className="text-mwathe-orange font-mono">62.4</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-mwathe-gray text-sm">MACD</span>
            <span className="text-mwathe-green font-mono">Bullish</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-mwathe-gray text-sm">Bollinger Bands</span>
            <span className="text-mwathe-skyblue font-mono">Neutral</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-mwathe-gray text-sm">Moving Avg (50)</span>
            <span className="text-mwathe-green font-mono">Above</span>
          </div>
        </div>
      </div>

      {/* Scan Button */}
      <button className="w-full mt-4 py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-mwathe-orange to-mwathe-green shadow-lg active:scale-95 transition-transform">
        Scan All Markets
      </button>
    </div>
  )
}

// Denny Bots Component
function DennyBots() {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-mwathe-white mb-2">Denny Bots</h2>
        <p className="text-mwathe-gray text-sm">Specialized trading bots for different strategies</p>
      </div>

      <div className="space-y-3">
        {['Digits Over/Under Bot', 'Accumulator Bot', 'Multiplier Bot'].map((bot, idx) => (
          <div key={idx} className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-mwathe-white font-bold">{bot}</h3>
              <div className="w-2 h-2 rounded-full bg-mwathe-gray"></div>
            </div>
            <p className="text-mwathe-gray text-sm mb-3">Status: Inactive</p>
            <button className="w-full py-2 rounded-lg bg-mwathe-green/20 text-mwathe-green text-sm font-medium">
              Configure
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Automated Trading Bot Component
function AutomatedBot() {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-mwathe-white mb-2">Automated Trading Bot</h2>
        <p className="text-mwathe-gray text-sm">Fully automated trading with AI precision</p>
      </div>

      <div className="bg-mwathe-darkgray rounded-xl p-6 border border-gray-800 text-center">
        <Bot size={48} className="text-mwathe-skyblue mx-auto mb-4" />
        <h3 className="text-mwathe-white font-bold text-lg mb-2">Ready to Trade</h3>
        <p className="text-mwathe-gray text-sm mb-4">Configure your parameters to start automated trading</p>
        <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-mwathe-green to-mwathe-skyblue text-white font-bold">
          Start Bot
        </button>
      </div>
    </div>
  )
}

// AutoD AI Component
function AutoDAI() {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-mwathe-white mb-2">The AutoD AI</h2>
        <p className="text-mwathe-gray text-sm">Advanced AI for Digits trading (Over 2 / Under 8)</p>
      </div>

      <div className="bg-gradient-to-br from-mwathe-orange/20 to-mwathe-green/20 rounded-xl p-6 border border-mwathe-orange/30">
        <Cpu size={48} className="text-mwathe-orange mx-auto mb-4" />
        <h3 className="text-mwathe-white font-bold text-lg mb-2 text-center">AI-Powered Digits Analysis</h3>
        <p className="text-mwathe-gray text-sm mb-4 text-center">Analyzing last 50 digits for pattern recognition</p>
        <div className="flex justify-center gap-2 mb-4">
          <span className="px-3 py-1 rounded-full bg-mwathe-orange/20 text-mwathe-orange text-xs">Over 2</span>
          <span className="px-3 py-1 rounded-full bg-mwathe-green/20 text-mwathe-green text-xs">Under 8</span>
        </div>
        <button className="w-full py-3 rounded-xl bg-mwathe-orange text-white font-bold">
          Activate AutoD AI
        </button>
      </div>
    </div>
  )
}

// Settings Component
function SettingsSection() {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-mwathe-white mb-2">Settings</h2>
        <p className="text-mwathe-gray text-sm">Configure your trading preferences</p>
      </div>

      <div className="space-y-4">
        <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
          <h3 className="text-mwathe-white font-bold mb-3 flex items-center gap-2">
            <DollarSign size={18} className="text-mwathe-green" />
            Trading Parameters
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-mwathe-gray text-xs block mb-1">Base Stake</label>
              <input type="number" defaultValue="1" className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm" />
            </div>
            <div>
              <label className="text-mwathe-gray text-xs block mb-1">Martingale Factor</label>
              <input type="number" defaultValue="1.5" step="0.1" className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
          <h3 className="text-mwathe-white font-bold mb-3">Risk Management</h3>
          <div className="space-y-3">
            <div>
              <label className="text-mwathe-gray text-xs block mb-1">Stop Loss</label>
              <input type="number" defaultValue="50" className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm" />
            </div>
            <div>
              <label className="text-mwathe-gray text-xs block mb-1">Target Profit</label>
              <input type="number" defaultValue="100" className="w-full bg-mwathe-black border border-gray-700 rounded-lg px-3 py-2 text-mwathe-white text-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
