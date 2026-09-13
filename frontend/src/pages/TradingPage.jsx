import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, BarChart3, Signal, Bot, Cpu, Settings, Zap } from 'lucide-react'

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

  return (
    <div className="h-screen w-screen bg-mwathe-black flex flex-col overflow-hidden">
      <div className="h-12 bg-mwathe-darkgray flex items-center justify-between px-4 border-b border-gray-800 shrink-0">
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-mwathe-white">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="text-sm font-bold">
          <span className="text-mwathe-orange">M</span>
          <span className="text-mwathe-green">W</span>
          <span className="text-mwathe-skyblue">A</span>
          <span className="text-mwathe-white">THE</span>
        </span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-mwathe-green animate-pulse"></div>
          <span className="text-mwathe-green text-sm font-bold">$10,000.00</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
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

        <div className="h-full flex items-center justify-center text-mwathe-gray">
          <div className="text-center">
            <h2 className="text-xl font-bold text-mwathe-white mb-2">
              {menuItems.find(m => m.id === activeSection)?.name}
            </h2>
            <p className="text-sm">Section content will appear here</p>
          </div>
        </div>
      </div>
    </div>
  )
}
