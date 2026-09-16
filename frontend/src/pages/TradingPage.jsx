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
  const [debugSteps, setDebugSteps] = useState([])
  const [ws, setWs] = useState(null)

  const addDebugStep = (step) => {
    setDebugSteps(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step}`])
  }

  useEffect(() => {
    addDebugStep('1. TradingPage mounted')
    
    const token = localStorage.getItem('deriv_access_token')
    addDebugStep(`2. Token: ${token ? 'FOUND (' + token.length + ' chars)' : 'MISSING'}`)
    
    if (!token) {
      setErrorMessage(' NO TOKEN! Click "Clear & Reconnect"')
      return
    }

    addDebugStep('3. Testing network connectivity...')
    
    // Test if we can reach Deriv servers
    fetch('https://www.deriv.com', { mode: 'no-cors' })
      .then(() => {
        addDebugStep('4. ✅ Internet: CONNECTED')
        addDebugStep('5. Connecting to Deriv WebSocket...')
        connectWebSocket(token)
      })
      .catch(() => {
        addDebugStep('4. ❌ Internet: BLOCKED or Deriv unreachable')
        setErrorMessage(' Network issue. Check internet connection or VPN/firewall.')
      })
  }, [])

  const connectWebSocket = (token) => {
    const wsUrl = 'wss://ws.derivws.com/websockets/v3?app_id=349eTg55tt6ZVaefjBIAH'
    
    try {
      addDebugStep(`6. Creating WebSocket...`)
      const websocket = new WebSocket(wsUrl)
      
      websocket.onopen = () => {
        addDebugStep('7. ✅ WebSocket CONNECTED!')
        addDebugStep('8. Sending authorization...')
        websocket.send(JSON.stringify({ authorize: token }))
      }

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          addDebugStep(`9. Received: ${data.msg_type}`)
          
          if (data.msg_type === 'authorize') {
            if (data.error) {
              addDebugStep(`10. ❌ AUTH REJECTED: ${data.error.message}`)
              setErrorMessage(`Token rejected: ${data.error.message}. Click "Clear & Reconnect".`)
              websocket.close()
            } else if (data.authorize) {
              addDebugStep('10. ✅ AUTHORIZED!')
              addDebugStep(`11. Account: ${data.authorize.loginid}`)
              setAccountId(data.authorize.loginid)
              setAccountType(data.authorize.is_virtual ? 'demo' : 'real')
              setCurrency(data.authorize.currency || 'USD')
              
              addDebugStep('12. Fetching balance...')
              websocket.send(JSON.stringify({ balance: 1, subscribe: 1 }))
            }
          }
          
          if (data.msg_type === 'balance' && data.balance) {
            addDebugStep(`13. 💰 Balance: ${data.balance.balance} ${data.balance.currency}`)
            setBalance(parseFloat(data.balance.balance))
            setCurrency(data.balance.currency)
            setIsConnected(true)
            setErrorMessage('')
          }
        } catch (e) {
          addDebugStep(`Parse error: ${e.message}`)
        }
      }

      websocket.onerror = (error) => {
        addDebugStep('ERROR: WebSocket connection failed')
        setErrorMessage(' WebSocket failed. Check internet/firewall. Click Retry.')
      }

      websocket.onclose = () => {
        addDebugStep('WebSocket CLOSED')
        setIsConnected(false)
      }

      setWs(websocket)
      addDebugStep('WebSocket object created')
      
      // Timeout after 15 seconds
      setTimeout(() => {
        if (!isConnected && websocket.readyState !== WebSocket.OPEN) {
          addDebugStep('TIMEOUT: Connection took too long')
          websocket.close()
        }
      }, 15000)
      
    } catch (error) {
      addDebugStep(`FATAL: ${error.message}`)
      setErrorMessage(`Failed to create WebSocket: ${error.message}`)
    }
  }

  const handleClearData = () => {
    localStorage.clear()
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
            <span className="text-sm font-bold hidden sm:block">MWATHE</span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-mwathe-gray text-xs">Account</span>
          <span className="text-mwathe-white font-mono font-bold text-sm">{accountId || '---'}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSwitchAccount} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${accountType === 'demo' ? 'bg-mwathe-skyblue/20 text-mwathe-skyblue' : 'bg-mwathe-green/20 text-mwathe-green'}`}>
            <span>{accountType === 'demo' ? 'DEMO' : 'REAL'}</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'animate-pulse bg-green-400' : 'bg-red-500'}`}></div>
          </button>
          <div className="text-right">
            <p className="text-mwathe-gray text-xs">Balance</p>
            <p className="text-mwathe-green font-bold font-mono">{currency} {balance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Debug Steps */}
      <div className="bg-gray-900 border-b border-gray-700 max-h-32 overflow-y-auto p-2 text-xs font-mono">
        <p className="text-gray-400 font-bold mb-1">CONNECTION LOG:</p>
        <div className="space-y-1">
          {debugSteps.map((step, i) => (
            <p key={i} className={step.includes('✅') ? 'text-green-400' : step.includes('❌') || step.includes('ERROR') || step.includes('FAILED') ? 'text-red-400' : 'text-gray-300'}>
              {step}
            </p>
          ))}
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
