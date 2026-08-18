const CLIENT_ID = "349eTg55tt6ZVaefjBIAH";
const REDIRECT_URI = "https://mwathe-trade-systems.vercel.app/callback";

// --- Screen Navigation Engine ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// --- Deriv OAuth Redirect (Authorization Page) ---
function loginToDeriv() {
    const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = authUrl;
}

// --- Connect via API Token ---
function connectWithToken() {
    const token = document.getElementById("api-token-input").value.trim();
    if (!token) {
        alert("Please enter a valid API token.");
        return;
    }
    
    initializeSocketWithToken(token);
}

// --- WebSocket Balance Stream ---
function initializeSocketWithToken(token) {
    const socket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=" + CLIENT_ID);

    socket.onopen = () => {
        socket.send(JSON.stringify({ authorize: token }));
    };

    socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.msg_type === 'authorize') {
            if (data.error) {
                alert("Connection failed: " + data.error.message);
                return;
            }
            
            showScreen('trading-screen');
            document.getElementById('account-balance').innerText = parseFloat(data.authorize.balance).toFixed(2);

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
