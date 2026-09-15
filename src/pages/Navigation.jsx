import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Navigation() {
  const navigate = useNavigate()

  const handleConnect = () => {
    navigate('/trading')
  }

  return (
    <div className="h-screen w-screen bg-mwathe-black flex flex-col overflow-hidden">
      {/* Header with Logo */}
      <div className="h-14 bg-mwathe-darkgray flex items-center px-4 border-b border-gray-800 shrink-0">
        <button onClick={() => navigate('/')} className="flex items-center gap-2">
          <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
          <span className="text-mwathe-white font-bold text-sm">MWATHE</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <motion.div 
          className="flex flex-col items-center gap-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-mwathe-white mb-2">Connect Your Account</h1>
            <p className="text-mwathe-gray text-sm">Securely link your Deriv account via OAuth 2.0</p>
          </div>

          <div className="flex items-center gap-2 bg-mwathe-darkgray px-4 py-2 rounded-lg">
            <div className="w-3 h-3 rounded-full bg-mwathe-green animate-pulse"></div>
            <span className="text-mwathe-green text-xs font-medium">256-bit Encrypted Connection</span>
          </div>

          <button
            onClick={handleConnect}
            className="w-72 py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-mwathe-green to-mwathe-skyblue shadow-lg shadow-mwathe-green/30 active:scale-95 transition-transform flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Connect with Deriv
          </button>

          <button onClick={() => navigate('/')} className="text-mwathe-gray text-sm underline mt-4">← Back to Dashboard</button>
        </motion.div>
      </div>
    </div>
  )
}
