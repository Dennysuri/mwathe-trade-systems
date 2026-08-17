import { AutoDAI } from './src/core/autod-ai.js';
import { DennyBot } from './src/core/denny-bots.js';

const denny = new DennyBot();
const autoD = new AutoDAI();

// Views
const stageLanding = document.getElementById('page-landing');
const stageNavigation = document.getElementById('page-navigation');
const stageTrading = document.getElementById('page-trading');

// Controls
const btnGetStarted = document.getElementById('btn-get-started');
const btnOAuthConnect = document.getElementById('btn-oauth-connect');
const btnConnect = document.getElementById('btn-connect-api');
const btnDisconnect = document.getElementById('btn-disconnect');
const appIdInput = document.getElementById('app-id-input');
const tokenInput = document.getElementById('api-token');
const accountTypeSelect = document.getElementById('account-type-select');
const authStatusMsg = document.getElementById('auth-status-msg');

// Trading UI
const liveBalance = document.getElementById('live-balance');
const accountTypeTag = document.getElementById('account-type-tag');
const accountEmail = document.getElementById('account-email');
const menuSignals = document.getElementById('menu-signals');
const signalsLockBadge = document.getElementById('signals-lock-badge');
const signalsStatusText = document.getElementById('signals-status-text');
const terminalLog = document.getElementById('terminal-log');

let isAnalysisComplete = false;

function showStage(stageElement) {
    stageLanding.classList.remove('active');
    stageNavigation.classList.remove('active');
    stageTrading.classList.remove('active');

    stageElement.classList.add('active');
}

function log(msg) {
    const entry = document.createElement('div');
    entry.className = 'log-entry sys';
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    terminalLog.prepend(entry);
}

// 1. Navigation Actions
btnGetStarted.addEventListener('click', () => {
    showStage(stageNavigation);
});

// OAuth 2.0 Redirect Connection Flow
btnOAuthConnect.addEventListener('click', () => {
    const appId = appIdInput.value.trim() || '1089';
    const redirectUrl = window.location.origin + window.location.pathname;
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=EN&brand=deriv`;
    
    window.location.href = oauthUrl;
});

// 2. Token-Based Authentication via WebSocket
function authenticateWithToken(token) {
    authStatusMsg.className = 'auth-status';
    authStatusMsg.innerText = 'Connecting to Deriv WebSocket...';

    const appId = appIdInput.value.trim() || '1089';
    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        authStatusMsg.innerText = 'Authorizing API token permissions...';
        ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.msg_type === 'authorize') {
            if (data.error) {
                // Connection Failed -> Remain on Navigation Page & Show Error
                authStatusMsg.className = 'auth-status error';
                authStatusMsg.innerText = `Auth Failed: ${data.error.message}`;
                localStorage.removeItem('mwathe_deriv_token');
                showStage(stageNavigation);
            } else {
                // Connection Successful -> Land Directly on Trading Page
                localStorage.setItem('mwathe_deriv_token', token);

                const balance = data.authorize.balance;
                const isVirtual = data.authorize.is_virtual;
                const email = data.authorize.email || 'User';

                liveBalance.innerText = `$${parseFloat(balance).toFixed(2)}`;
                accountTypeTag.innerText = isVirtual ? 'DEMO' : 'LIVE';
                accountEmail.innerText = email;

                showStage(stageTrading);
                log(`Authorized: ${email} (${isVirtual ? 'Demo' : 'Real'})`);

                // Subscribe to real-time account balance updates
                ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            }
        } else if (data.msg_type === 'balance') {
            if (data.balance) {
                liveBalance.innerText = `$${parseFloat(data.balance.balance).toFixed(2)}`;
            }
        }
    };

    ws.onerror = (err) => {
        authStatusMsg.className = 'auth-status error';
        authStatusMsg.innerText = 'WebSocket connection error. Return to Navigation.';
        showStage(stageNavigation);
    };
}

btnConnect.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (!token) {
        authStatusMsg.className = 'auth-status error';
        authStatusMsg.innerText = 'Please enter a valid Deriv API token.';
        return;
    }
    authenticateWithToken(token);
});

btnDisconnect.addEventListener('click', () => {
    localStorage.removeItem('mwathe_deriv_token');
    showStage(stageNavigation);
});

// Check URL Params for Deriv OAuth Callback tokens (token1, acct1, etc.)
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token1 = urlParams.get('token1');
    if (token1) {
        tokenInput.value = token1;
        // Clean URL query params
        window.history.replaceState({}, document.title, window.location.pathname);
        authenticateWithToken(token1);
        return true;
    }
    return false;
}

// Auto-check saved session token or OAuth parameters on startup
window.addEventListener('DOMContentLoaded', () => {
    const hasOAuthToken = handleOAuthCallback();
    if (!hasOAuthToken) {
        const savedToken = localStorage.getItem('mwathe_deriv_token');
        if (savedToken) {
            tokenInput.value = savedToken;
            authenticateWithToken(savedToken);
        }
    }
});

// Trading Menu Logic
document.getElementById('menu-analysis').addEventListener('click', () => {
    isAnalysisComplete = true;
    signalsLockBadge.innerText = 'UNLOCKED';
    signalsLockBadge.style.background = '#00e676';
    signalsStatusText.innerText = 'AI Probability Signals Active';
    menuSignals.classList.remove('locked');
    log("Analysis complete. Signals module unlocked.");
});

document.getElementById('menu-signals').addEventListener('click', () => {
    if (!isAnalysisComplete) {
        alert("Please run the Analysis Tool first to unlock Signals.");
    } else {
        log("Accessing AI Signals matrix...");
    }
});

