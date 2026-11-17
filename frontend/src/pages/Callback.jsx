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
      const params = new URLSearchParams(location.search)
      const code = params.get('code')
      const state = params.get('state')
      const errorParam = params.get('error')

      // Remove OAuth query parameters from the visible URL and browser history
      // before making requests or rendering any error state.
      window.history.replaceState({}, document.title, window.location.pathname)

      try {
        if (errorParam) throw new Error('Authorization was denied.')
        if (!code || code.length > 4096) throw new Error('No valid authorization code received.')

        const storedState = sessionStorage.getItem('oauth_state')
        if (!storedState || state !== storedState) throw new Error('State mismatch. Please reconnect.')

        const { codeVerifier } = getStoredPKCE()
        if (!codeVerifier) throw new Error('PKCE verification data is missing. Please reconnect.')

        const redirectUri = window.location.origin + '/callback'
        const tokenResponse = await fetch('/api/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
        })

        const tokenData = await tokenResponse.json().catch(() => ({}))
        if (!tokenResponse.ok || typeof tokenData.access_token !== 'string') {
          throw new Error(tokenData.error || 'Token exchange failed. Please reconnect.')
        }

        localStorage.setItem('deriv_access_token', tokenData.access_token)
        localStorage.setItem('oauth_connected', 'true')
        clearPKCE()
        setStatus('Authentication successful! Redirecting...')

        window.setTimeout(() => navigate('/trading', { replace: true }), 500)
      } catch (err) {
        clearPKCE()
        console.error('OAuth callback failed.')
        setError(err.message || 'Authentication failed. Please try again.')
        window.setTimeout(() => navigate('/navigation', { replace: true }), 3000)
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
