export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, redirect_uri, code_verifier } = req.body

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' })
  }

  try {
    console.log('🔄 Exchanging code for token...')
    console.log('Redirect URI:', redirect_uri)
    console.log('Code:', code.substring(0, 20) + '...')

    const tokenResponse = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: '349eTg55tt6ZVaefjBIAH',
        code: code,
        redirect_uri: redirect_uri,
        ...(code_verifier && { code_verifier: code_verifier }),
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', tokenData)
      return res.status(400).json({ 
        error: 'Token exchange failed', 
        details: tokenData 
      })
    }

    console.log('✅ Token exchange successful!')
    res.status(200).json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
    })

  } catch (error) {
    console.error('❌ Error exchanging token:', error)
    res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
