import { AutoDAI } from './src/core/autod-ai.js';
import { DennyBot } from './src/core/denny-bots.js';
import { AutomatedBot } from './src/core/automated-bot.js';

const autoD = new AutoDAI();
const denny = new DennyBot();
const autoBot = new AutomatedBot(100.0);

// DOM Elements
const symbolEl = document.getElementById('symbol-display');
const digitEl = document.getElementById('digit-display');
const entropyEl = document.getElementById('entropy-display');
const stakeEl = document.getElementById('stake-display');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('terminal-log');

function log(msg, isSignal = false) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${isSignal ? 'signal' : ''}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.prepend(entry);
}

const target = autoBot.selectOptimalSymbol();
symbolEl.innerText = target.symbol;
stakeEl.innerText = `$${autoBot.getCurrentStake()}`;
statusEl.innerText = "Connecting WebSocket...";

denny.connect();

denny.subscribeTicks(target.symbol, (tickData) => {
    statusEl.innerText = "Streaming Ticks";
    digitEl.innerText = tickData.lastDigit;

    autoD.addDigit(tickData.lastDigit);
    const state = autoD.predictNextState();

    entropyEl.innerText = state.entropy;

    log(`[${target.symbol}] Quote: ${tickData.quote} | Digit: ${tickData.lastDigit} | Entropy: ${state.entropy}`);

    if (state.isValidSignal && state.predictedDigit !== null) {
        const currentStake = autoBot.getCurrentStake();
        log(`>>> SNIPE TRIGGERED: Target Digit ${state.predictedDigit} | Stake: $${currentStake}`, true);
    }
});

