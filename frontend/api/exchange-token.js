export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, redirect_uri } = req.body

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' })
  }

  try {
    // Exchange authorization code for access token
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
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData)
      return res.status(400).json({ error: 'Token exchange failed', details: tokenData })
    }

    // Return the access token
    res.status(200).json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
    })

  } catch (error) {
    console.error('Error exchanging token:', error)
    res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
