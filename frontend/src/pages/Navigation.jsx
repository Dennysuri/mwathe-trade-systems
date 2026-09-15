import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Lock } from 'lucide-react'

export default function Navigation() {
  const navigate = useNavigate()

  // Your exact Deriv Client ID
  const CLIENT_ID = '349eTg55tt6ZVaefjBIAH'
  
  // Dynamically get the exact live URL (e.g., https://mwathe-trade-systems-gamma.vercel.app)
  const REDIRECT_URI = window.location.origin

  const handleConnect = () => {
    // Construct the strict Deriv OAuth 2.0 Authorization URL
    // This forces Deriv to show the "Mwathe Trade Systems" consent screen
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&l=EN&brand=deriv&scope=read%20trade%20admin`
    
    // Redirect to Deriv's OAuth Consent Screen
    window.location.href = oauthUrl
  }

  return (
    <div className="h-screen w-screen bg-mwathe-black flex flex-col overflow-hidden">
      {/* Header with Logo */}
      <div className="h-14 bg-mwathe-darkgray flex items-center px-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
          <span className="text-mwathe-white font-bold text-sm">MWATHE</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <motion.div 
          className="flex flex-col items-center gap-8 w-full max-w-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-mwathe-white mb-2">Connect Your Account</h1>
            <p className="text-mwathe-gray text-sm">Authorize Mwathe Trade Systems to access your Deriv account</p>
          </div>

          {/* Security Badges */}
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3 bg-mwathe-darkgray px-4 py-3 rounded-lg border border-gray-800">
              <Shield className="text-mwathe-green" size={20} />
              <span className="text-mwathe-green text-xs font-medium">Secure OAuth 2.0 Connection</span>
            </div>
            <div className="flex items-center gap-3 bg-mwathe-darkgray px-4 py-3 rounded-lg border border-gray-800">
              <Lock className="text-mwathe-skyblue" size={20} />
              <span className="text-mwathe-skyblue text-xs font-medium">No API Tokens Stored or Shared</span>
            </div>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            className="w-full py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-mwathe-green to-mwathe-skyblue shadow-lg shadow-mwathe-green/30 active:scale-95 transition-transform flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Connect with Deriv
          </button>

          <p className="text-mwathe-gray text-xs text-center max-w-xs">
            You will be redirected to Deriv's official authorization screen to approve Mwathe Trade Systems.
          </p>

          <button onClick={() => navigate('/')} className="text-mwathe-gray text-sm underline mt-2">← Back to Dashboard</button>
        </motion.div>
      </div>
    </div>
  )
}
