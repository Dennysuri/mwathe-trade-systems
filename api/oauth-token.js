export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, codeVerifier, redirectUri, appId } = req.body || {};

    if (!code || !codeVerifier) {
        return res.status(400).json({ error: 'Missing code or code verifier' });
    }

    try {
        // 1. Exchange PKCE code for OAuth Access Token
        const bodyParams = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: '349eTg55tt6ZVaefjBIAH',
            code: code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri || 'https://mwathe-trade-systems.vercel.app/'
        });

        const tokenRes = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString()
        });

        const tokenData = await tokenRes.json().catch(() => ({}));

        if (!tokenRes.ok) {
            return res.status(tokenRes.status).json({
                error: tokenData.error_description || tokenData.error || 'Token exchange failed',
                details: tokenData
            });
        }

        const accessToken = tokenData.access_token;
        if (!accessToken) {
            return res.status(500).json({ error: 'No access token received' });
        }

        // 2. Request Authenticated WebSocket Session Endpoint from Deriv
        const wsEndpointRes = await fetch('https://api.deriv.com/trading/v1/accounts/websocket', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Deriv-App-ID': appId || '1089'
            }
        });

        const wsEndpointData = await wsEndpointRes.json().catch(() => ({}));

        return res.status(200).json({
            access_token: accessToken,
            websocket_url: wsEndpointData.websocket_url || null,
            token_type: tokenData.token_type
        });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
