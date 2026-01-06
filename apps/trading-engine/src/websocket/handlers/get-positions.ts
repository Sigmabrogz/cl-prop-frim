// ===========================================
// GET POSITIONS HANDLER
// ===========================================
// Returns all open positions for an account

import type { ServerWebSocket } from 'bun';
import { getPositionManager } from '../../engine/position-manager.js';

export async function handleGetPositions(
  ws: ServerWebSocket<any>,
  accountId: string
): Promise<void> {
  const userId = ws.data.userId;

  try {
    // Validate accountId
    if (!accountId) {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          error: 'Account ID is required',
        })
      );
      return;
    }

    // Get positions from position manager
    const positionManager = getPositionManager();
    const positions = positionManager.getByAccount(accountId);

    // Transform positions to match frontend expected format
    const positionsData = positions.map((pos) => ({
      id: pos.id,
      accountId: pos.accountId,
      symbol: pos.symbol,
      side: pos.side,
      quantity: pos.quantity,
      leverage: pos.leverage,
      entryPrice: pos.entryPrice,
      entryValue: pos.entryValue,
      marginUsed: pos.marginUsed,
      entryFee: pos.entryFee,
      takeProfit: pos.takeProfit,
      stopLoss: pos.stopLoss,
      liquidationPrice: pos.liquidationPrice,
      currentPrice: pos.currentPrice,
      unrealizedPnl: pos.unrealizedPnl,
      openedAt: pos.openedAt.toISOString(),
    }));

    // Send positions to client
    ws.send(
      JSON.stringify({
        type: 'POSITIONS',
        accountId,
        positions: positionsData,
        count: positionsData.length,
      })
    );

    console.log(
      `[GetPositions] Sent ${positionsData.length} positions for account ${accountId}`
    );
  } catch (error) {
    console.error('[GetPositions] Error:', error);
    ws.send(
      JSON.stringify({
        type: 'ERROR',
        error: 'Failed to fetch positions',
      })
    );
  }
}

