class DerivTradingEngine {
    constructor(wsConnection) {
        this.ws = wsConnection;
        this.activeSubscriptions = new Map();
        this.tickHistory = [];
        this.isTrading = false;
        this.activeContractId = null;

        this.riskConfig = {
            initialStake: 0.50,
            maxDrawdown: 1.00,
            stopLoss: 1.50,
            takeProfit: 1.00,
            startBalance: 0,
            currentBalance: 0
        };

        this.initListeners();
    }

    initListeners() {
        this.ws.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                this.routeIncomingMessage(data);
            } catch (err) {
                console.error("Failed to parse WS payload:", err);
            }
        });
    }

    routeIncomingMessage(data) {
        if (data.msg_type === 'balance' || data.balance) {
            const current = parseFloat(data.balance.current || data.balance.balance);
            this.updateBalance(current);
        }

        if (data.msg_type === 'tick' || data.tick) {
            this.handleTickUpdate(data.tick);
        }

        if (data.msg_type === 'buy' || data.buy) {
            this.handleBuyResponse(data.buy || data);
        }

        if (data.msg_type === 'proposal_open_contract' || data.proposal_open_contract) {
            this.handleContractStatus(data);
        }
    }

    subscribeSymbolTicks(symbol = "R_100") {
        console.log(`Subscribing to tick stream: ${symbol}`);
        this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    }

    subscribeBalance() {
        this.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    }

    handleTickUpdate(tick) {
        if (!tick) return;

        const quote = tick.quote;
        const lastDigit = parseInt(quote.toString().slice(-1));

        this.tickHistory.push({ quote, lastDigit, epoch: tick.epoch });
        if (this.tickHistory.length > 50) this.tickHistory.shift();

        if (this.isTrading && !this.activeContractId) {
            this.evaluateSignals(lastDigit);
        }
    }

    evaluateSignals(lastDigit) {
        if (this.isRiskThresholdReached()) {
            this.stopEngine("Risk thresholds hit (Stop Loss or Drawdown cap).");
            return;
        }

        if (this.tickHistory.length >= 5) {
            const recent = this.tickHistory.slice(-3).map(t => t.lastDigit);
            
            if (recent[0] === recent[1] && recent[1] === recent[2]) {
                this.executeOptionContract({
                    symbol: "R_100",
                    contractType: "DIGITDIFF",
                    stake: this.riskConfig.initialStake,
                    barrier: recent[0].toString(),
                    duration: 1,
                    durationUnit: "t"
                });
            }
        }
    }

    executeOptionContract({ symbol, contractType, stake, barrier, duration, durationUnit }) {
        console.log(`Executing ${contractType} on ${symbol} with stake $${stake}`);

        const buyPayload = {
            buy: 1,
            price: stake,
            parameters: {
                amount: stake,
                basis: "stake",
                contract_type: contractType,
                currency: "USD",
                duration: duration,
                duration_unit: durationUnit,
                symbol: symbol
            }
        };

        if (barrier !== undefined) {
            buyPayload.parameters.barrier = barrier;
        }

        this.activeContractId = "PENDING";
        this.ws.send(JSON.stringify(buyPayload));
    }

    handleBuyResponse(buyData) {
        if (buyData.error) {
            console.error("Order Execution Error:", buyData.error.message);
            this.activeContractId = null;
            return;
        }

        this.activeContractId = buyData.contract_id;
        console.log(`Contract purchased successfully ID: ${this.activeContractId}`);

        this.ws.send(JSON.stringify({
            proposal_open_contract: 1,
            contract_id: this.activeContractId,
            subscribe: 1
        }));
    }

    handleContractStatus(response) {
        const contract = response.proposal_open_contract;
        if (!contract) return;

        // Store subscription ID for clean unsubscription
        if (response.subscription) {
            this.activeSubscriptions.set(contract.contract_id, response.subscription.id);
        }

        if (contract.is_sold || contract.status !== 'open') {
            const profit = parseFloat(contract.profit);
            console.log(`Contract ${contract.contract_id} closed. PnL: $${profit}`);

            const subId = this.activeSubscriptions.get(contract.contract_id);
            if (subId) {
                this.ws.send(JSON.stringify({ forget: subId }));
                this.activeSubscriptions.delete(contract.contract_id);
            }

            this.activeContractId = null;
        }
    }

    updateBalance(newBalance) {
        if (this.riskConfig.startBalance === 0) {
            this.riskConfig.startBalance = newBalance;
        }
        this.riskConfig.currentBalance = newBalance;
    }

    isRiskThresholdReached() {
        const netPnL = this.riskConfig.currentBalance - this.riskConfig.startBalance;
        if (netPnL <= -this.riskConfig.stopLoss) return true;
        if (netPnL >= this.riskConfig.takeProfit) return true;
        return false;
    }

    startEngine() {
        this.isTrading = true;
        this.subscribeBalance();
        this.subscribeSymbolTicks("R_100");
        console.log("Trading Engine Activated.");
    }

    stopEngine(reason = "Manual Stop") {
        this.isTrading = false;
        console.warn(`Trading Engine Deactivated: ${reason}`);
    }
}

