/**
 * AutoD AI - Core Engine Module
 * Functions: Markov State Analysis, Shannon Entropy Calculation, Signal Validation
 */

export class AutoDAI {
    constructor() {
        this.history = [];
        this.maxHistory = 100; // Number of ticks to retain for analysis
        
        // 10x10 Transition Matrix for digits 0-9
        this.transitionMatrix = Array(10).fill(0).map(() => Array(10).fill(0));
        this.rowCounts = Array(10).fill(0);
        
        this.entropyThreshold = 0.85; // Signals emitted only when entropy drops below threshold
    }

    /**
     * Ingest a new digit from the tick stream
     * @param {number} digit - Last digit of tick price (0-9)
     */
    addDigit(digit) {
        if (digit < 0 || digit > 9) return;

        // Update Markov Matrix based on previous digit
        if (this.history.length > 0) {
            const prevDigit = this.history[this.history.length - 1];
            this.transitionMatrix[prevDigit][digit]++;
            this.rowCounts[prevDigit]++;
        }

        this.history.push(digit);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    /**
     * Calculate Shannon Entropy over current history buffer
     * Normalized scale: 0.0 (perfectly predictable) to 1.0 (pure random noise)
     */
    calculateEntropy() {
        if (this.history.length < 20) return 1.0; // Need minimum sample size

        const frequencies = Array(10).fill(0);
        this.history.forEach(d => frequencies[d]++);

        let entropy = 0;
        const total = this.history.length;

        for (let count of frequencies) {
            if (count > 0) {
                const p = count / total;
                entropy -= p * Math.log2(p);
            }
        }

        // Max possible entropy for 10 digits is log2(10) ≈ 3.3219
        const maxEntropy = Math.log2(10);
        return parseFloat((entropy / maxEntropy).toFixed(4));
    }

    /**
     * Get prediction state for the next digit based on the last observed digit
     * @returns {Object} Prediction state, probabilities, and market regime
     */
    predictNextState() {
        if (this.history.length < 2) {
            return { status: 'WAITING_FOR_DATA', probability: 0, predictedDigit: null };
        }

        const currentDigit = this.history[this.history.length - 1];
        const currentEntropy = this.calculateEntropy();
        const row = this.transitionMatrix[currentDigit];
        const totalTransitions = this.rowCounts[currentDigit];

        if (totalTransitions === 0) {
            return { status: 'NO_HISTORICAL_MATCH', entropy: currentEntropy };
        }

        // Find digit with highest transition probability from currentDigit
        let maxCount = -1;
        let predictedDigit = null;

        for (let d = 0; d < 10; d++) {
            if (row[d] > maxCount) {
                maxCount = row[d];
                predictedDigit = d;
            }
        }

        const probability = parseFloat((maxCount / totalTransitions).toFixed(4));
        const isValidSignal = currentEntropy < this.entropyThreshold && probability > 0.25;

        return {
            currentDigit,
            predictedDigit,
            probability,
            entropy: currentEntropy,
            regime: currentEntropy < 0.80 ? 'ORDERED/PATTERN' : 'NOISY/RANDOM',
            isValidSignal
        };
    }

    /**
     * Reset history and matrices for a fresh asset stream
     */
    reset() {
        this.history = [];
        this.transitionMatrix = Array(10).fill(0).map(() => Array(10).fill(0));
        this.rowCounts = Array(10).fill(0);
    }
}

