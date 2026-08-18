// Set your numeric Deriv App ID registered on developers.deriv.com
const APP_ID = "63749"; // Replace with your numeric App ID if different
const REDIRECT_URI = window.location.origin + window.location.pathname;

// --- Screen Router ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// --- Deriv OAuth Flow ---
function loginToDeriv() {
    const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=EN&brand=deriv`;
    window.location.href = authUrl;
}

// --- Direct Token Authentication ---
function connectWithToken() {
    const tokenInput = document.getElementById("api-token-input");
    const connectBtn = document.getElementById("btn-connect-token");
    const token = tokenInput ? tokenInput.value.trim() : "";

    if (!token) {
        alert("Please paste a valid API token first.");
        return;
    }

    connectBtn.innerText = "Connecting...";
    connectBtn.disabled = true;

    initializeSocketWithToken(token, connectBtn);
}

// --- Deriv WebSocket Connection Handler ---
function initializeSocketWithToken(token, buttonEl = null) {
    // Official WebSocket Server
    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;
    const socket = new WebSocket(wsUrl);

    // 10 second timeout check
    const connectionTimeout = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
            socket.close();
            alert("Connection timed out. Check your internet connection.");
            if (buttonEl) {
                buttonEl.innerText = "Connect API";
                buttonEl.disabled = false;
            }
        }
    }, 10000);

    socket.onopen = () => {
        clearTimeout(connectionTimeout);
        if (buttonEl) buttonEl.innerText = "Authorizing...";
        // Send authorization payload
        socket.send(JSON.stringify({ authorize: token }));
    };

    socket.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);

            // Response to authorization payload
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

                // Authentication Successful
                if (buttonEl) {
                    buttonEl.innerText = "Connected!";
                }

                showScreen('trading-screen');
                const bal = data.authorize.balance ? parseFloat(data.authorize.balance).toFixed(2) : "0.00";
                document.getElementById('account-balance').innerText = bal;

                // Subscribe to live balance updates
                socket.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            }

            // Streamed balance updates
            if (data.msg_type === 'balance' && data.balance) {
                document.getElementById('account-balance').innerText = parseFloat(data.balance.balance).toFixed(2);
            }
        } catch (err) {
            console.error("Payload error:", err);
        }
    };

    socket.onerror = (err) => {
        clearTimeout(connectionTimeout);
        alert("WebSocket Connection Error. Verify network access.");
        if (buttonEl) {
            buttonEl.innerText = "Connect API";
            buttonEl.disabled = false;
        }
    };

    socket.onclose = () => {
        console.log("WebSocket connection closed.");
    };
}

// --- Check for OAuth Return Tokens ---
function handleOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    // Deriv OAuth returns tokens as token1, token2, etc., in query parameters
    const token1 = urlParams.get('token1');

    if (token1) {
        // Clean URL query string
        window.history.replaceState({}, document.title, window.location.pathname);
        initializeSocketWithToken(token1);
    }
}

// --- Attach UI Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
    const btnGotoNav = document.getElementById("btn-goto-nav");
    if (btnGotoNav) btnGotoNav.onclick = () => showScreen('navigation-screen');

    const btnConnectToken = document.getElementById("btn-connect-token");
    if (btnConnectToken) btnConnectToken.onclick = connectWithToken;

    const btnLoginDeriv = document.getElementById("btn-login-deriv");
    if (btnLoginDeriv) btnLoginDeriv.onclick = loginToDeriv;

    handleOAuthReturn();
});
