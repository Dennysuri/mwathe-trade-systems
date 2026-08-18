const CLIENT_ID = "349eTg55tt6ZVaefjBIAH";
const REDIRECT_URI = window.location.origin + window.location.pathname;

// --- Navigation Router ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// --- Deriv Modern OAuth Redirect ---
function loginToDeriv() {
    // Current Deriv OAuth authorization endpoint structure
    const authUrl = `https://auth.deriv.com/oauth2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=trade+account_manage`;
    window.location.href = authUrl;
}

// --- Manual API Token Authentication ---
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

// --- Direct WebSocket Connection ---
function initializeSocketWithToken(token, buttonEl = null) {
    // Standard persistent WebSocket connection
    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=1089`; 
    const socket = new WebSocket(wsUrl);

    const timeout = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
            socket.close();
            alert("Connection timed out. Check your token or network connection.");
            if (buttonEl) {
                buttonEl.innerText = "Connect API";
                buttonEl.disabled = false;
            }
        }
    }, 8000);

    socket.onopen = () => {
        clearTimeout(timeout);
        if (buttonEl) buttonEl.innerText = "Authorizing...";
        // Direct Authorization Payload
        socket.send(JSON.stringify({ authorize: token }));
    };

    socket.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);

            if (data.msg_type === 'authorize') {
                if (data.error) {
                    alert("API Connection Error: " + data.error.message);
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

                // Subscribe to live balance stream
                socket.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            }

            if (data.msg_type === 'balance' && data.balance) {
                document.getElementById('account-balance').innerText = parseFloat(data.balance.balance).toFixed(2);
            }
        } catch (err) {
            console.error("Payload error:", err);
        }
    };

    socket.onerror = (err) => {
        clearTimeout(timeout);
        alert("WebSocket Connection Failed. Ensure your network permits WebSocket traffic.");
        if (buttonEl) {
            buttonEl.innerText = "Connect API";
            buttonEl.disabled = false;
        }
    };
}

// --- Process Tokens from OAuth Return ---
function handleOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const token1 = urlParams.get('token1') || urlParams.get('code');

    if (token1) {
        window.history.replaceState({}, document.title, window.location.pathname);
        initializeSocketWithToken(token1);
    }
}

// Attach Event Handlers
document.addEventListener("DOMContentLoaded", () => {
    const btnGotoNav = document.getElementById("btn-goto-nav");
    if (btnGotoNav) btnGotoNav.onclick = () => showScreen('navigation-screen');

    const btnConnectToken = document.getElementById("btn-connect-token");
    if (btnConnectToken) btnConnectToken.onclick = connectWithToken;

    const btnLoginDeriv = document.getElementById("btn-login-deriv");
    if (btnLoginDeriv) btnLoginDeriv.onclick = loginToDeriv;

    handleOAuthReturn();
});
