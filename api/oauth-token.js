export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, codeVerifier, redirectUri } = req.body;

    try {
        const response = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: process.env.DERIV_CLIENT_ID || '349eTg55tt6ZVaefjBIAH',
                code: code,
                redirect_uri: redirectUri || 'https://mwathe-trade-systems.vercel.app/callback',
                code_verifier: codeVerifier
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error_description || data.error || 'Failed to exchange token' });
        }

        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
