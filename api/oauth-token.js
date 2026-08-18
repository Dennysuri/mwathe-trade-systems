export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, codeVerifier, redirectUri } = req.body;

    if (!code || !codeVerifier) {
        return res.status(400).json({ error: 'Missing code or code verifier' });
    }

    try {
        // 1. Exchange PKCE authorization code for OAuth JWT access_token
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

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
            return res.status(tokenRes.status).json({
                error: tokenData.error_description || tokenData.error || 'Token exchange failed',
                details: tokenData
            });
        }

        const accessToken = tokenData.access_token;
        if (!accessToken) {
            return res.status(500).json({ error: 'No access token in payload', raw: tokenData });
        }

        // 2. Fetch WebSocket OTP using the OAuth JWT access_token
        const otpRes = await fetch('https://api.deriv.com/trading/v1/options/accounts/me/otp', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const otpData = await otpRes.json();

        // If OTP endpoint returns valid token/otp, pass it to frontend
        const wsToken = otpData.otp || otpData.token || accessToken;

        return res.status(200).json({ ws_token: wsToken });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
