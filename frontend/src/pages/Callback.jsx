import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getStoredPKCE, clearPKCE } from '../utils/oauth'

export default function Callback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('Verifying authorization...')
  const [error, setError] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      console.log('📍 Callback URL:', window.location.href)
      
      try {
        const params = new URLSearchParams(location.search)
        const code = params.get('code')
        const state = params.get('state')
        const errorParam = params.get('error')

        if (errorParam) {
          throw new Error(params.get('error_description') || 'Authorization denied')
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        console.log('✅ Code received:', code.substring(0, 20) + '...')

        // Verify state
        const storedState = sessionStorage.getItem('oauth_state')
        if (state !== storedState) {
          throw new Error('State mismatch')
        }

        // Get code_verifier from storage
        const { codeVerifier } = getStoredPKCE()
        if (!codeVerifier) {
          throw new Error('PKCE code_verifier not found')
        }

        console.log('🔄 Exchanging code for token...')
        const REDIRECT_URI = window.location.origin + '/callback'
        
        // Exchange code for access token
        const tokenResponse = await fetch('/api/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code, 
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier 
          }),
        })

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json()
          console.error('❌ Token exchange error:', errorData)
          throw new Error(errorData.error || 'Token exchange failed')
        }

        const tokenData = await tokenResponse.json()
        console.log('✅ Access token received successfully!')

        // Store the access token
        localStorage.setItem('deriv_access_token', tokenData.access_token)
        localStorage.setItem('oauth_connected', 'true')
        clearPKCE()
        
        setStatus('Authentication successful! Redirecting...')
        
        setTimeout(() => {
          navigate('/trading', { replace: true })
        }, 500)

      } catch (err) {
        console.error('❌ OAuth error:', err)
        setError(err.message)
        setTimeout(() => {
          navigate('/navigation', { replace: true })
        }, 3000)
      }
    }

    handleCallback()
  }, [navigate, location])

  if (error) {
    return (
      <div className="h-screen w-screen bg-mwathe-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-mwathe-white mb-2">Authentication Failed</h2>
          <p className="text-mwathe-gray text-sm mb-4">{error}</p>
          <p className="text-mwathe-gray text-xs">Redirecting back...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-mwathe-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-mwathe-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-mwathe-white font-bold text-lg">{status}</p>
      </div>
    </div>
  )
}
