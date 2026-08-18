const APP_ID = "1089";
const CLIENT_ID = "349eTg55tt6ZVaefjBIAH";
const REDIRECT_URI = "https://mwathe-trade-systems.vercel.app/";

// --- Screen Router ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// --- Hex Generator for URL-Safe State ---
function generateHexState(length = 32) {
    const array = new Uint8Array(length / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// --- Deriv OAuth Redirect Trigger ---
function loginToDeriv() {
    try {
        const state = generateHexState(32);
        sessionStorage.setItem('oauth_state', state);

        const authUrl = `https://oauth.deriv.com/oauth2/authorize?` +
            `app_id=${APP_ID}&` +
            `client_id=${CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
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

// --- WebSocket Connection & Session Setup ---
function initializeSocketWithToken(token, buttonEl = null) {
    if (!token || typeof token !== 'string') {
        alert("Invalid access token provided.");
        if (buttonEl) {
            buttonEl.innerText = "Connect API";
            buttonEl.disabled = false;
        }
        return;
    }

    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;
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
                
                // Switch directly to trading screen
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

// --- Direct Query Parameter Parsing ---
function handleOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const returnedState = urlParams.get('state');
    
    // Parse token1 returned by Deriv
    const token = urlParams.get('token1') || urlParams.get('token');

    if (token) {
        const storedState = sessionStorage.getItem('oauth_state');
        if (returnedState && storedState && returnedState !== storedState) {
            alert("Security Error: Invalid state parameter (CSRF detected)");
            return;
        }

        // Clean up URL parameter string from browser address bar
        window.history.replaceState({}, document.title, window.location.pathname);

        // Connect directly to WebSocket using extracted token
        initializeSocketWithToken(token);
    }
}

// Attach UI Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    const btnGotoNav = document.getElementById("btn-goto-nav");
    if (btnGotoNav) btnGotoNav.onclick = () => showScreen('navigation-screen');

    const btnConnectToken = document.getElementById("btn-connect-token");
    if (btnConnectToken) btnConnectToken.onclick = connectWithToken;

    const btnLoginDeriv = document.getElementById("btn-login-deriv");
    if (btnLoginDeriv) btnLoginDeriv.onclick = loginToDeriv;

    handleOAuthReturn();
});
