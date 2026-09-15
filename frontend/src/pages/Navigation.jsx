import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Lock } from 'lucide-react'
import { generatePKCE } from '../utils/oauth'

export default function Navigation() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  // Your Deriv OAuth 2.0 Client ID
  const CLIENT_ID = '349eTg55tt6ZVaefjBIAH'
  
  // Get current origin for redirect (works on localhost and Vercel)
  const REDIRECT_URI = window.location.origin

  const handleConnect = async () => {
    setIsLoading(true)
    
    try {
      // Step 1: Generate PKCE parameters
      const { codeChallenge, state } = await generatePKCE()
      
      // Step 2: Build the OAuth 2.0 authorization URL
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'trade account_manage',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        l: 'EN',
        brand: 'deriv'
      })
      
      // Step 3: Redirect to Deriv OAuth 2.0 endpoint
      const oauthUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`
      
      // Redirect user to Deriv's consent screen
      window.location.href = oauthUrl
    } catch (error) {
      console.error('OAuth initiation failed:', error)
      setIsLoading(false)
    }
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
            <p className="text-mwathe-gray text-sm">Authorize Mwathe Trade Systems via OAuth 2.0</p>
          </div>

          {/* Security Badges */}
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3 bg-mwathe-darkgray px-4 py-3 rounded-lg border border-gray-800">
              <Shield className="text-mwathe-green" size={20} />
              <span className="text-mwathe-green text-xs font-medium">OAuth 2.0 with PKCE</span>
            </div>
            <div className="flex items-center gap-3 bg-mwathe-darkgray px-4 py-3 rounded-lg border border-gray-800">
              <Lock className="text-mwathe-skyblue" size={20} />
              <span className="text-mwathe-skyblue text-xs font-medium">256-bit Encrypted</span>
            </div>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className={`w-full py-4 rounded-xl text-lg font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3 ${
              isLoading 
                ? 'bg-gray-700 text-gray-400' 
                : 'bg-gradient-to-r from-mwathe-green to-mwathe-skyblue text-white shadow-mwathe-green/30'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Redirecting...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                Connect with Deriv
              </>
            )}
          </button>

          <p className="text-mwathe-gray text-xs text-center max-w-xs">
            You'll be redirected to Deriv's secure authorization page to approve Mwathe Trade Systems access.
          </p>

          <button onClick={() => navigate('/')} className="text-mwathe-gray text-sm underline mt-2">← Back to Dashboard</button>
        </motion.div>
      </div>
    </div>
  )
}
