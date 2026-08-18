export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, codeVerifier, redirectUri } = req.body;

    if (!code || !codeVerifier) {
        return res.status(400).json({ error: 'Missing required authorization code or verifier' });
    }

    try {
        const bodyParams = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: '349eTg55tt6ZVaefjBIAH',
            code: code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri || 'https://mwathe-trade-systems.vercel.app/'
        });

        const response = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            body: bodyParams.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Deriv token exchange error payload:', data);
            return res.status(response.status).json({ 
                error: data.error_description || data.error || 'Token exchange failed',
                details: data
            });
        }

        const token = data.access_token || data.token;
        if (!token) {
            return res.status(500).json({ error: 'No token in response', raw: data });
        }

        return res.status(200).json({ access_token: token });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
