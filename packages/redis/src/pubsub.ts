import { redis, createPubSubClient } from './client.js';

// ===========================================
// REDIS PUB/SUB - For Real-time Broadcasting
// ===========================================

type MessageHandler = (channel: string, message: string) => void;

/**
 * Publisher - Use main redis client
 */
export async function publish(channel: string, message: string | object): Promise<number> {
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  return redis.publish(channel, payload);
}

/**
 * Subscriber class - Uses dedicated connection
 */
export class Subscriber {
  private client: ReturnType<typeof createPubSubClient>;
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  constructor() {
    this.client = createPubSubClient();

    this.client.on('message', (channel: string, message: string) => {
      const channelHandlers = this.handlers.get(channel);
      if (channelHandlers) {
        for (const handler of channelHandlers) {
          try {
            handler(channel, message);
          } catch (error) {
            console.error(`[PubSub] Handler error on channel ${channel}:`, error);
          }
        }
      }
    });

    this.client.on('pmessage', (pattern: string, channel: string, message: string) => {
      const patternHandlers = this.handlers.get(pattern);
      if (patternHandlers) {
        for (const handler of patternHandlers) {
          try {
            handler(channel, message);
          } catch (error) {
            console.error(`[PubSub] Handler error on pattern ${pattern}:`, error);
          }
        }
      }
    });
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.client.subscribe(channel);
    }
    this.handlers.get(channel)?.add(handler);
  }

  /**
   * Subscribe to a pattern (e.g., "prices:*")
   */
  async psubscribe(pattern: string, handler: MessageHandler): Promise<void> {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, new Set());
      await this.client.psubscribe(pattern);
    }
    this.handlers.get(pattern)?.add(handler);
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) return;

    if (handler) {
      channelHandlers.delete(handler);
      if (channelHandlers.size === 0) {
        this.handlers.delete(channel);
        await this.client.unsubscribe(channel);
      }
    } else {
      this.handlers.delete(channel);
      await this.client.unsubscribe(channel);
    }
  }

  /**
   * Close the subscriber connection
   */
  async close(): Promise<void> {
    await this.client.quit();
  }
}

// ===========================================
// PREDEFINED CHANNELS
// ===========================================

export const CHANNELS = {
  // Price channels (per symbol)
  priceUpdate: (symbol: string) => `prices:${symbol}`,
  
  // Account channels
  accountUpdate: (accountId: string) => `account:${accountId}:updates`,
  positionUpdate: (accountId: string) => `account:${accountId}:positions`,
  
  // Global channels
  SYSTEM_ALERTS: 'system:alerts',
  MARKET_STATUS: 'market:status',
} as const;

// Pattern for subscribing to all price updates
export const PATTERNS = {
  ALL_PRICES: 'prices:*',
  ALL_ACCOUNTS: 'account:*:updates',
} as const;



