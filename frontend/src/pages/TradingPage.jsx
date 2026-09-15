import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, BarChart3, Signal, Bot, Cpu, Settings, Zap } from 'lucide-react'
import derivService from '../services/derivService'
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
  const [balance, setBalance] = useState(0)
  const [currency, setCurrency] = useState('USD')
  const [accountType, setAccountType] = useState('real')
  const [accountId, setAccountId] = useState('')
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Connect to Deriv API on mount
    const initializeConnection = async () => {
      try {
        await derivService.connect()
        setIsConnected(true)
        
        // Set initial values
        setBalance(derivService.balance)
        setCurrency(derivService.currency)
        setAccountType(derivService.accountType)
        setAccountId(derivService.getAccountId())

        // Listen for updates
        derivService.addListener((data) => {
          setBalance(data.balance)
          setCurrency(data.currency)
          setAccountType(data.accountType)
          setAccountId(derivService.getAccountId())
        })
      } catch (error) {
        console.error('Failed to connect to Deriv:', error)
        setIsConnected(false)
      }
    }

    initializeConnection()

    // Cleanup on unmount
    return () => {
      derivService.disconnect()
    }
  }, [])

  const handleSwitchAccount = async () => {
    // TODO: Implement account switching logic
    // For now, just toggle between demo/real
    const newType = accountType === 'real' ? 'demo' : 'real'
    setAccountType(newType)
    // In production, this would call derivService.switchAccount()
  }

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
      {/* Header with Account Info */}
      <div className="h-14 bg-mwathe-darkgray flex items-center justify-between px-4 border-b border-gray-800 shrink-0">
        {/* Left: Menu Button + Logo */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-mwathe-white">
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Logo" className="w-7 h-7" />
            <span className="text-sm font-bold hidden sm:block">
              <span className="text-mwathe-orange">M</span>
              <span className="text-mwathe-green">W</span>
              <span className="text-mwathe-skyblue">A</span>
              <span className="text-mwathe-white">THE</span>
            </span>
          </div>
        </div>

        {/* Center: Account ID */}
        <div className="flex flex-col items-center">
          <span className="text-mwathe-gray text-xs">Account</span>
          <span className="text-mwathe-white font-mono font-bold text-sm">{accountId || 'Loading...'}</span>
        </div>

        {/* Right: Balance + Account Toggle */}
        <div className="flex items-center gap-3">
          {/* Account Type Toggle */}
          <button
            onClick={handleSwitchAccount}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
              accountType === 'demo' 
                ? 'bg-mwathe-skyblue/20 text-mwathe-skyblue' 
                : 'bg-mwathe-green/20 text-mwathe-green'
            }`}
          >
            <span>{accountType === 'demo' ? 'DEMO' : 'REAL'}</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'animate-pulse' : ''} ${
              accountType === 'demo' ? 'bg-mwathe-skyblue' : 'bg-mwathe-green'
            }`}></div>
          </button>

          {/* Balance Display */}
          <div className="text-right">
            <p className="text-mwathe-gray text-xs">Balance</p>
            <p className="text-mwathe-green font-bold font-mono">
              {currency} {balance.toFixed(2)}
            </p>
          </div>
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
