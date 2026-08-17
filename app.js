import { AutoDAI } from './src/core/autod-ai.js';

const autoD = new AutoDAI();

// Simulated tick stream demonstration
console.log("AutoD AI Module Loaded");

// Example tick feed processing
const mockTicks = [5, 2, 8, 2, 8, 2, 8, 3, 2, 8, 1, 9, 2, 8];

mockTicks.forEach(digit => {
    autoD.addDigit(digit);
    const prediction = autoD.predictNextState();
    console.log(`Ingested: ${digit} | Entropy: ${prediction.entropy} | Next Predicted: ${prediction.predictedDigit} (p=${prediction.probability})`);
});

