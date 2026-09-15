import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Callback() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Deriv returns the token in the URL query parameters or hash
    const params = new URLSearchParams(location.search)
    const token = params.get('token') || params.get('access_token')

    if (token) {
      // Save the token securely in localStorage
      localStorage.setItem('deriv_access_token', token)
      localStorage.setItem('oauth_connected', 'true')
      
      // Redirect to the Trading Page
      navigate('/trading', { replace: true })
    } else {
      // If no token, authentication failed or was canceled
      navigate('/navigation', { replace: true })
    }
  }, [navigate, location])

  return (
    <div className="h-screen w-screen bg-mwathe-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-mwathe-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-mwathe-white font-bold text-lg">Authenticating with Deriv...</p>
        <p className="text-mwathe-gray text-sm mt-2">Please wait while we secure your session.</p>
      </div>
    </div>
  )
}
