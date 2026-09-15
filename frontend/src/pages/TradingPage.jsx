import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, BarChart3, Signal, Bot, Cpu, Settings, Zap } from 'lucide-react'
import AnalysisTool from '../components/AnalysisTool'
import Signals from '../components/Signals'
import DennyBots from '../components/DennyBots'
import AutomatedBot from '../components/AutomatedBot'
import AutoDAI from '../components/AutoDAI'
import AppSettings from '../components/Settings'

const menuItems = [
  { name: 'Analysis Tool', icon: BarChart3, id: 'analysis' },
  { name: 'Signals', icon: Signal, id: 'signals' },
  { name: 'Denny Bots', icon: Bot, id: 'denny' },
  { name: 'Automated Bot', icon: Zap, id: 'automated' },
  { name: 'The AutoD AI', icon: Cpu, id: 'autod' },
  { name: 'Settings', icon: Settings, id: 'settings' },
]

export default function TradingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('analysis')

  const renderSection = () => {
    switch(activeSection) {
      case 'analysis': return <AnalysisTool />
      case 'signals': return <Signals />
      case 'denny': return <DennyBots />
      case 'automated': return <AutomatedBot />
      case 'autod': return <AutoDAI />
      case 'settings': return <AppSettings />
      default: return <AnalysisTool />
    }
  }

  return (
    <div className="h-screen w-screen bg-mwathe-black flex flex-col overflow-hidden">
      {/* Header */}
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Side Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute top-0 left-0 h-full w-64 bg-mwathe-darkgray z-50 shadow-2xl flex flex-col pt-4 border-r border-gray-800"
            >
              <div className="px-5 pb-4 border-b border-gray-800 mb-2">
                <h3 className="text-mwathe-white font-bold">Menu</h3>
              </div>
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id); setMenuOpen(false) }}
                  className={`flex items-center gap-3 px-5 py-4 text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-mwathe-orange/10 text-mwathe-orange border-r-2 border-mwathe-orange'
                      : 'text-mwathe-gray hover:bg-mwathe-black hover:text-mwathe-white'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="text-sm font-medium">{item.name}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
