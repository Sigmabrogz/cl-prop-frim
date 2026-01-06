// ===========================================
// PRICE TYPES
// ===========================================

export interface PriceData {
  symbol: string;
  bidPrice: string;
  askPrice: string;
  midPrice: string;
  ourBid: string; // With spread applied
  ourAsk: string; // With spread applied
  timestamp: number;
  source: string;
}

export interface PriceTick {
  symbol: string;
  bid: string;
  ask: string;
  timestamp: number;
}

export interface MarketPair {
  id: number;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  displayName: string;
  isEnabled: boolean;
  spreadBps: number;
  maxLeverage: number;
  minQuantity: string;
  maxQuantity: string | null;
  quantityPrecision: number;
  pricePrecision: number;
  category: 'major' | 'altcoin' | 'defi' | 'meme';
  volatilityTier: 'low' | 'normal' | 'high' | 'extreme';
}

export interface PriceSnapshot {
  id: number;
  symbol: string;
  bidPrice: string;
  askPrice: string;
  midPrice: string;
  volume24h: string | null;
  source: string;
  timestamp: Date;
  createdAt: Date;
}



