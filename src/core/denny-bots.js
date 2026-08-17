/**
 * Denny Bots - Execution Engine
 * Handles Deriv WebSocket connections, proposals, and high-speed execution.
 */

export class DennyBot {
    constructor(appId = 1089) { // Default public App ID
        this.appId = appId;
        this.ws = null;
        this.token = null;
        this.isConnected = false;
        this.onTickCallback = null;
    }

    /**
     * Connect to Deriv WebSocket endpoint
     */
    connect(token = null) {
        this.token = token;
        const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log("Denny Bots: WebSocket Connected");
            this.isConnected = true;
            if (this.token) {
                this.authorize(this.token);
            }
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onerror = (err) => console.error("Denny Bots WS Error:", err);
        this.ws.onclose = () => {
            console.log("Denny Bots WS Disconnected. Reconnecting...");
            this.isConnected = false;
            setTimeout(() => this.connect(this.token), 3000);
        };
    }

    /**
     * Authenticate session with Deriv API Token
     */
    authorize(token) {
        this.token = token;
        this.send({ authorize: this.token });
    }

    /**
     * Subscribe to live tick stream for a symbol (e.g., 'R_100')
     */
    subscribeTicks(symbol = 'R_100', callback = null) {
        this.onTickCallback = callback;
        this.send({ ticks: symbol });
    }

    /**
     * Execute a rapid 1-tick trade payload
     */
    executeTrade({ symbol = 'R_100', contractType = 'DIGITMATCH', amount = 1, duration = 1, barrier = '5' }) {
        if (!this.isConnected) {
            console.error("Denny Bots: Cannot execute, WebSocket offline.");
            return;
        }

        const proposalReq = {
            buy: 1,
            price: amount,
            parameters: {
                amount: amount,
                basis: 'stake',
                contract_type: contractType,
                currency: 'USD',
                duration: duration,
                duration_unit: 't',
                symbol: symbol,
                barrier: barrier
            }
        };

        console.log(`Denny Bots firing: ${contractType} on ${symbol} with barrier ${barrier}`);
        this.send(proposalReq);
    }

    /**
     * Internal message router
     */
    handleMessage(data) {
        const msgType = data.msg_type;

        if (msgType === 'authorize') {
            console.log(`Authorized as: ${data.authorize.email}`);
        } else if (msgType === 'tick') {
            const tick = data.tick;
            const quoteStr = tick.quote.toString();
            const lastDigit = parseInt(quoteStr.slice(-1));
            
            if (this.onTickCallback) {
                this.onTickCallback({
                    epoch: tick.epoch,
                    quote: tick.quote,
                    lastDigit: lastDigit,
                    symbol: tick.symbol
                });
            }
        } else if (msgType === 'buy') {
            console.log("Execution Success - Contract ID:", data.buy.contract_id);
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

