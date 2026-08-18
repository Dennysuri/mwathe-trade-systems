const CLIENT_ID = "349eTg55tt6ZVaefjBIAH";
const REDIRECT_URI = "https://mwathe-trade-systems.vercel.app/callback";

// --- Screen Navigation Engine ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// --- Deriv OAuth Redirect ---
function loginToDeriv() {
    const authUrl = `https://oauth.deriv.com/oauth2/authorize?` +
        `app_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = authUrl;
}

// --- Connect via API Token ---
function connectWithToken() {
    const token = document.getElementById("api-token-input").value.trim();
    if (!token) {
        alert("Please enter a valid API token.");
        return;
    }
    
    // Connect WebSocket using raw token
    initializeSocketWithToken(token);
}

// --- WebSocket Balance Stream ---
function initializeSocketWithToken(token) {
    const socket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=" + CLIENT_ID);

    socket.onopen = () => {
        // Authorize session
        socket.send(JSON.stringify({ authorize: token }));
    };

    socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.msg_type === 'authorize') {
            if (data.error) {
                alert("Connection failed: " + data.error.message);
                return;
            }
            
            // On successful authorization, switch directly to Trading Page
            showScreen('trading-screen');
            document.getElementById('account-balance').innerText = parseFloat(data.authorize.balance).toFixed(2);

            // Subscribe to real-time balance changes
            socket.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        }

        if (data.msg_type === 'balance') {
            if (data.balance) {
                document.getElementById('account-balance').innerText = parseFloat(data.balance.balance).toFixed(2);
            }
        }
    };
}

// --- OAuth Return Callback Handler ---
function handleOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const token1 = urlParams.get('token1');

    if (token1) {
        // Clean URL bar parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        // Directly connect and switch to Trading Page
        initializeSocketWithToken(token1);
    }
}

// Attach Event Handlers
document.addEventListener("DOMContentLoaded", () => {
    // 1. Dashboard "Get Started" moves to Navigation Page
    document.getElementById("btn-goto-nav").onclick = () => showScreen('navigation-screen');

    // 2. Navigation Page Actions
    document.getElementById("btn-connect-token").onclick = connectWithToken;
    document.getElementById("btn-login-deriv").onclick = loginToDeriv;

    // Check if returning from OAuth
    handleOAuthReturn();
});
