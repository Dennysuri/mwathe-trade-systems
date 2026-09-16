import { useState, useEffect, useRef } from 'react'
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
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  
  const wsRef = useRef(null)

  const addDebugStep = (step) => {
    setDebugSteps(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step}`])
  }

  // Connect to a specific account using the OTP endpoint
  const connectToAccount = async (accId, token) => {
    if (!accId) {
      addDebugStep('❌ ERROR: Account ID is missing!')
      setErrorMessage('Account ID is missing.')
      return
    }

    addDebugStep(`🔌 Requesting WS URL for: ${accId}...`)
    setErrorMessage('')
    setIsConnected(false)

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    try {
      const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accId}/otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const wsUrl = data.data?.url

      if (!wsUrl) {
        throw new Error('No WebSocket URL returned')
      }

      addDebugStep('✅ Got authenticated WS URL')
      addDebugStep('🌐 Connecting...')

      const websocket = new WebSocket(wsUrl)
      wsRef.current = websocket

      websocket.onopen = () => {
        addDebugStep('✅ WebSocket CONNECTED!')
        websocket.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 1 }))
      }

      websocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          
          if (msg.msg_type === 'balance') {
            setBalance(parseFloat(msg.balance.balance))
            setCurrency(msg.balance.currency)
            setIsConnected(true)
            addDebugStep(`💰 Balance: ${msg.balance.balance} ${msg.balance.currency}`)
          }
        } catch (e) {
          console.error('Parse error:', e)
        }
      }

      websocket.onerror = () => {
        addDebugStep('❌ WebSocket error')
        setErrorMessage('Connection failed.')
        setIsConnected(false)
      }

      websocket.onclose = () => {
        addDebugStep('🔌 WebSocket closed')
        setIsConnected(false)
      }

    } catch (error) {
      addDebugStep(`❌ OTP failed: ${error.message}`)
      setErrorMessage(`Failed: ${error.message}`)
    }
  }

  // Initial load
  useEffect(() => {
    const token = localStorage.getItem('deriv_access_token')
    
    if (!token) {
      setErrorMessage('No token found. Please reconnect.')
      return
    }

    addDebugStep('📱 App mounted. Fetching accounts...')

    const fetchAccounts = async () => {
      try {
        const response = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const accountList = data.data || []
        
        addDebugStep(`✅ Found ${accountList.length} accounts in profile`)
        
        if (accountList.length > 0) {
          // CRITICAL FIX: Keep ALL accounts and read type directly from API
          // DO NOT filter or guess based on account ID
          const processedAccounts = accountList.map((acc, idx) => {
            // Read account type DIRECTLY from API response
            // Deriv API returns: type = 'demo' or type = 'real' (or is_virtual field)
            const accountType = acc.type === 'demo' || acc.is_virtual ? 'demo' : 'real'
            const accId = acc.id || acc.loginid || acc.account_id || `account_${idx}`
            
            addDebugStep(` Account ${idx + 1}: ID=${accId}, Type=${accountType.toUpperCase()} (from API: ${acc.type || 'N/A'})`)
            
            return {
              ...acc,
              id: accId,
              type: accountType
            }
          })
          
          setAccounts(processedAccounts)

          // Select first account (usually default)
          const defaultAcc = processedAccounts[0]
          setSelectedAccountId(defaultAcc.id)
          setAccountId(defaultAcc.id)
          setAccountType(defaultAcc.type)
          setCurrency(defaultAcc.currency || 'USD')
          
          addDebugStep(`🎯 Selected: ${defaultAcc.id} (${defaultAcc.type.toUpperCase()})`)
          
          // Connect to the selected account
          connectToAccount(defaultAcc.id, token)
        } else {
          setErrorMessage('No accounts found.')
        }

      } catch (error) {
        addDebugStep(`❌ Fetch failed: ${error.message}`)
        setErrorMessage('Failed to load accounts.')
      }
    }

    fetchAccounts()

    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  // Handle switching between accounts
  const handleSwitchAccount = () => {
    if (accounts.length === 0) {
      addDebugStep('❌ No accounts loaded')
      return
    }

    addDebugStep(`🔄 User requested switch from ${accountType.toUpperCase()}...`)

    // Find the OTHER account type (if current is real, find demo, and vice versa)
    const targetType = accountType === 'demo' ? 'real' : 'demo'
    
    const targetAccount = accounts.find(acc => acc.type === targetType)
    
    if (targetAccount) {
      addDebugStep(`✅ Found ${targetType.toUpperCase()} account: ${targetAccount.id}`)
      addDebugStep(`🔄 Switching to ${targetAccount.id}...`)
      
      setSelectedAccountId(targetAccount.id)
      setAccountId(targetAccount.id)
      setAccountType(targetAccount.type)
      
      const token = localStorage.getItem('deriv_access_token')
      connectToAccount(targetAccount.id, token)
    } else {
      addDebugStep(`❌ No ${targetType.toUpperCase()} account found in list`)
      setErrorMessage(`No ${targetType} account available.`)
    }
  }

  const handleClearData = () => {
    localStorage.clear()
    if (wsRef.current) wsRef.current.close()
    window.location.href = '/navigation'
  }

  const handleRetry = () => {
    window.location.reload()
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
          <span className="text-mwathe-gray text-[10px]">Account</span>
          <span className="text-mwathe-white font-mono font-bold text-xs">{accountId || '---'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSwitchAccount}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
              accountType === 'demo' ? 'bg-mwathe-skyblue/20 text-mwathe-skyblue border-mwathe-skyblue/50' : 'bg-mwathe-green/20 text-mwathe-green border-mwathe-green/50'
            }`}
          >
            <span>{accountType === 'demo' ? 'DEMO' : 'REAL'}</span>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'animate-pulse bg-current' : 'bg-gray-500'}`}></div>
          </button>
          <div className="text-right">
            <p className="text-mwathe-gray text-[10px]">Balance</p>
            <p className="text-mwathe-green font-bold font-mono text-xs">{currency} {balance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Debug Steps */}
      <div className="bg-gray-900 border-b border-gray-700 max-h-32 overflow-y-auto p-2 text-[10px] font-mono">
        <p className="text-gray-400 font-bold mb-1">CONNECTION LOG:</p>
        <div className="space-y-0.5">
          {debugSteps.map((step, i) => (
            <p key={i} className={step.includes('✅') || step.includes('💰') || step.includes('') || step.includes('🎯') ? 'text-green-400' : step.includes('❌') || step.includes('Failed') || step.includes('error') ? 'text-red-400' : 'text-gray-300'}>
              {step}
            </p>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-900/30 border-b border-red-500 p-2 text-center">
          <p className="text-red-400 text-xs mb-2">{errorMessage}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={handleRetry} className="px-3 py-1 bg-mwathe-skyblue text-white rounded text-xs font-bold">Retry</button>
            <button onClick={handleClearData} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold">Clear & Reconnect</button>
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
