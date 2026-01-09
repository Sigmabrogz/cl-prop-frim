// ===========================================
// TRADING ENGINE CONFIGURATION
// Centralized config with environment variable support
// ===========================================

// ===========================================
// MARGIN & FEES
// ===========================================

/**
 * Maintenance margin percentage (default 0.5%)
 * Below this equity level, positions are liquidated
 */
export const MAINTENANCE_MARGIN_PCT = parseFloat(
  process.env.MAINTENANCE_MARGIN_PCT || '0.005'
);

/**
 * Entry fee percentage (default 0.05% = 5 bps)
 * Applied when opening positions
 */
export const ENTRY_FEE_PCT = parseFloat(
  process.env.ENTRY_FEE_PCT || '0.0005'
);

// ===========================================
// SPREADS (in basis points)
// ===========================================

/**
 * Default spread for unknown symbols (default 10 bps = 0.1%)
 */
export const DEFAULT_SPREAD_BPS = parseInt(
  process.env.DEFAULT_SPREAD_BPS || '10',
  10
);

/**
 * Per-symbol spreads in basis points
 * Can be overridden via SYMBOL_SPREADS env var (JSON format)
 * Note: 1 bps = 0.01%, so BTC at $90k with 1 bps = ~$9 spread
 */
const DEFAULT_SYMBOL_SPREADS: Record<string, number> = {
  BTCUSDT: 1,    // 0.01% (~$9 on $90k)
  ETHUSDT: 1,    // 0.01%
  BNBUSDT: 2,    // 0.02%
  SOLUSDT: 2,
  XRPUSDT: 2,
  ADAUSDT: 3,
  DOGEUSDT: 3,
  DOTUSDT: 2,
  LINKUSDT: 2,
  MATICUSDT: 3,
  AVAXUSDT: 2,
  LTCUSDT: 2,
  UNIUSDT: 3,
  ATOMUSDT: 2,
  XLMUSDT: 3,
};

// Parse custom spreads from environment if provided
function parseSymbolSpreads(): Record<string, number> {
  const envSpreads = process.env.SYMBOL_SPREADS;
  if (!envSpreads) {
    return DEFAULT_SYMBOL_SPREADS;
  }

  try {
    const parsed = JSON.parse(envSpreads) as Record<string, number>;
    return { ...DEFAULT_SYMBOL_SPREADS, ...parsed };
  } catch (error) {
    console.warn('[Config] Failed to parse SYMBOL_SPREADS env var, using defaults');
    return DEFAULT_SYMBOL_SPREADS;
  }
}

export const SYMBOL_SPREADS = parseSymbolSpreads();

// ===========================================
// CIRCUIT BREAKER
// ===========================================

/**
 * Maximum price move percentage before circuit breaker trips (default 5%)
 */
export const CIRCUIT_BREAKER_THRESHOLD_PCT = parseFloat(
  process.env.CIRCUIT_BREAKER_THRESHOLD_PCT || '0.05'
);

/**
 * Circuit breaker reset time in milliseconds (default 1000ms)
 */
export const CIRCUIT_BREAKER_RESET_MS = parseInt(
  process.env.CIRCUIT_BREAKER_RESET_MS || '1000',
  10
);

// ===========================================
// PRICE STALENESS
// ===========================================

/**
 * Maximum age in ms before price is considered stale (default 5000ms)
 */
export const PRICE_STALE_THRESHOLD_MS = parseInt(
  process.env.PRICE_STALE_THRESHOLD_MS || '5000',
  10
);
