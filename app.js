import { AutoDAI } from './src/core/autod-ai.js';
import { DennyBot } from './src/core/denny-bots.js';

const autoD = new AutoDAI();
const bot = new DennyBot();

console.log("Mwathe Trade Systems Initializing...");

// Connect to WebSocket feed
bot.connect();

// Stream ticks directly into AutoD AI
bot.subscribeTicks('R_100', (tickData) => {
    autoD.addDigit(tickData.lastDigit);
    const state = autoD.predictNextState();

    console.log(`[R_100] Quote: ${tickData.quote} | Digit: ${tickData.lastDigit} | Entropy: ${state.entropy} | Regime: ${state.regime}`);

    // If AutoD AI detects an ordered pattern signal, trigger a trade automatically
    if (state.isValidSignal && state.predictedDigit !== null) {
        console.log(`>>> AUTO-TRIGGER: High Probability Detected for Digit ${state.predictedDigit}`);
        // bot.executeTrade({ symbol: 'R_100', contractType: 'DIGITMATCH', barrier: state.predictedDigit.toString() });
    }
});

