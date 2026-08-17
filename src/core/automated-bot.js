/**
 * Automated Bot - Capital & Multi-Armed Bandit Engine
 * Dynamically ranks symbols/strategies and manages stake escalation (Martingale / D'Alembert).
 */

export class AutomatedBot {
    constructor(initialBalance = 100) {
        this.balance = initialBalance;
        this.stake = 1.0;
        this.baseStake = 1.0;
        this.multiplier = 2.1; // Recovery factor for digit contracts
        this.maxStake = 50.0;
        
        // Multi-Armed Bandit state tracking across Volatility Indices
        this.symbols = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
        this.stats = {};

        this.symbols.forEach(sym => {
            this.stats[sym] = { wins: 1, losses: 1, totalPayout: 0 }; // Initialize with Laplace smoothing
        });
    }

    /**
     * Upper Confidence Bound (UCB1) algorithm to select optimal symbol
     */
    selectOptimalSymbol() {
        let totalTrades = 0;
        this.symbols.forEach(s => {
            totalTrades += (this.stats[s].wins + this.stats[s].losses);
        });

        let bestSymbol = this.symbols[0];
        let maxScore = -Infinity;

        this.symbols.forEach(sym => {
            const s = this.stats[sym];
            const n = s.wins + s.losses;
            const winRate = s.wins / n;
            
            // UCB1 formula: WinRate + Exploration Bonus
            const ucbScore = winRate + Math.sqrt((2 * Math.log(totalTrades)) / n);

            if (ucbScore > maxScore) {
                maxScore = ucbScore;
                bestSymbol = sym;
            }
        });

        return { symbol: bestSymbol, ucbScore: parseFloat(maxScore.toFixed(4)) };
    }

    /**
     * Handle trade results and update stake/risk engine
     */
    recordResult(symbol, isWin, payout = 0) {
        if (isWin) {
            this.stats[symbol].wins++;
            this.stats[symbol].totalPayout += payout;
            this.balance += payout;
            this.stake = this.baseStake; // Reset stake on win
            console.log(`[WIN] Balance: $${this.balance.toFixed(2)} | Stake reset to $${this.stake}`);
        } else {
            this.stats[symbol].losses++;
            this.balance -= this.stake;
            this.stake = Math.min(this.stake * this.multiplier, this.maxStake); // Escalate stake
            console.log(`[LOSS] Balance: $${this.balance.toFixed(2)} | Escalating stake to $${this.stake.toFixed(2)}`);
        }
    }

    getCurrentStake() {
        return parseFloat(this.stake.toFixed(2));
    }
}

