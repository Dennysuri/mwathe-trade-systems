import { enforceRateLimit, isAllowedOrigin, setPrivateResponseHeaders } from './_lib/security.js'

const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || '349eTg55tt6ZVaefjBIAH'

export default async function handler(req, res) {
  setPrivateResponseHeaders(res)
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Request origin is not allowed.' })
  const allowed = await enforceRateLimit(req, res, {
    key: 'oauth-exchange',
    limit: 150,
    windowSeconds: 600,
  })
  if (!allowed) return

  const { code, redirect_uri, code_verifier } = req.body || {}
  if (
    typeof code !== 'string' || code.length < 1 || code.length > 4096 ||
    typeof redirect_uri !== 'string' ||
    typeof code_verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(code_verifier)
  ) {
    return res.status(400).json({ error: 'Invalid OAuth request.' })
  }

  let callback
  try {
    callback = new URL(redirect_uri)
  } catch {
    return res.status(400).json({ error: 'Invalid OAuth redirect URI.' })
  }

  if (
    callback.origin !== req.headers.origin ||
    callback.pathname !== '/callback' ||
    callback.search ||
    callback.hash
  ) {
    return res.status(400).json({ error: 'OAuth redirect URI does not match this application.' })
  }

  try {
    const tokenResponse = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: DERIV_CLIENT_ID,
        code,
        redirect_uri: callback.toString(),
        code_verifier,
      }),
      signal: AbortSignal.timeout(10000),
    })

    const tokenData = await tokenResponse.json().catch(() => null)
    if (!tokenResponse.ok || typeof tokenData?.access_token !== 'string') {
      return res.status(400).json({ error: 'Token exchange failed. Please reconnect your Deriv account.' })
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
    })
  } catch {
    return res.status(502).json({ error: 'The authorization service is temporarily unavailable.' })
  }
}
