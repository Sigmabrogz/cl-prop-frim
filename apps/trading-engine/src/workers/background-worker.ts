// ===========================================
// BACKGROUND WORKER - Non-Critical Tasks
// ===========================================
// Handles:
// - Failed DB persist retries
// - Orphaned data cleanup
// - Health checks
// - Stats reporting

import { getRetryQueueStats } from '../engine/order-executor.js';
import { getCloseRetryQueueStats } from '../engine/close-executor.js';
import { accountManager } from '../engine/account-manager.js';
import { getPositionManager } from '../engine/position-manager.js';

// ===========================================
// BACKGROUND WORKER CLASS
// ===========================================

class BackgroundWorker {
  private isRunning = false;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private healthInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the background worker
   */
  start(): void {
    this.isRunning = true;

    // Report stats every 30 seconds
    this.statsInterval = setInterval(() => {
      if (this.isRunning) {
        this.reportStats();
      }
    }, 30000);

    // Health check every 60 seconds
    this.healthInterval = setInterval(() => {
      if (this.isRunning) {
        this.healthCheck();
      }
    }, 60000);

    console.log('[BackgroundWorker] Started');
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
    
    console.log('[BackgroundWorker] Stopped');
  }

  /**
   * Report system stats
   */
  private reportStats(): void {
    const orderRetryStats = getRetryQueueStats();
    const closeRetryStats = getCloseRetryQueueStats();
    const accountStats = accountManager.getStats();
    const positionManager = getPositionManager();
    
    const stats = {
      timestamp: new Date().toISOString(),
      positions: {
        total: positionManager.getPositionCount(),
        symbols: positionManager.getActiveSymbols().length,
      },
      accounts: {
        cached: accountStats.cachedAccounts,
        dirty: accountStats.dirtyAccounts,
        locked: accountStats.lockedAccounts,
      },
      retryQueues: {
        orders: orderRetryStats.pending,
        closes: closeRetryStats.pending,
      },
    };

    // Only log if there's something interesting
    if (
      orderRetryStats.pending > 0 || 
      closeRetryStats.pending > 0 || 
      accountStats.dirtyAccounts > 0
    ) {
      console.log('[BackgroundWorker] Stats:', JSON.stringify(stats));
    }
  }

  /**
   * Health check
   */
  private healthCheck(): void {
    const positionManager = getPositionManager();
    const accountStats = accountManager.getStats();
    
    // Check for issues
    const issues: string[] = [];
    
    // Too many locked accounts might indicate deadlock
    if (accountStats.lockedAccounts > 10) {
      issues.push(`High lock count: ${accountStats.lockedAccounts}`);
    }
    
    // Too many dirty accounts might indicate DB issues
    if (accountStats.dirtyAccounts > 50) {
      issues.push(`High dirty account count: ${accountStats.dirtyAccounts}`);
    }
    
    // Check retry queues
    const orderRetryStats = getRetryQueueStats();
    const closeRetryStats = getCloseRetryQueueStats();
    
    if (orderRetryStats.pending > 100) {
      issues.push(`Order retry queue backlog: ${orderRetryStats.pending}`);
    }
    
    if (closeRetryStats.pending > 100) {
      issues.push(`Close retry queue backlog: ${closeRetryStats.pending}`);
    }
    
    if (issues.length > 0) {
      console.warn('[BackgroundWorker] Health issues:', issues);
    }
  }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let backgroundWorker: BackgroundWorker | null = null;

export function startBackgroundWorker(): BackgroundWorker {
  if (!backgroundWorker) {
    backgroundWorker = new BackgroundWorker();
    backgroundWorker.start();
  }
  return backgroundWorker;
}

export function getBackgroundWorker(): BackgroundWorker | null {
  return backgroundWorker;
}

