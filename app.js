import { AutoDAI } from './src/core/autod-ai.js';
import { DennyBot } from './src/core/denny-bots.js';
import { AutomatedBot } from './src/core/automated-bot.js';

const autoD = new AutoDAI();
const denny = new DennyBot();
const autoBot = new AutomatedBot(100.0); // Initialized with $100 starting capital

console.log("Mwathe Trade Systems: All Engines Online");

// Select top performing market via Multi-Armed Bandit
const target = autoBot.selectOptimalSymbol();
console.log(`Bandit Selected Market: ${target.symbol} (Score: ${target.ucbScore})`);

// Connect WebSocket
denny.connect();

// Stream ticks into AutoD AI
denny.subscribeTicks(target.symbol, (tickData) => {
    autoD.addDigit(tickData.lastDigit);
    const state = autoD.predictNextState();

    console.log(`[${target.symbol}] Quote: ${tickData.quote} | Last: ${tickData.lastDigit} | Entropy: ${state.entropy}`);

    if (state.isValidSignal && state.predictedDigit !== null) {
        const currentStake = autoBot.getCurrentStake();
        console.log(`>>> EXECUTING SNIPE: Target Digit ${state.predictedDigit} | Stake: $${currentStake}`);
        
        // denny.executeTrade({
        //     symbol: target.symbol,
        //     contractType: 'DIGITMATCH',
        //     amount: currentStake,
        //     barrier: state.predictedDigit.toString()
        // });
    }
});

