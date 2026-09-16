import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, BarChart3, Signal, Bot, Cpu, Settings, Zap, RefreshCw, LogOut } from 'lucide-react'
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
  const [errorMessage, setErrorMessage] = useState('')
  const [debugInfo, setDebugInfo] = useState({ wsStatus: 'Idle', lastMsg: 'None' })
  const [ws, setWs] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('deriv_access_token')
    
    if (!token) {
      setErrorMessage(' NO TOKEN FOUND! Please go back and reconnect.')
      return
    }

    setErrorMessage('')
    setDebugInfo({ wsStatus: 'Connecting...', lastMsg: 'None' })

    const wsUrl = 'wss://ws.derivws.com/websockets/v3?app_id=349eTg55tt6ZVaefjBIAH'
    const websocket = new WebSocket(wsUrl)

    websocket.onopen = () => {
      setDebugInfo(prev => ({ ...prev, wsStatus: 'Connected. Pinging server...' }))
      websocket.send(JSON.stringify({ ping: 1 }))
    }

    websocket.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data)
        setDebugInfo(prev => ({ ...prev, lastMsg: JSON.stringify(data).substring(0, 120) }))

        if (data.msg_type === 'ping') {
          setDebugInfo(prev => ({ ...prev, wsStatus: 'Ping OK. Authorizing...' }))
          websocket.send(JSON.stringify({ authorize: token }))
        } 
        else if (data.msg_type === 'authorize') {
          if (data.authorize) {
            setAccountId(data.authorize.loginid)
            setAccountType(data.authorize.is_virtual ? 'demo' : 'real')
            setCurrency(data.authorize.currency || 'USD')
            setDebugInfo(prev => ({ ...prev, wsStatus: 'Authorized! Fetching balance...' }))
            websocket.send(JSON.stringify({ balance: 1, subscribe: 1 }))
          } else if (data.error) {
            setErrorMessage(`❌ DERIV REJECTED TOKEN: ${data.error.message || data.error.code}`)
            setDebugInfo(prev => ({ ...prev, wsStatus: 'Authorization Failed' }))
          }
        } 
        else if (data.msg_type === 'balance') {
          setBalance(parseFloat(data.balance.balance))
          setCurrency(data.balance.currency)
          setIsConnected(true)
          setDebugInfo(prev => ({ ...prev, wsStatus: 'Fully Connected' }))
        }
      } catch (e) {
        setErrorMessage('❌ Failed to parse server response')
      }
    }

    websocket.onerror = () => {
      setErrorMessage(' WebSocket connection failed. Check internet or Deriv API status.')
      setDebugInfo(prev => ({ ...prev, wsStatus: 'Connection Error' }))
    }

    websocket.onclose = () => {
      setIsConnected(false)
      setDebugInfo(prev => ({ ...prev, wsStatus: 'Disconnected' }))
    }

    setWs(websocket)

    return () => { if (websocket) websocket.close() }
  }, [])

  const handleClearData = () => {
    localStorage.removeItem('deriv_access_token')
    localStorage.removeItem('oauth_connected')
    if (ws) ws.close()
    window.location.href = '/navigation'
  }

  const handleRetry = () => {
    window.location.reload()
  }

  const handleSwitchAccount = () => {
    setAccountType(accountType === 'real' ? 'demo' : 'real')
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
      {/* Header */}
      <div className="h-14 bg-mwathe-darkgray flex items-center justify-between px-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-mwathe-white">
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Logo" className="w-7 h-7" />
            <span className="text-sm font-bold hidden sm:block">
              <span className="text-mwathe-orange">M</span><span className="text-mwathe-green">W</span>
              <span className="text-mwathe-skyblue">A</span><span className="text-mwathe-white">THE</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-mwathe-gray text-xs">Account</span>
          <span className="text-mwathe-white font-mono font-bold text-sm">{accountId || 'Loading...'}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSwitchAccount} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${accountType === 'demo' ? 'bg-mwathe-skyblue/20 text-mwathe-skyblue' : 'bg-mwathe-green/20 text-mwathe-green'}`}>
            <span>{accountType === 'demo' ? 'DEMO' : 'REAL'}</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'animate-pulse' : ''} ${accountType === 'demo' ? 'bg-mwathe-skyblue' : 'bg-mwathe-green'}`}></div>
          </button>
          <div className="text-right">
            <p className="text-mwathe-gray text-xs">Balance</p>
            <p className="text-mwathe-green font-bold font-mono">{currency} {balance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Debug Info Box */}
      <div className="bg-gray-900 border-b border-gray-700 p-2">
        <p className="text-gray-400 text-xs font-bold mb-1">LIVE DEBUGGER:</p>
        <div className="text-xs text-gray-300 space-y-1">
          <p>WebSocket: {debugInfo.wsStatus}</p>
          <p className="break-all">Last Server Msg: {debugInfo.lastMsg}</p>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-900/30 border-b border-red-500 p-3 text-center">
          <p className="text-red-400 text-sm mb-3">{errorMessage}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={handleRetry} className="px-4 py-2 bg-mwathe-skyblue text-white rounded-lg text-sm font-bold">
              <RefreshCw size={16} className="inline mr-1" /> Retry
            </button>
            <button onClick={handleClearData} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">
              <LogOut size={16} className="inline mr-1" /> Clear & Reconnect
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Side Menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/50 z-40" />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 25 }} className="absolute top-0 left-0 h-full w-64 bg-mwathe-darkgray z-50 shadow-2xl flex flex-col pt-4 border-r border-gray-800">
              <div className="px-5 pb-4 border-b border-gray-800 mb-2"><h3 className="text-mwathe-white font-bold">Menu</h3></div>
              {menuItems.map((item) => (
                <button key={item.id} onClick={() => { setActiveSection(item.id); setMenuOpen(false) }} className={`flex items-center gap-3 px-5 py-4 text-left transition-colors ${activeSection === item.id ? 'bg-mwathe-orange/10 text-mwathe-orange border-r-2 border-mwathe-orange' : 'text-mwathe-gray hover:bg-mwathe-black hover:text-mwathe-white'}`}>
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
