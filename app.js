import { AutoDAI } from './src/core/autod-ai.js';
import { DennyBot } from './src/core/denny-bots.js';
import { AutomatedBot } from './src/core/automated-bot.js';

const autoD = new AutoDAI();
const denny = new DennyBot();
const autoBot = new AutomatedBot(100.0);

// DOM References
const symbolEl = document.getElementById('symbol-display');
const digitEl = document.getElementById('digit-display');
const entropyEl = document.getElementById('entropy-display');
const entropyBar = document.getElementById('entropy-bar');
const stakeEl = document.getElementById('stake-display');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const regimeTag = document.getElementById('regime-tag');
const histoContainer = document.getElementById('histogram-container');
const logEl = document.getElementById('terminal-log');
const tokenInput = document.getElementById('api-token');
const authBtn = document.getElementById('auth-btn');
const clearLogBtn = document.getElementById('clear-log-btn');

// Initialize 0-9 Histogram DOM
for (let i = 0; i <= 9; i++) {
    const col = document.createElement('div');
    col.className = 'histo-col';
    col.innerHTML = `
        <div class="histo-bar-wrapper">
            <div class="histo-bar" id="bar-${i}"></div>
        </div>
        <span class="histo-num">${i}</span>
    `;
    histoContainer.appendChild(col);
}

function updateHistogram(history) {
    if (history.length === 0) return;
    const counts = Array(10).fill(0);
    history.forEach(d => counts[d]++);
    const maxCount = Math.max(...counts, 1);

    for (let i = 0; i <= 9; i++) {
        const bar = document.getElementById(`bar-${i}`);
        const pct = (counts[i] / maxCount) * 100;
        bar.style.height = `${Math.max(pct, 8)}%`;
        
        if (counts[i] === maxCount && counts[i] > 2) {
            bar.classList.add('hot');
        } else {
            bar.classList.remove('hot');
        }
    }
}

function log(msg, type = 'normal') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.prepend(entry);
}

clearLogBtn.addEventListener('click', () => { logEl.innerHTML = ''; });

// Persistent Token Auth
const savedToken = localStorage.getItem('mwathe_deriv_token');
if (savedToken) tokenInput.value = savedToken;

authBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token) {
        localStorage.setItem('mwathe_deriv_token', token);
        denny.authorize(token);
        log("Authenticating session token...", "sys");
    }
});

// Run Core Engine
const target = autoBot.selectOptimalSymbol();
symbolEl.innerText = target.symbol;
stakeEl.innerText = `$${autoBot.getCurrentStake()}`;

denny.connect(savedToken || null);

denny.subscribeTicks(target.symbol, (tickData) => {
    statusDot.classList.add('online');
    statusText.innerText = "STREAMING";

    digitEl.innerText = tickData.lastDigit;

    autoD.addDigit(tickData.lastDigit);
    const state = autoD.predictNextState();

    // Entropy & UI Telemetry
    entropyEl.innerText = state.entropy;
    entropyBar.style.width = `${Math.min(state.entropy * 100, 100)}%`;
    
    if (state.entropy < 0.80) {
        entropyBar.style.backgroundColor = 'var(--accent-green)';
        regimeTag.innerText = "PATTERN DETECTED";
        regimeTag.style.color = 'var(--accent-green)';
    } else {
        entropyBar.style.backgroundColor = 'var(--accent-red)';
        regimeTag.innerText = "HIGH NOISE";
        regimeTag.style.color = 'var(--accent-red)';
    }

    updateHistogram(autoD.history);

    log(`[${target.symbol}] Quote: ${tickData.quote} | Digit: ${tickData.lastDigit}`);

    if (state.isValidSignal && state.predictedDigit !== null) {
        const currentStake = autoBot.getCurrentStake();
        log(`>>> SNIPE SIGNAL: Target Digit ${state.predictedDigit} | Stake: $${currentStake}`, "signal");
    }
});

