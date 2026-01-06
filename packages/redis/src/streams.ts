import { redis } from './client.js';

// ===========================================
// REDIS STREAMS - For Message Queues
// ===========================================

export interface StreamMessage {
  id: string;
  data: Record<string, string>;
}

export interface StreamEntry {
  streamId: string;
  messages: StreamMessage[];
}

/**
 * Add a message to a Redis Stream
 */
export async function addToStream(
  streamKey: string,
  data: Record<string, string | number | boolean>
): Promise<string> {
  // Convert all values to strings for Redis
  const stringData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    stringData[key] = String(value);
  }

  // XADD with auto-generated ID (*)
  const messageId = await redis.xadd(streamKey, '*', ...Object.entries(stringData).flat());
  return messageId as string;
}

/**
 * Read messages from a stream (consumer group)
 */
export async function readFromStream(
  streamKey: string,
  groupName: string,
  consumerName: string,
  count: number = 10,
  blockMs: number = 5000
): Promise<StreamMessage[]> {
  try {
    const result = await redis.xreadgroup(
      'GROUP',
      groupName,
      consumerName,
      'COUNT',
      count,
      'BLOCK',
      blockMs,
      'STREAMS',
      streamKey,
      '>' // Read only new messages
    );

    if (!result) {
      return [];
    }

    const messages: StreamMessage[] = [];
    for (const [, entries] of result as [string, [string, string[]][]][]) {
      for (const [id, fields] of entries) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          const key = fields[i];
          const value = fields[i + 1];
          if (key && value !== undefined) {
            data[key] = value;
          }
        }
        messages.push({ id, data });
      }
    }

    return messages;
  } catch (error) {
    // Handle NOGROUP error - group doesn't exist
    if (error instanceof Error && error.message.includes('NOGROUP')) {
      await createConsumerGroup(streamKey, groupName);
      return [];
    }
    throw error;
  }
}

/**
 * Create a consumer group for a stream
 */
export async function createConsumerGroup(
  streamKey: string,
  groupName: string,
  startId: string = '0'
): Promise<void> {
  try {
    await redis.xgroup('CREATE', streamKey, groupName, startId, 'MKSTREAM');
  } catch (error) {
    // Ignore BUSYGROUP error - group already exists
    if (error instanceof Error && !error.message.includes('BUSYGROUP')) {
      throw error;
    }
  }
}

/**
 * Acknowledge a message as processed
 */
export async function acknowledgeMessage(
  streamKey: string,
  groupName: string,
  messageId: string
): Promise<void> {
  await redis.xack(streamKey, groupName, messageId);
}

/**
 * Acknowledge multiple messages
 */
export async function acknowledgeMessages(
  streamKey: string,
  groupName: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  await redis.xack(streamKey, groupName, ...messageIds);
}

/**
 * Get pending messages (not acknowledged)
 */
export async function getPendingMessages(
  streamKey: string,
  groupName: string,
  count: number = 100
): Promise<{ id: string; consumer: string; idleTime: number; deliveryCount: number }[]> {
  const result = await redis.xpending(streamKey, groupName, '-', '+', count);

  return (result as [string, string, number, number][]).map(([id, consumer, idleTime, deliveryCount]) => ({
    id,
    consumer,
    idleTime,
    deliveryCount,
  }));
}

/**
 * Trim stream to max length (for memory management)
 */
export async function trimStream(streamKey: string, maxLength: number): Promise<number> {
  return redis.xtrim(streamKey, 'MAXLEN', '~', maxLength);
}

// ===========================================
// PREDEFINED STREAM KEYS
// ===========================================

export const STREAMS = {
  ORDERS_PENDING: 'orders:pending',
  ORDERS_EXECUTED: 'orders:executed',
  POSITIONS_UPDATES: 'positions:updates',
  POSITIONS_CLOSE: 'positions:close',
  RISK_ALERTS: 'risk:alerts',
  PRICE_UPDATES: 'prices:updates',
} as const;

export const CONSUMER_GROUPS = {
  ORDER_PROCESSOR: 'order-processor',
  RISK_ENGINE: 'risk-engine',
  NOTIFICATION_SERVICE: 'notification-service',
} as const;



