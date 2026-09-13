import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Navigation from './pages/Navigation'
import TradingPage from './pages/TradingPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/navigation" element={<Navigation />} />
        <Route path="/trading" element={<TradingPage />} />
      </Routes>
    </Router>
  )
}
