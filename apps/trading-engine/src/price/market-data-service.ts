// ===========================================
// MARKET DATA SERVICE - 24h Stats & Funding Rates
// ===========================================
// Fetches real market data from Binance REST API

const BINANCE_API_URL = 'https://api.binance.com';
const BINANCE_FUTURES_API_URL = 'https://fapi.binance.com';

// Symbols we track
const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT',
  'AVAXUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'XLMUSDT',
];

// ===========================================
// TYPES
// ===========================================

export interface Ticker24h {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  lastPrice: number;
  timestamp: number;
}

export interface FundingRate {
  symbol: string;
  fundingRate: number;
  fundingTime: number;
  nextFundingTime: number;
}

export interface MarketData {
  ticker24h: Map<string, Ticker24h>;
  fundingRates: Map<string, FundingRate>;
}

// ===========================================
// MARKET DATA SERVICE CLASS
// ===========================================

export class MarketDataService {
  private ticker24h: Map<string, Ticker24h> = new Map();
  private fundingRates: Map<string, FundingRate> = new Map();
  private updateInterval: Timer | null = null;
  private callbacks: ((data: MarketData) => void)[] = [];

  /**
   * Start fetching market data
   */
  async start(): Promise<void> {
    console.log('[MarketData] Starting market data service...');

    // Fetch initial data
    await this.fetchAll();

    // Update every 30 seconds for 24h stats
    // Update every 60 seconds for funding rates
    this.updateInterval = setInterval(async () => {
      await this.fetchAll();
    }, 30000);

    console.log('[MarketData] Market data service started');
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('[MarketData] Market data service stopped');
  }

  /**
   * Fetch all market data
   */
  private async fetchAll(): Promise<void> {
    await Promise.all([
      this.fetch24hTickers(),
      this.fetchFundingRates(),
    ]);

    // Notify callbacks
    for (const callback of this.callbacks) {
      try {
        callback({
          ticker24h: this.ticker24h,
          fundingRates: this.fundingRates,
        });
      } catch (error) {
        console.error('[MarketData] Callback error:', error);
      }
    }
  }

  /**
   * Fetch 24h ticker data from Binance
   */
  private async fetch24hTickers(): Promise<void> {
    try {
      // Fetch all tickers at once (more efficient)
      const response = await fetch(`${BINANCE_API_URL}/api/v3/ticker/24hr`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const tickers = await response.json() as Array<{
        symbol: string;
        priceChange: string;
        priceChangePercent: string;
        highPrice: string;
        lowPrice: string;
        volume: string;
        quoteVolume: string;
        lastPrice: string;
      }>;

      // Filter to our symbols and update
      for (const ticker of tickers) {
        if (SYMBOLS.includes(ticker.symbol)) {
          this.ticker24h.set(ticker.symbol, {
            symbol: ticker.symbol,
            priceChange: parseFloat(ticker.priceChange),
            priceChangePercent: parseFloat(ticker.priceChangePercent),
            highPrice: parseFloat(ticker.highPrice),
            lowPrice: parseFloat(ticker.lowPrice),
            volume: parseFloat(ticker.volume),
            quoteVolume: parseFloat(ticker.quoteVolume),
            lastPrice: parseFloat(ticker.lastPrice),
            timestamp: Date.now(),
          });
        }
      }

      console.log(`[MarketData] Updated 24h tickers for ${this.ticker24h.size} symbols`);
    } catch (error) {
      console.error('[MarketData] Failed to fetch 24h tickers:', error);
    }
  }

  /**
   * Fetch funding rates from Binance Futures
   */
  private async fetchFundingRates(): Promise<void> {
    try {
      // Fetch premium index which includes funding rate
      const response = await fetch(`${BINANCE_FUTURES_API_URL}/fapi/v1/premiumIndex`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as Array<{
        symbol: string;
        lastFundingRate: string;
        nextFundingTime: number;
        time: number;
      }>;

      // Filter to our symbols and update
      for (const item of data) {
        if (SYMBOLS.includes(item.symbol)) {
          this.fundingRates.set(item.symbol, {
            symbol: item.symbol,
            fundingRate: parseFloat(item.lastFundingRate),
            fundingTime: item.time,
            nextFundingTime: item.nextFundingTime,
          });
        }
      }

      console.log(`[MarketData] Updated funding rates for ${this.fundingRates.size} symbols`);
    } catch (error) {
      console.error('[MarketData] Failed to fetch funding rates:', error);
    }
  }

  /**
   * Get 24h ticker for a symbol
   */
  getTicker24h(symbol: string): Ticker24h | null {
    return this.ticker24h.get(symbol) || null;
  }

  /**
   * Get funding rate for a symbol
   */
  getFundingRate(symbol: string): FundingRate | null {
    return this.fundingRates.get(symbol) || null;
  }

  /**
   * Get all market data
   */
  getAllData(): MarketData {
    return {
      ticker24h: this.ticker24h,
      fundingRates: this.fundingRates,
    };
  }

  /**
   * Register callback for updates
   */
  onUpdate(callback: (data: MarketData) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback
   */
  offUpdate(callback: (data: MarketData) => void): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let marketDataService: MarketDataService | null = null;

export function startMarketDataService(): MarketDataService {
  if (!marketDataService) {
    marketDataService = new MarketDataService();
    marketDataService.start();
  }
  return marketDataService;
}

export function getMarketDataService(): MarketDataService | null {
  return marketDataService;
}
