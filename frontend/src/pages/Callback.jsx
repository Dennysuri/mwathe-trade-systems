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
      try {
        // Parse URL parameters
        const params = new URLSearchParams(location.search)
        const code = params.get('code')
        const state = params.get('state')
        const errorParam = params.get('error')

        // Check for errors from Deriv
        if (errorParam) {
          throw new Error(params.get('error_description') || 'Authorization denied')
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        // Verify state matches (CSRF protection)
        const storedState = sessionStorage.getItem('oauth_state')
        if (state !== storedState) {
          throw new Error('State mismatch - possible CSRF attack')
        }

        setStatus('Exchanging code for access token...')

        // Get the code_verifier we stored before redirect
        const { codeVerifier } = getStoredPKCE()
        if (!codeVerifier) {
          throw new Error('PKCE code verifier not found')
        }

        // Exchange code for token (THIS MUST BE DONE ON BACKEND IN PRODUCTION)
        // For now, we'll store the code and redirect to trading page
        // In production, you'd send this to your backend to exchange for token
        
        const CLIENT_ID = '349eTg55tt6ZVaefjBIAH'
        const REDIRECT_URI = window.location.origin

        // Store the authorization code temporarily
        sessionStorage.setItem('deriv_auth_code', code)
        
        // Clear PKCE params
        clearPKCE()

        // For MVP: Just redirect to trading page
        // The actual token exchange would happen on your backend
        setStatus('Authentication successful!')
        localStorage.setItem('oauth_connected', 'true')
        
        setTimeout(() => {
          navigate('/trading', { replace: true })
        }, 1000)

      } catch (err) {
        console.error('OAuth callback error:', err)
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
          <p className="text-mwathe-gray text-xs">Redirecting back to navigation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-mwathe-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-mwathe-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-mwathe-white font-bold text-lg">{status}</p>
        <p className="text-mwathe-gray text-sm mt-2">Please wait while we complete the OAuth 2.0 flow.</p>
      </div>
    </div>
  )
}
