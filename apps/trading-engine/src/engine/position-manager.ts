// ===========================================
// POSITION MANAGER - In-Memory Position State
// ===========================================

import { db } from '@propfirm/database';
import { positions } from '@propfirm/database/schema';
import { eq } from 'drizzle-orm';
import type { PriceData } from '../price/price-engine.js';
import { calculateUnrealizedPnL } from './margin-calculator.js';

// ===========================================
// TYPES
// ===========================================

export interface Position {
  id: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  leverage: number;
  entryPrice: number;
  entryValue: number;
  marginUsed: number;
  entryFee: number;
  takeProfit: number | null;
  stopLoss: number | null;
  liquidationPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  openedAt: Date;
}

// ===========================================
// POSITION MANAGER CLASS
// ===========================================

export class PositionManager {
  // Position ID -> Position
  private positions: Map<string, Position> = new Map();

  // Account ID -> Position IDs
  private accountPositions: Map<string, Set<string>> = new Map();

  // Symbol -> Position IDs (for price updates)
  private symbolPositions: Map<string, Set<string>> = new Map();

  /**
   * Load positions from database on startup
   */
  async loadFromDatabase(): Promise<void> {
    console.log('[PositionManager] Loading positions from database...');

    const dbPositions = await db.query.positions.findMany();

    for (const pos of dbPositions) {
      this.addPosition({
        id: pos.id,
        accountId: pos.accountId,
        symbol: pos.symbol,
        side: pos.side as 'LONG' | 'SHORT',
        quantity: parseFloat(pos.quantity),
        leverage: pos.leverage,
        entryPrice: parseFloat(pos.entryPrice),
        entryValue: parseFloat(pos.entryValue),
        marginUsed: parseFloat(pos.marginUsed),
        entryFee: parseFloat(pos.entryFee),
        takeProfit: pos.takeProfit ? parseFloat(pos.takeProfit) : null,
        stopLoss: pos.stopLoss ? parseFloat(pos.stopLoss) : null,
        liquidationPrice: parseFloat(pos.liquidationPrice),
        currentPrice: parseFloat(pos.currentPrice || pos.entryPrice),
        unrealizedPnl: parseFloat(pos.unrealizedPnl || '0'),
        openedAt: pos.openedAt,
      });
    }

    console.log(`[PositionManager] Loaded ${this.positions.size} positions`);
  }

  /**
   * Add a position to the manager
   */
  addPosition(position: Position): void {
    this.positions.set(position.id, position);

    // Index by account
    if (!this.accountPositions.has(position.accountId)) {
      this.accountPositions.set(position.accountId, new Set());
    }
    this.accountPositions.get(position.accountId)!.add(position.id);

    // Index by symbol
    if (!this.symbolPositions.has(position.symbol)) {
      this.symbolPositions.set(position.symbol, new Set());
    }
    this.symbolPositions.get(position.symbol)!.add(position.id);
  }

  /**
   * Remove a position
   */
  removePosition(positionId: string): void {
    const position = this.positions.get(positionId);
    if (!position) return;

    // Remove from account index
    const accountPosIds = this.accountPositions.get(position.accountId);
    if (accountPosIds) {
      accountPosIds.delete(positionId);
      if (accountPosIds.size === 0) {
        this.accountPositions.delete(position.accountId);
      }
    }

    // Remove from symbol index
    const symbolPosIds = this.symbolPositions.get(position.symbol);
    if (symbolPosIds) {
      symbolPosIds.delete(positionId);
      if (symbolPosIds.size === 0) {
        this.symbolPositions.delete(position.symbol);
      }
    }

    // Remove position
    this.positions.delete(positionId);
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  /**
   * Get all positions for an account
   */
  getByAccount(accountId: string): Position[] {
    const positionIds = this.accountPositions.get(accountId);
    if (!positionIds) return [];

    return Array.from(positionIds)
      .map((id) => this.positions.get(id))
      .filter((p): p is Position => p !== undefined);
  }

  /**
   * Get all positions for a symbol
   */
  getBySymbol(symbol: string): Position[] {
    const positionIds = this.symbolPositions.get(symbol);
    if (!positionIds) return [];

    return Array.from(positionIds)
      .map((id) => this.positions.get(id))
      .filter((p): p is Position => p !== undefined);
  }

  /**
   * Get all positions
   */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Update position with new price
   */
  updatePositionPrice(positionId: string, price: PriceData): void {
    const position = this.positions.get(positionId);
    if (!position) return;

    // Use bid for LONG (exit price), ask for SHORT (exit price)
    const currentPrice = position.side === 'LONG' ? price.ourBid : price.ourAsk;
    const unrealizedPnl = calculateUnrealizedPnL(
      position.side,
      position.quantity,
      position.entryPrice,
      currentPrice
    );

    position.currentPrice = currentPrice;
    position.unrealizedPnl = unrealizedPnl;
  }

  /**
   * Update all positions for a symbol with new price
   */
  updateSymbolPrices(symbol: string, price: PriceData): void {
    const positionIds = this.symbolPositions.get(symbol);
    if (!positionIds) return;

    for (const positionId of positionIds) {
      this.updatePositionPrice(positionId, price);
    }
  }

  /**
   * Update TP/SL for a position
   */
  updateTPSL(positionId: string, takeProfit?: number | null, stopLoss?: number | null): void {
    const position = this.positions.get(positionId);
    if (!position) return;

    if (takeProfit !== undefined) {
      position.takeProfit = takeProfit;
    }
    if (stopLoss !== undefined) {
      position.stopLoss = stopLoss;
    }
  }

  /**
   * Get positions with TP that might trigger
   */
  getPositionsWithTP(symbol: string): Position[] {
    return this.getBySymbol(symbol).filter((p) => p.takeProfit !== null);
  }

  /**
   * Get positions with SL that might trigger
   */
  getPositionsWithSL(symbol: string): Position[] {
    return this.getBySymbol(symbol).filter((p) => p.stopLoss !== null);
  }

  /**
   * Get total unrealized P&L for an account
   */
  getAccountUnrealizedPnL(accountId: string): number {
    const positions = this.getByAccount(accountId);
    return positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  }

  /**
   * Get total margin used for an account
   */
  getAccountMarginUsed(accountId: string): number {
    const positions = this.getByAccount(accountId);
    return positions.reduce((sum, p) => sum + p.marginUsed, 0);
  }

  /**
   * Get position count
   */
  getPositionCount(): number {
    return this.positions.size;
  }

  /**
   * Get symbols with open positions
   */
  getActiveSymbols(): string[] {
    return Array.from(this.symbolPositions.keys());
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let positionManager: PositionManager | null = null;

export function getPositionManager(): PositionManager {
  if (!positionManager) {
    positionManager = new PositionManager();
  }
  return positionManager;
}

export async function initializePositionManager(): Promise<PositionManager> {
  const manager = getPositionManager();
  await manager.loadFromDatabase();
  return manager;
}

