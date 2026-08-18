const express = require('express');
const app = express();

app.use(express.json());

const DERIV_OAUTH_TOKEN_URL = 'https://auth.deriv.com/oauth2/token';
const CLIENT_ID = process.env.DERIV_CLIENT_ID;
const REDIRECT_URI = process.env.DERIV_REDIRECT_URI;

app.post('/api/oauth/token', async (req, res) => {
  const { code, codeVerifier } = req.body;

  if (!code || !codeVerifier) {
    return res.status(400).json({ error: 'Authorization code and code_verifier are required.' });
  }

  try {
    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI
    });

    const response = await fetch(DERIV_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error during token exchange: ' + err.message });
  }
});

app.listen(3000, () => console.log('Auth server running on port 3000'));

