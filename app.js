const CLIENT_ID = "349eTg55tt6ZVaefjBIAH";
const REDIRECT_URI = "https://mwathe-trade-systems.vercel.app/";

// --- Screen Router ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// --- URL-Safe Hex Generator for State ---
function generateHexState(length = 32) {
    const array = new Uint8Array(length / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

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

// --- Deriv OAuth Redirect Trigger ---
async function loginToDeriv() {
    try {
        const verifier = generateCodeVerifier();
        const state = generateHexState(32);

        sessionStorage.setItem('code_verifier', verifier);
        sessionStorage.setItem('oauth_state', state);

        const challenge = await generateCodeChallenge(verifier);
        
        const authUrl = `https://auth.deriv.com/oauth2/auth?` +
            `response_type=code&` +
            `client_id=${CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `code_challenge=${challenge}&` +
            `code_challenge_method=S256&` +
            `state=${encodeURIComponent(state)}&` +
            `scope=trade+account_manage`;

        window.location.href = authUrl;
    } catch (err) {
        alert("Failed to initialize OAuth request: " + err.message);
    }
}

// --- Direct Token Input Connect ---
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

// --- WebSocket Setup & Screen Transition ---
function initializeSocketWithToken(token, buttonEl = null) {
    if (!token || typeof token !== 'string') {
        alert("Invalid access token provided.");
        if (buttonEl) {
            buttonEl.innerText = "Connect API";
            buttonEl.disabled = false;
        }
        return;
    }

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
                
                // --- Switch to Trading Screen ---
                showScreen('trading-screen');

                const bal = data.authorize.balance ? parseFloat(data.authorize.balance).toFixed(2) : "0.00";
                const balEl = document.getElementById('account-balance');
                if (balEl) balEl.innerText = bal;

                socket.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            }

            if (data.msg_type === 'balance' && data.balance) {
                const balEl = document.getElementById('account-balance');
                if (balEl) balEl.innerText = parseFloat(data.balance.balance).toFixed(2);
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

// --- Handle Return Code Exchange ---
async function handleOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const returnedState = urlParams.get('state');

    if (code) {
        const storedState = sessionStorage.getItem('oauth_state');
        if (returnedState && storedState && returnedState !== storedState) {
            alert("Security Error: Invalid state parameter (CSRF detected)");
            return;
        }

        const codeVerifier = sessionStorage.getItem('code_verifier');
        
        // Remove code and parameters from address bar
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
            const res = await fetch('/api/oauth-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, codeVerifier, redirectUri: REDIRECT_URI })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Token exchange failed");

            const accessToken = data.access_token;
            if (!accessToken) throw new Error("No access token returned from backend endpoint");

            initializeSocketWithToken(accessToken);
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
