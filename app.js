const CLIENT_ID = "349eTg55tt6ZVaefjBIAH";
// Strict URL matching: protocol, domain, path, no trailing slash
const REDIRECT_URI = "https://mwathe-trade-systems.vercel.app/callback";

// --- Screen Router ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// --- PKCE Code Helpers ---
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

// --- Deriv OAuth Redirect ---
async function loginToDeriv() {
    try {
        const verifier = generateCodeVerifier();
        sessionStorage.setItem('code_verifier', verifier);

        const challenge = await generateCodeChallenge(verifier);
        
        // Endpoint: https://auth.deriv.com/oauth2/auth
        const authUrl = `https://auth.deriv.com/oauth2/auth?` +
            `response_type=code&` +
            `client_id=${CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `code_challenge=${challenge}&` +
            `code_challenge_method=S256&` +
            `scope=trade+account_manage`;

        window.location.href = authUrl;
    } catch (err) {
        alert("Failed to initialize OAuth request: " + err.message);
    }
}

// --- Direct Token Authentication (Option A) ---
function connectWithToken() {
    const tokenInput = document.getElementById("api-token-input");
    const connectBtn = document.getElementById("btn-connect-token");
    const token = tokenInput ? tokenInput.value.trim() : "";

    if (!token) {
        alert("Please enter a valid API token.");
        return;
    }

    if (connectBtn) {
        connectBtn.innerText = "Connecting...";
        connectBtn.disabled = true;
    }

    initializeSocketWithToken(token, connectBtn);
}

// --- WebSocket Balance & Account Session ---
function initializeSocketWithToken(token, buttonEl = null) {
    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=1089`;
    const socket = new WebSocket(wsUrl);

    const timeout = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
            socket.close();
            alert("Connection timed out.");
            if (buttonEl) {
                buttonEl.innerText = "Connect API";
                buttonEl.disabled = false;
            }
        }
    }, 8000);

    socket.onopen = () => {
        clearTimeout(timeout);
        if (buttonEl) buttonEl.innerText = "Authorizing...";
        socket.send(JSON.stringify({ authorize: token }));
    };

    socket.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);

            if (data.msg_type === 'authorize') {
                if (data.error) {
                    alert("Authorization failed: " + data.error.message);
                    if (buttonEl) {
                        buttonEl.innerText = "Connect API";
                        buttonEl.disabled = false;
                    }
                    socket.close();
                    return;
                }

                if (buttonEl) buttonEl.innerText = "Connected!";
                showScreen('trading-screen');

                const bal = data.authorize.balance ? parseFloat(data.authorize.balance).toFixed(2) : "0.00";
                document.getElementById('account-balance').innerText = bal;

                socket.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            }

            if (data.msg_type === 'balance' && data.balance) {
                document.getElementById('account-balance').innerText = parseFloat(data.balance.balance).toFixed(2);
            }
        } catch (err) {
            console.error("Payload parse error:", err);
        }
    };

    socket.onerror = () => {
        clearTimeout(timeout);
        alert("WebSocket connection failed.");
        if (buttonEl) {
            buttonEl.innerText = "Connect API";
            buttonEl.disabled = false;
        }
    };
}

// --- Exchange Code via Serverless API Token Endpoint ---
async function handleOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        const codeVerifier = sessionStorage.getItem('code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
            const res = await fetch('/api/oauth-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, codeVerifier, redirectUri: REDIRECT_URI })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Token exchange failed");

            // Initialize connection with returned access token
            initializeSocketWithToken(data.access_token);
        } catch (err) {
            alert("OAuth Exchange Error: " + err.message);
        }
    }
}

// Attach UI Listeners
document.addEventListener("DOMContentLoaded", () => {
    const btnGotoNav = document.getElementById("btn-goto-nav");
    if (btnGotoNav) btnGotoNav.onclick = () => showScreen('navigation-screen');

    const btnConnectToken = document.getElementById("btn-connect-token");
    if (btnConnectToken) btnConnectToken.onclick = connectWithToken;

    const btnLoginDeriv = document.getElementById("btn-login-deriv");
    if (btnLoginDeriv) btnLoginDeriv.onclick = loginToDeriv;

    handleOAuthReturn();
});
