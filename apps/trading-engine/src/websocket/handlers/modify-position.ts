// ===========================================
// MODIFY POSITION HANDLER
// ===========================================

import type { ServerWebSocket } from 'bun';
import { db } from '@propfirm/database';
import { positions, tradeEvents } from '@propfirm/database/schema';
import { eq } from 'drizzle-orm';
import { withPositionLock } from '@propfirm/redis';
import { getPositionManager } from '../../engine/position-manager.js';
import { getTPSLEngine } from '../../triggers/tpsl-engine.js';
import { rateLimiter, auditLogger } from '../../security/rate-limiter.js';

/**
 * Handle position modification (TP/SL update)
 */
export async function handleModifyPosition(
  ws: ServerWebSocket<any>,
  positionId: string,
  takeProfit?: string,
  stopLoss?: string
): Promise<void> {
  const userId = ws.data.userId;
  const connectionId = ws.data.connectionId;

  // Log the modify attempt for audit
  auditLogger.log({
    userId,
    connectionId,
    action: 'MODIFY_POSITION',
    data: { positionId, takeProfit, stopLoss },
  });

  try {
    // 0. Rate limiting check
    if (rateLimiter.isRateLimited(userId, 'MODIFY_POSITION')) {
      const resetTime = rateLimiter.getResetTime(userId, 'MODIFY_POSITION');
      ws.send(
        JSON.stringify({
          type: 'MODIFY_REJECTED',
          positionId,
          reason: `Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)}s`,
          code: 'RATE_LIMITED',
        })
      );
      console.log(`[ModifyPosition] Rate limited: ${userId}`);
      return;
    }

    // 1. Validate position exists
    const positionManager = getPositionManager();
    const position = positionManager.getPosition(positionId);

    if (!position) {
      ws.send(
        JSON.stringify({
          type: 'MODIFY_REJECTED',
          positionId,
          reason: 'Position not found',
        })
      );
      return;
    }

    // 2. Parse and validate new values
    const newTP = takeProfit ? parseFloat(takeProfit) : undefined;
    const newSL = stopLoss ? parseFloat(stopLoss) : undefined;

    // 3. Validate TP against entry price
    if (newTP !== undefined) {
      const tpError = validateTakeProfit(position.side, position.entryPrice, newTP);
      if (tpError) {
        ws.send(
          JSON.stringify({
            type: 'MODIFY_REJECTED',
            positionId,
            reason: tpError,
          })
        );
        return;
      }
    }

    // 4. Validate SL against entry price
    if (newSL !== undefined) {
      const slError = validateStopLoss(position.side, position.entryPrice, newSL);
      if (slError) {
        ws.send(
          JSON.stringify({
            type: 'MODIFY_REJECTED',
            positionId,
            reason: slError,
          })
        );
        return;
      }
    }

    // 5. Execute with lock
    await withPositionLock(positionId, async () => {
      // Update database
      const updateData: Record<string, string | null> = {};
      if (newTP !== undefined) {
        updateData.takeProfit = newTP === 0 ? null : newTP.toString();
      }
      if (newSL !== undefined) {
        updateData.stopLoss = newSL === 0 ? null : newSL.toString();
      }

      await db
        .update(positions)
        .set(updateData)
        .where(eq(positions.id, positionId));

      // Update in-memory state
      positionManager.updateTPSL(
        positionId,
        newTP !== undefined ? (newTP === 0 ? null : newTP) : undefined,
        newSL !== undefined ? (newSL === 0 ? null : newSL) : undefined
      );

      // Update TP/SL engine
      const tpslEngine = getTPSLEngine();
      if (tpslEngine) {
        tpslEngine.updateTPSL(
          positionId,
          position.symbol,
          newTP !== undefined ? (newTP === 0 ? null : newTP) : undefined,
          newSL !== undefined ? (newSL === 0 ? null : newSL) : undefined
        );
      }

      // Log event
      await db.insert(tradeEvents).values({
        accountId: position.accountId,
        positionId,
        eventType: newTP !== undefined ? 'TP_MODIFIED' : 'SL_MODIFIED',
        symbol: position.symbol,
        details: {
          previousTP: position.takeProfit,
          previousSL: position.stopLoss,
          newTP: newTP !== undefined ? (newTP === 0 ? null : newTP) : position.takeProfit,
          newSL: newSL !== undefined ? (newSL === 0 ? null : newSL) : position.stopLoss,
        },
      });
    });

    // 6. Send confirmation
    ws.send(
      JSON.stringify({
        type: 'POSITION_MODIFIED',
        positionId,
        takeProfit: newTP !== undefined ? (newTP === 0 ? null : newTP) : position.takeProfit,
        stopLoss: newSL !== undefined ? (newSL === 0 ? null : newSL) : position.stopLoss,
        message: 'Position modified successfully',
      })
    );

    console.log(`[ModifyPosition] Modified: ${positionId} TP=${newTP} SL=${newSL}`);
  } catch (error) {
    console.error('[ModifyPosition] Error:', error);
    ws.send(
      JSON.stringify({
        type: 'MODIFY_REJECTED',
        positionId,
        reason: 'Internal error processing modification',
      })
    );
  }
}

// ===========================================
// VALIDATION FUNCTIONS
// ===========================================

function validateTakeProfit(side: 'LONG' | 'SHORT', entryPrice: number, tp: number): string | null {
  if (tp <= 0) return null; // 0 means remove TP

  if (side === 'LONG') {
    if (tp <= entryPrice) {
      return 'Take profit must be above entry price for LONG positions';
    }
  } else {
    if (tp >= entryPrice) {
      return 'Take profit must be below entry price for SHORT positions';
    }
  }
  return null;
}

function validateStopLoss(side: 'LONG' | 'SHORT', entryPrice: number, sl: number): string | null {
  if (sl <= 0) return null; // 0 means remove SL

  if (side === 'LONG') {
    if (sl >= entryPrice) {
      return 'Stop loss must be below entry price for LONG positions';
    }
  } else {
    if (sl <= entryPrice) {
      return 'Stop loss must be above entry price for SHORT positions';
    }
  }
  return null;
}

