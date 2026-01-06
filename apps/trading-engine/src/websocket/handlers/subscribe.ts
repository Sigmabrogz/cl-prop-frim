// ===========================================
// SUBSCRIBE/UNSUBSCRIBE HANDLER
// ===========================================

import type { ServerWebSocket } from 'bun';
import type { ConnectionManager } from '../connection-manager.js';
import { rateLimiter } from '../../security/rate-limiter.js';

// Supported trading pairs
const SUPPORTED_SYMBOLS = new Set([
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'DOTUSDT',
  'LINKUSDT',
  'MATICUSDT',
  'AVAXUSDT',
  'LTCUSDT',
  'UNIUSDT',
  'ATOMUSDT',
  'XLMUSDT',
]);

/**
 * Handle symbol subscription
 */
export function handleSubscribe(
  ws: ServerWebSocket<any>,
  symbols: string[],
  connectionManager: ConnectionManager
): void {
  const userId = ws.data.userId;

  // Rate limiting check
  if (rateLimiter.isRateLimited(userId, 'SUBSCRIBE')) {
    const resetTime = rateLimiter.getResetTime(userId, 'SUBSCRIBE');
    ws.send(
      JSON.stringify({
        type: 'ERROR',
        error: 'Rate limit exceeded',
        message: `Too many subscription requests. Try again in ${Math.ceil(resetTime / 1000)}s`,
        code: 'RATE_LIMITED',
      })
    );
    console.log(`[Subscribe] Rate limited: ${userId}`);
    return;
  }

  if (!Array.isArray(symbols)) {
    ws.send(
      JSON.stringify({
        type: 'ERROR',
        error: 'Invalid symbols format',
        message: 'symbols must be an array',
      })
    );
    return;
  }

  const subscribed: string[] = [];
  const invalid: string[] = [];

  for (const symbol of symbols) {
    const normalizedSymbol = symbol.toUpperCase();

    if (!SUPPORTED_SYMBOLS.has(normalizedSymbol)) {
      invalid.push(symbol);
      continue;
    }

    connectionManager.subscribe(ws.data.connectionId, normalizedSymbol);
    ws.data.subscriptions.add(normalizedSymbol);
    subscribed.push(normalizedSymbol);
  }

  ws.send(
    JSON.stringify({
      type: 'SUBSCRIBED',
      symbols: subscribed,
      invalid: invalid.length > 0 ? invalid : undefined,
      message: `Subscribed to ${subscribed.length} symbol(s)`,
    })
  );
}

/**
 * Handle symbol unsubscription
 */
export function handleUnsubscribe(
  ws: ServerWebSocket<any>,
  symbols: string[],
  connectionManager: ConnectionManager
): void {
  const userId = ws.data.userId;

  // Rate limiting check
  if (rateLimiter.isRateLimited(userId, 'UNSUBSCRIBE')) {
    const resetTime = rateLimiter.getResetTime(userId, 'UNSUBSCRIBE');
    ws.send(
      JSON.stringify({
        type: 'ERROR',
        error: 'Rate limit exceeded',
        message: `Too many unsubscription requests. Try again in ${Math.ceil(resetTime / 1000)}s`,
        code: 'RATE_LIMITED',
      })
    );
    console.log(`[Unsubscribe] Rate limited: ${userId}`);
    return;
  }

  if (!Array.isArray(symbols)) {
    ws.send(
      JSON.stringify({
        type: 'ERROR',
        error: 'Invalid symbols format',
        message: 'symbols must be an array',
      })
    );
    return;
  }

  const unsubscribed: string[] = [];

  for (const symbol of symbols) {
    const normalizedSymbol = symbol.toUpperCase();

    if (ws.data.subscriptions.has(normalizedSymbol)) {
      connectionManager.unsubscribe(ws.data.connectionId, normalizedSymbol);
      ws.data.subscriptions.delete(normalizedSymbol);
      unsubscribed.push(normalizedSymbol);
    }
  }

  ws.send(
    JSON.stringify({
      type: 'UNSUBSCRIBED',
      symbols: unsubscribed,
      message: `Unsubscribed from ${unsubscribed.length} symbol(s)`,
    })
  );
}

/**
 * Get list of supported symbols
 */
export function getSupportedSymbols(): string[] {
  return Array.from(SUPPORTED_SYMBOLS);
}

