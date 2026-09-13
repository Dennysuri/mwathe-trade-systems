// ========== CONFIGURATION ==========
const CLIENT_ID = "349eTg55tt6ZVaefjBIAH";
const REDIRECT_URI = "https://mwathe-trade-systems.vercel.app/";
const DERIV_AUTH_URL = "https://auth.deriv.com/oauth2/auth";
const DERIV_TOKEN_URL = "https://auth.deriv.com/oauth2/token";
const WS_APP_ID = 1089;

// ========== GLOBAL STATE ==========
const state = {
  apiConnected: false,
  apiToken: '',
  balance: 0,
  socket: null,
  sidebarExpanded: false,
  currentPage: 'analysis',
};

// ========== DOM REFS ==========
const $ = id => document.getElementById(id);
const dashScreen = $('dashboard-screen');
const navScreen = $('navigation-screen');
const tradingScreen = $('trading-screen');
const connectBtn = $('btn-connect-token');
const tokenInput = $('api-token-input');
const statusDot = $('statusDot');
const statusText = $('statusText');
const tradingApiDot = $('tradingApiDot');
const tradingApiLabel = $('tradingApiLabel');
const balanceDisplay = $('account-balance');
const pageTitle = $('pageTitle');
const sidebar = $('sidebar');
const contentArea = $('contentArea');

// ========== SCREEN NAVIGATION ==========
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

function goToNavigation() {
  dashScreen.classList.remove('active');
  navScreen.classList.add('active');
}

// ========== OAUTH PKCE HELPERS ==========
function generateHexState(length = 32) {
  const array = new Uint8Array(length / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ========== DERIV OAUTH LOGIN ==========
async function loginToDeriv() {
  try {
    const verifier = generateCodeVerifier();
    const stateParam = generateHexState(32);
    sessionStorage.setItem('code_verifier', verifier);
    sessionStorage.setItem('oauth_state', stateParam);
    const challenge = await generateCodeChallenge(verifier);
    const authUrl =
      `${DERIV_AUTH_URL}?` +
      `response_type=code&` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `code_challenge=${challenge}&` +
      `code_challenge_method=S256&` +
      `state=${encodeURIComponent(stateParam)}&` +
      `scope=trade+account_manage`;
    window.location.href = authUrl;
  } catch (err) {
    alert("Failed to initialize OAuth request: " + err.message);
  }
}

// ========== OAUTH RETURN HANDLER (Client‑Side Token Exchange) ==========
async function handleOAuthReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const returnedState = urlParams.get('state');
  if (!code) return;

  // Verify state
  const storedState = sessionStorage.getItem('oauth_state');
  if (returnedState && storedState && returnedState !== storedState) {
    alert("Security Error: State parameter mismatch");
    return;
  }

  const codeVerifier = sessionStorage.getItem('code_verifier');
  if (!codeVerifier) {
    alert("No code verifier found. Please try again.");
    return;
  }

  // Clean URL
  window.history.replaceState({}, document.title, window.location.pathname);

  try {
    // Exchange code for token
    const response = await fetch(DERIV_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code: code,
        code_verifier: codeVerifier,
      })
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || "Token exchange failed");
    }

    const accessToken = data.access_token;
    if (!accessToken) throw new Error("No access token returned");

    // Connect WebSocket with the obtained token
    initializeSocketWithToken(accessToken);

    // Clear stored verifier
    sessionStorage.removeItem('code_verifier');
    sessionStorage.removeItem('oauth_state');

  } catch (err) {
    alert("OAuth Token Exchange Error: " + err.message);
  }
}

// ========== API TOKEN CONNECTION ==========
function connectWithToken() {
  const token = tokenInput.value.trim();
  if (!token) { alert("Please enter a valid API token."); return; }
  connectBtn.innerText = "Connecting...";
  connectBtn.disabled = true;
  initializeSocketWithToken(token, connectBtn);
}

function initializeSocketWithToken(token, buttonEl = null) {
  if (!token || typeof token !== 'string') {
    alert("Invalid access token.");
    if (buttonEl) { buttonEl.innerText = "Connect API"; buttonEl.disabled = false; }
    return;
  }

  // Close any existing socket
  if (state.socket) {
    state.socket.close();
    state.socket = null;
  }

  const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${WS_APP_ID}`;
  const socket = new WebSocket(wsUrl);
  state.socket = socket;

  const timeout = setTimeout(() => {
    if (socket.readyState !== WebSocket.OPEN) {
      socket.close();
      alert("Connection timed out.");
      if (buttonEl) { buttonEl.innerText = "Connect API"; buttonEl.disabled = false; }
    }
  }, 10000);

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
          if (buttonEl) { buttonEl.innerText = "Connect API"; buttonEl.disabled = false; }
          socket.close();
          return;
        }
        // Success
        state.apiConnected = true;
        state.apiToken = token;
        if (buttonEl) buttonEl.innerText = "Connected!";
        statusDot.className = 'dot on';
        statusText.textContent = 'Connected successfully';
        statusText.style.color = 'var(--accent-green)';
        tradingApiDot.className = 'dot on';
        tradingApiLabel.textContent = 'API: On';
        tradingApiLabel.style.color = 'var(--accent-green)';

        const bal = data.authorize.balance ? parseFloat(data.authorize.balance).toFixed(2) : "0.00";
        state.balance = parseFloat(bal);
        if (balanceDisplay) balanceDisplay.innerText = bal;

        // Subscribe to balance updates
        socket.send(JSON.stringify({ balance: 1, subscribe: 1 }));

        // Navigate to trading
        showScreen('trading-screen');
        switchTradingPage('analysis');
      }
      if (data.msg_type === 'balance' && data.balance) {
        const bal = parseFloat(data.balance.balance).toFixed(2);
        state.balance = parseFloat(bal);
        if (balanceDisplay) balanceDisplay.innerText = bal;
      }
    } catch (err) {
      console.error("Payload parse error:", err);
    }
  };

  socket.onerror = () => {
    clearTimeout(timeout);
    alert("WebSocket connection failed.");
    if (buttonEl) { buttonEl.innerText = "Connect API"; buttonEl.disabled = false; }
  };

  socket.onclose = () => {
    if (buttonEl && buttonEl.innerText !== "Connected!") {
      buttonEl.innerText = "Connect API";
      buttonEl.disabled = false;
    }
  };
}

// ========== DISCONNECT ==========
function disconnectAPI() {
  if (!state.apiConnected) return;
  if (confirm('Disconnect from API?')) {
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }
    state.apiConnected = false;
    state.apiToken = '';
    connectBtn.innerText = "Connect API";
    connectBtn.disabled = false;
    statusDot.className = 'dot off';
    statusText.textContent = 'Not connected';
    statusText.style.color = '';
    tradingApiDot.className = 'dot off';
    tradingApiLabel.textContent = 'API: Off';
    tradingApiLabel.style.color = '';
    // Stop all engines
    if (window.stopAllEngines) window.stopAllEngines();
    showScreen('navigation-screen');
  }
}

// ========== SIDEBAR ==========
function toggleSidebar() {
  state.sidebarExpanded = !state.sidebarExpanded;
  sidebar.classList.toggle('expanded', state.sidebarExpanded);
}

const pageMap = {
  'analysis': 'Analysis Tool',
  'signals': 'Signals',
  'copy': 'Copy Trading',
  'bot': 'Auto Bot',
  'ai': 'AutoD AI',
  'settings': 'Settings',
  'admin': 'Admin Panel'
};

function switchTradingPage(page) {
  state.currentPage = page;
  document.querySelectorAll('.sidebar .menu-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  pageTitle.textContent = pageMap[page] || page;
  if (window.renderPage) {
    window.renderPage(page, contentArea);
  } else {
    contentArea.innerHTML = `<div class="subpage-card"><h3>${pageMap[page]}</h3><p class="text-muted">Loading...</p></div>`;
    loadModule(page);
  }
  if (page === 'ai' && state.apiConnected && !window.aiUnlocked) {
    showAIPasswordOverlay();
  }
}

function loadModule(page) {
  const scriptMap = {
    'analysis': 'analysis.js',
    'signals': 'signals.js',
    'copy': 'copy-trading.js',
    'bot': 'bot.js',
    'ai': 'ai.js',
    'settings': 'settings.js',
    'admin': 'admin.js'
  };
  const src = scriptMap[page];
  if (!src) return;
  if (window[page + 'Loaded']) return;
  const script = document.createElement('script');
  script.src = src;
  script.onload = () => {
    window[page + 'Loaded'] = true;
    if (window.renderPage) window.renderPage(page, contentArea);
  };
  document.head.appendChild(script);
}

// ========== AI PASSWORD OVERLAY ==========
function showAIPasswordOverlay() {
  $('aiPasswordOverlay').classList.add('show');
  $('aiPasswordInput').value = '';
  $('aiPasswordInput').focus();
  $('aiPasswordError').classList.remove('show');
}

function verifyAIPassword() {
  const pwd = $('aiPasswordInput').value;
  if (pwd === 'Denny@1249') {
    window.aiUnlocked = true;
    $('aiPasswordOverlay').classList.remove('show');
    if (window.onAIUnlocked) window.onAIUnlocked();
  } else {
    $('aiPasswordError').classList.add('show');
    $('aiPasswordInput').value = '';
    $('aiPasswordInput').focus();
  }
}

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if ($('aiPasswordOverlay').classList.contains('show')) {
      verifyAIPassword();
      return;
    }
    if (navScreen.classList.contains('active') && document.activeElement === tokenInput) {
      connectWithToken();
      return;
    }
  }
  if (e.key === 'Escape') {
    if ($('aiPasswordOverlay').classList.contains('show')) {
      $('aiPasswordOverlay').classList.remove('show');
    }
  }
});

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", () => {
  const btnGotoNav = document.getElementById("btn-goto-nav");
  if (btnGotoNav) btnGotoNav.onclick = goToNavigation;

  const btnConnectToken = document.getElementById("btn-connect-token");
  if (btnConnectToken) btnConnectToken.onclick = connectWithToken;

  const btnLoginDeriv = document.getElementById("btn-login-deriv");
  if (btnLoginDeriv) btnLoginDeriv.onclick = loginToDeriv;

  handleOAuthReturn();
});

console.log('🚀 Mwathe Trade Systems loaded.');
console.log('🔑 Password for AutoD AI: Denny@1249');
console.log('👤 Admin: dennysuri858@gmail.com / dennysuri12');
