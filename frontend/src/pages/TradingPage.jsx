import { useState, useEffect, useRef } from 'react'
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
  const [balance, setBalance] = useState(0)
  const [currency, setCurrency] = useState('USD')
  const [accountType, setAccountType] = useState('real')
  const [accountId, setAccountId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [signals, setSignals] = useState([])
  
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [aiLogs, setAiLogs] = useState([])
  const [finalSignal, setFinalSignal] = useState(null)
  const intervalRef = useRef(null)

  const getAccountTypeFromId = (id) => {
    if (!id) return 'real'
    if (id.startsWith('VR') || id.startsWith('DOT')) return 'demo'
    return 'real'
  }

  const connectToAccount = async (accId, token) => {
    if (!accId) return
    try {
      const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accId}/otp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const wsUrl = data.data?.url
      if (!wsUrl) throw new Error('No WebSocket URL')

      const websocket = new WebSocket(wsUrl)
      websocket.onopen = () => websocket.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 1 }))
      websocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.msg_type === 'balance') {
            setBalance(parseFloat(msg.balance.balance))
            setCurrency(msg.balance.currency)
            setIsConnected(true)
          }
        } catch (e) { console.error('Parse error:', e) }
      }
      websocket.onerror = () => setIsConnected(false)
      websocket.onclose = () => setIsConnected(false)
    } catch (error) { console.error('Connection error:', error) }
  }

  useEffect(() => {
    const token = localStorage.getItem('deriv_access_token')
    if (!token) return
    const fetchAccounts = async () => {
      try {
        const response = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const accountList = data.data || []
        if (accountList.length > 0) {
          const processedAccounts = accountList.map((acc, idx) => {
            const accId = acc.id || acc.loginid || acc.account_id || `account_${idx}`
            return { ...acc, id: accId, type: getAccountTypeFromId(accId) }
          })
          setAccounts(processedAccounts)
          const defaultAcc = processedAccounts[0]
          setAccountId(defaultAcc.id)
          setAccountType(defaultAcc.type)
          setCurrency(defaultAcc.currency || 'USD')
          connectToAccount(defaultAcc.id, token)
        }
      } catch (error) { console.error('Fetch error:', error) }
    }
    fetchAccounts()
  }, [])

  const handleSwitchAccount = () => {
    if (accounts.length === 0) return
    const targetType = accountType === 'demo' ? 'real' : 'demo'
    const targetAccount = accounts.find(acc => acc.type === targetType)
    if (targetAccount) {
      setAccountId(targetAccount.id)
      setAccountType(targetAccount.type)
      connectToAccount(targetAccount.id, localStorage.getItem('deriv_access_token'))
    }
  }

  const handleSignalGenerated = (signal) => { setSignals(prev => [signal, ...prev]) }
  const handleResetSignals = () => { setSignals([]) }
  const handleBalanceUpdate = (newBalance) => { setBalance(newBalance) }

  useEffect(() => { return () => { if (intervalRef.current) clearInterval(intervalRef.current) } }, [])
  const token = localStorage.getItem('deriv_access_token')

  const renderSection = () => {
    switch(activeSection) {
      case 'analysis': return <AnalysisTool isAnalyzing={isAnalyzing} setIsAnalyzing={setIsAnalyzing} progress={progress} setProgress={setProgress} aiLogs={aiLogs} setAiLogs={setAiLogs} finalSignal={finalSignal} setFinalSignal={setFinalSignal} intervalRef={intervalRef} onSignalGenerated={handleSignalGenerated} />
      case 'signals': return <Signals signals={signals} onReset={handleResetSignals} />
      case 'denny': return <DennyBots token={token} accountId={accountId} onBalanceUpdate={handleBalanceUpdate} />
      case 'automated': return <AutomatedBot token={token} accountId={accountId} onBalanceUpdate={handleBalanceUpdate} />
      case 'autod': return <AutoDAI token={token} accountId={accountId} onBalanceUpdate={handleBalanceUpdate} />
      case 'settings': return <AppSettings />
      default: return <AnalysisTool isAnalyzing={isAnalyzing} setIsAnalyzing={setIsAnalyzing} progress={progress} setProgress={setProgress} aiLogs={aiLogs} setAiLogs={setAiLogs} finalSignal={finalSignal} setFinalSignal={setFinalSignal} intervalRef={intervalRef} onSignalGenerated={handleSignalGenerated} />
    }
  }

  return (
    <div className="h-screen w-screen bg-gray-950 flex flex-col overflow-hidden">
      <div className="h-14 bg-gray-900 flex items-center justify-between px-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-white"><Menu size={24} /></button>
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Logo" className="w-7 h-7" />
            <span className="text-sm font-bold hidden sm:block">
              <span className="text-orange-500">M</span><span className="text-green-500">W</span><span className="text-sky-400">A</span><span className="text-white">THE</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-gray-400 text-[10px]">Account</span>
          <span className="text-white font-mono font-bold text-xs">{accountId || '---'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSwitchAccount} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${accountType === 'demo' ? 'bg-sky-500/20 text-sky-400 border-sky-500/50' : 'bg-green-500/20 text-green-400 border-green-500/50'}`}>
            <span>{accountType === 'demo' ? 'DEMO' : 'REAL'}</span>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'animate-pulse bg-current' : 'bg-gray-500'}`}></div>
          </button>
          <div className="text-right">
            <p className="text-gray-400 text-[10px]">Balance</p>
            <p className="text-green-400 font-bold font-mono text-xs">{currency} {balance.toFixed(2)}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto relative">
        <AnimatePresence mode="wait">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/50 z-40" />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 25 }} className="absolute top-0 left-0 h-full w-64 bg-gray-900 z-50 shadow-2xl flex flex-col pt-4 border-r border-gray-800">
              <div className="px-5 pb-4 border-b border-gray-800 mb-2"><h3 className="text-white font-bold">Menu</h3></div>
              {menuItems.map((item) => (
                <button key={item.id} onClick={() => { setActiveSection(item.id); setMenuOpen(false) }} className={`flex items-center gap-3 px-5 py-4 text-left transition-colors ${activeSection === item.id ? 'bg-orange-500/10 text-orange-500 border-r-2 border-orange-500' : 'text-gray-400 hover:bg-gray-950 hover:text-white'}`}>
                  <item.icon size={20} /><span className="text-sm font-medium">{item.name}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
