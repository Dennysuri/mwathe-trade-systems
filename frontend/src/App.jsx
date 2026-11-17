import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Navigation from './pages/Navigation'
import TradingPage from './pages/TradingPage'
import Callback from './pages/Callback'

function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState(null)

  useEffect(() => {
    const handleInstallAvailable = (event) => {
      event.preventDefault()
      setInstallEvent(event)
    }
    const handleInstalled = () => setInstallEvent(null)

    window.addEventListener('beforeinstallprompt', handleInstallAvailable)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallAvailable)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  if (!installEvent) return null

  return (
    <button
      type="button"
      onClick={installApp}
      aria-label="Install Mwathe Trade Systems"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 18,
        zIndex: 9999,
        border: '1px solid #FF7A00',
        borderRadius: 999,
        padding: '12px 18px',
        background: '#FF7A00',
        color: '#0A0A0A',
        fontWeight: 700,
        boxShadow: '0 4px 18px rgba(0,0,0,.35)',
        cursor: 'pointer',
      }}
    >
      Install App
    </button>
  )
}

export default function App() {
  return (
    <Router>
      <InstallAppPrompt />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/navigation" element={<Navigation />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/trading" element={<TradingPage />} />
      </Routes>
    </Router>
  )
}
