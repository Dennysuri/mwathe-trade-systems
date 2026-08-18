const REST_BASE = "https://api.derivws.com/trading/v1/options";
const CLIENT_ID = "349eTg55tt6ZVaefjBIAH";
const REDIRECT_URI = "https://mwathe-trade-systems.vercel.app/callback";

let engineInstance = null;

// --- PKCE Helpers ---

function generateCodeVerifier() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// --- OAuth Trigger ---

async function redirectToDerivLogin() {
    const verifier = generateCodeVerifier();
    sessionStorage.setItem('code_verifier', verifier);

    const challenge = await generateCodeChallenge(verifier);
    const authUrl = `https://auth.deriv.com/oauth2/authorize?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `code_challenge=${challenge}&` +
        `code_challenge_method=S256`;

    window.location.href = authUrl;
}

// --- Token Exchange via Vercel Serverless Endpoint ---

async function exchangeOAuthCode(code, codeVerifier) {
    const res = await fetch('/api/oauth-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'OAuth exchange failed');
    }

    return await res.json();
}

// --- Full Handshake Flow ---

async function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) return; // No callback code found, standard app load

    const codeVerifier = sessionStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error("Missing PKCE code_verifier in session storage.");
        return;
    }

    // Clean URL query parameters from browser address bar
    window.history.replaceState({}, document.title, window.location.pathname);

    try {
        console.log("Exchanging auth code for access token...");
        const tokenData = await exchangeOAuthCode(code, codeVerifier);
        const accessToken = tokenData.access_token;

        // Fetch User Accounts
        const accountsRes = await fetch(`${REST_BASE}/accounts`, {
            headers: {
                "Deriv-App-ID": CLIENT_ID,
                "Authorization": `Bearer ${accessToken}`
            }
        });
        const accounts = await accountsRes.json();
        const demoAccount = accounts.find(acc => acc.type === 'demo') || accounts[0];

        // Fetch WebSocket OTP
        const otpRes = await fetch(`${REST_BASE}/accounts/${demoAccount.id}/otp`, {
            method: "POST",
            headers: {
                "Deriv-App-ID": CLIENT_ID,
                "Authorization": `Bearer ${accessToken}`
            }
        });
        const otpData = await otpRes.json();

        // Launch WebSocket Engine Connection
        initializeTradingSocket(otpData.url);

    } catch (err) {
        console.error("Auth Handshake Failed:", err.message);
    }
}

// --- Engine Instantiation ---

function initializeTradingSocket(wsUrl) {
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("WebSocket connected. Initializing Trading Engine...");
        engineInstance = new DerivTradingEngine(socket);

        const btnStart = document.getElementById("btn-start-bot");
        const btnStop = document.getElementById("btn-stop-bot");
        const btnLogin = document.getElementById("btn-login");

        if (btnLogin) btnLogin.style.display = "none";
        if (btnStart) btnStart.onclick = () => engineInstance.startEngine();
        if (btnStop) btnStop.onclick = () => engineInstance.stopEngine("User manual stop");
    };

    socket.onerror = (err) => console.error("WS Error:", err);
    socket.onclose = () => {
        if (engineInstance) engineInstance.stopEngine("WebSocket Disconnected");
    };
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    const btnLogin = document.getElementById("btn-login");
    if (btnLogin) btnLogin.onclick = redirectToDerivLogin;

    // Check if returning from Deriv OAuth redirect
    handleOAuthCallback();
});
