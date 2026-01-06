// ===========================================
// ACCOUNT MANAGER - In-Memory Account State
// ===========================================

import { db } from '@propfirm/database';
import { tradingAccounts } from '@propfirm/database/schema';
import { eq } from 'drizzle-orm';

// ===========================================
// TYPES
// ===========================================

export interface AccountState {
  id: string;
  userId: string;
  status: string;
  accountType: string;
  accountNumber: string;
  currentBalance: number;
  availableMargin: number;
  totalMarginUsed: number;
  dailyStartingBalance: number;
  startingBalance: number;
  peakBalance: number;
  dailyLossLimit: number;
  maxDrawdownLimit: number;
  profitTarget: number;
  currentProfit: number;
  planId: number | null;
  btcEthMaxLeverage: number;
  altcoinMaxLeverage: number;
  dailyPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalVolume: number;
  tradingDays: number;
  lastTradeAt: Date | null;
  // Track dirty state for sync
  _dirty?: boolean;
  _lastSyncAt?: number;
}

// ===========================================
// ACCOUNT MANAGER CLASS
// ===========================================

export class AccountManager {
  // Account ID -> Account State
  private accounts: Map<string, AccountState> = new Map();
  
  // Track which accounts have been modified
  private dirtyAccounts: Set<string> = new Set();
  
  // Simple in-memory locks (NOT distributed - single process only)
  private locks: Set<string> = new Set();
  
  // Background sync interval
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  
  // Sync frequency (5 seconds)
  private readonly SYNC_INTERVAL_MS = 5000;
  
  // Lock timeout (5 seconds max hold)
  private readonly LOCK_TIMEOUT_MS = 5000;
  
  // Lock holders with timestamps for timeout
  private lockTimestamps: Map<string, number> = new Map();

  /**
   * Initialize the account manager and start background sync
   */
  async initialize(): Promise<void> {
    console.log('[AccountManager] Initializing...');
    
    // Start background sync to database
    this.syncInterval = setInterval(() => {
      this.syncToDatabase().catch(err => {
        console.error('[AccountManager] Sync error:', err);
      });
    }, this.SYNC_INTERVAL_MS);
    
    // Also start lock cleanup interval
    setInterval(() => this.cleanupStaleLocks(), 1000);
    
    console.log('[AccountManager] Initialized with 5s sync interval');
  }

  /**
   * Get account state (loads from DB if not cached)
   */
  async getAccount(accountId: string): Promise<AccountState | null> {
    // Check cache first
    const cached = this.accounts.get(accountId);
    if (cached) {
      return cached;
    }
    
    // Load from database
    return this.loadAccountState(accountId);
  }

  /**
   * Load account from database into cache
   */
  private async loadAccountState(accountId: string): Promise<AccountState | null> {
    try {
      const account = await db.query.tradingAccounts.findFirst({
        where: eq(tradingAccounts.id, accountId),
      });
      
      if (!account) {
        return null;
      }
      
      // Get leverage config from plan (or use defaults)
      // TODO: Load from evaluation_plans table
      const btcEthMaxLeverage = 100;
      const altcoinMaxLeverage = 50;
      
      const state: AccountState = {
        id: account.id,
        userId: account.userId,
        status: account.status,
        accountType: account.accountType,
        accountNumber: account.accountNumber,
        currentBalance: parseFloat(account.currentBalance),
        availableMargin: parseFloat(account.availableMargin),
        totalMarginUsed: parseFloat(account.totalMarginUsed),
        dailyStartingBalance: parseFloat(account.dailyStartingBalance),
        startingBalance: parseFloat(account.startingBalance),
        peakBalance: parseFloat(account.peakBalance),
        dailyLossLimit: parseFloat(account.dailyLossLimit),
        maxDrawdownLimit: parseFloat(account.maxDrawdownLimit),
        profitTarget: parseFloat(account.profitTarget),
        currentProfit: parseFloat(account.currentProfit),
        planId: account.planId,
        btcEthMaxLeverage,
        altcoinMaxLeverage,
        dailyPnl: parseFloat(account.dailyPnl),
        totalTrades: account.totalTrades,
        winningTrades: account.winningTrades,
        losingTrades: account.losingTrades,
        totalVolume: parseFloat(account.totalVolume),
        tradingDays: account.tradingDays,
        lastTradeAt: account.lastTradeAt,
        _dirty: false,
        _lastSyncAt: Date.now(),
      };
      
      // Cache it
      this.accounts.set(accountId, state);
      
      return state;
    } catch (error) {
      console.error(`[AccountManager] Failed to load account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Update account state in memory (marks as dirty for sync)
   */
  updateAccount(accountId: string, updates: Partial<AccountState>): void {
    const account = this.accounts.get(accountId);
    if (!account) {
      console.warn(`[AccountManager] Cannot update non-cached account ${accountId}`);
      return;
    }
    
    // Apply updates
    Object.assign(account, updates, { _dirty: true });
    
    // Mark as dirty for sync
    this.dirtyAccounts.add(accountId);
  }

  /**
   * Acquire simple in-memory lock (returns false if already locked)
   */
  acquireLock(accountId: string): boolean {
    // Check for stale lock first
    this.cleanupStaleLock(accountId);
    
    if (this.locks.has(accountId)) {
      return false;
    }
    
    this.locks.add(accountId);
    this.lockTimestamps.set(accountId, Date.now());
    return true;
  }

  /**
   * Release lock
   */
  releaseLock(accountId: string): void {
    this.locks.delete(accountId);
    this.lockTimestamps.delete(accountId);
  }

  /**
   * Execute function with lock (simple in-memory lock)
   * Returns null if lock cannot be acquired within timeout
   */
  async withLock<T>(
    accountId: string, 
    fn: () => Promise<T>,
    maxWaitMs: number = 100
  ): Promise<T | null> {
    const startTime = Date.now();
    
    // Try to acquire lock with brief retries
    while (Date.now() - startTime < maxWaitMs) {
      if (this.acquireLock(accountId)) {
        try {
          return await fn();
        } finally {
          this.releaseLock(accountId);
        }
      }
      // Brief wait before retry (1ms)
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    // Could not acquire lock
    console.warn(`[AccountManager] Lock timeout for account ${accountId}`);
    return null;
  }

  /**
   * Cleanup stale lock for a specific account
   */
  private cleanupStaleLock(accountId: string): void {
    const lockTime = this.lockTimestamps.get(accountId);
    if (lockTime && Date.now() - lockTime > this.LOCK_TIMEOUT_MS) {
      console.warn(`[AccountManager] Releasing stale lock for ${accountId}`);
      this.releaseLock(accountId);
    }
  }

  /**
   * Cleanup all stale locks
   */
  private cleanupStaleLocks(): void {
    const now = Date.now();
    for (const [accountId, lockTime] of this.lockTimestamps) {
      if (now - lockTime > this.LOCK_TIMEOUT_MS) {
        console.warn(`[AccountManager] Releasing stale lock for ${accountId}`);
        this.releaseLock(accountId);
      }
    }
  }

  /**
   * Sync dirty accounts to database (background task)
   */
  private async syncToDatabase(): Promise<void> {
    if (this.dirtyAccounts.size === 0) {
      return;
    }
    
    const accountsToSync = Array.from(this.dirtyAccounts);
    this.dirtyAccounts.clear();
    
    console.log(`[AccountManager] Syncing ${accountsToSync.length} accounts to database...`);
    
    for (const accountId of accountsToSync) {
      const account = this.accounts.get(accountId);
      if (!account) continue;
      
      try {
        await db
          .update(tradingAccounts)
          .set({
            currentBalance: account.currentBalance.toString(),
            availableMargin: account.availableMargin.toString(),
            totalMarginUsed: account.totalMarginUsed.toString(),
            peakBalance: account.peakBalance.toString(),
            dailyPnl: account.dailyPnl.toString(),
            currentProfit: account.currentProfit.toString(),
            totalTrades: account.totalTrades,
            winningTrades: account.winningTrades,
            losingTrades: account.losingTrades,
            totalVolume: account.totalVolume.toString(),
            lastTradeAt: account.lastTradeAt,
            updatedAt: new Date(),
          })
          .where(eq(tradingAccounts.id, accountId));
        
        account._dirty = false;
        account._lastSyncAt = Date.now();
      } catch (error) {
        console.error(`[AccountManager] Failed to sync account ${accountId}:`, error);
        // Re-add to dirty set for retry
        this.dirtyAccounts.add(accountId);
      }
    }
  }

  /**
   * Invalidate cache for an account (force reload from DB)
   */
  invalidate(accountId: string): void {
    this.accounts.delete(accountId);
    this.dirtyAccounts.delete(accountId);
  }

  /**
   * Get all cached accounts
   */
  getAllCached(): AccountState[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Check if account is in cache
   */
  isCached(accountId: string): boolean {
    return this.accounts.has(accountId);
  }

  /**
   * Get cache stats
   */
  getStats(): { cachedAccounts: number; dirtyAccounts: number; lockedAccounts: number } {
    return {
      cachedAccounts: this.accounts.size,
      dirtyAccounts: this.dirtyAccounts.size,
      lockedAccounts: this.locks.size,
    };
  }

  /**
   * Shutdown - flush all dirty accounts to database
   */
  async shutdown(): Promise<void> {
    console.log('[AccountManager] Shutting down...');
    
    // Stop sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Flush all dirty accounts
    await this.syncToDatabase();
    
    console.log('[AccountManager] Shutdown complete');
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

export const accountManager = new AccountManager();

