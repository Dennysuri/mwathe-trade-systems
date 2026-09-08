import { BehaviorSubject } from 'rxjs';

export interface TickData {
  symbol: string;
  quote: number;
  digit: number;
  epoch: number;
}

class DerivService {
  private ws: WebSocket | null = null;
  public isConnected$ = new BehaviorSubject<boolean>(false);
  public balance$ = new BehaviorSubject<number>(0);
  public ticks$ = new BehaviorSubject<TickData | null>(null);

  private appId = '1089';

  public getAuthUrl(): string {
    const redirectUri = window.location.origin;
    return `https://oauth.deriv.com/oauth2/authorize?app_id=${this.appId}&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  public connect(token: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);

    this.ws.onopen = () => {
      this.isConnected$.next(true);
      this.send({ authorize: token });
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.msg_type === 'authorize' && data.authorize) {
        this.balance$.next(data.authorize.balance ?? 0);
        this.send({ balance: 1, subscribe: 1 });
      }

      if (data.msg_type === 'balance' && data.balance) {
        this.balance$.next(data.balance.balance ?? 0);
      }

      if (data.msg_type === 'tick' && data.tick) {
        const quote = data.tick.quote;
        const quoteStr = quote.toString();
        const lastDigit = parseInt(quoteStr.charAt(quoteStr.length - 1), 10);

        this.ticks$.next({
          symbol: data.tick.symbol,
          quote: quote,
          digit: isNaN(lastDigit) ? 0 : lastDigit,
          epoch: data.tick.epoch
        });
      }
    };

    this.ws.onclose = () => {
      this.isConnected$.next(false);
    };

    this.ws.onerror = (err) => {
      console.error('Deriv WebSocket Error:', err);
      this.isConnected$.next(false);
    };
  }

  public subscribeTicks(symbol: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ ticks: symbol });
    }
  }

  private send(data: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected$.next(false);
  }
}

export const derivService = new DerivService();
