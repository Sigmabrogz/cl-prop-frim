// ===========================================
// TRADING ENGINE - MAIN ENTRY POINT
// ===========================================
// Optimized for <10ms order execution using synchronous in-memory processing

import { startWebSocketServer } from './websocket/server.js';
import { startPriceEngine } from './price/price-engine.js';
import { startBinanceFeed } from './price/binance-feed.js';
import { startBackgroundWorker } from './workers/background-worker.js';
import { startRiskEngine } from './risk/risk-engine.js';
import { startTPSLEngine } from './triggers/tpsl-engine.js';
import { startLiquidationEngine } from './triggers/liquidation-engine.js';
import { startDailyResetWorker } from './workers/daily-reset-worker.js';
import { startEvaluationChecker } from './risk/evaluation-checker.js';
import { initializePositionManager } from './engine/position-manager.js';
import { accountManager } from './engine/account-manager.js';
import { checkRedisHealth } from '@propfirm/redis';
import { auditLogger } from './security/rate-limiter.js';

// ===========================================
// ENVIRONMENT VALIDATION
// ===========================================

const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: ${envVar} environment variable is required`);
    process.exit(1);
  }
}

// ===========================================
// CONFIGURATION
// ===========================================

const WS_PORT = parseInt(process.env.WS_PORT || '3002', 10);

// ===========================================
// STARTUP SEQUENCE
// ===========================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              PROPFIRM TRADING ENGINE v2.0                 ║
║              <10ms Synchronous Execution                  ║
╠═══════════════════════════════════════════════════════════╣
║  Starting up...                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  try {
    // 1. Check Redis connection
    console.log('[1/11] Checking Redis connection...');
    const redisHealthy = await checkRedisHealth();
    if (!redisHealthy) {
      throw new Error('Redis is not available');
    }
    console.log('       ✓ Redis connected');

    // 2. Initialize Account Manager (in-memory account state)
    console.log('[2/11] Initializing Account Manager...');
    await accountManager.initialize();
    console.log('       ✓ Account Manager initialized');

    // 3. Initialize Position Manager (load from DB)
    console.log('[3/11] Initializing Position Manager...');
    await initializePositionManager();
    console.log('       ✓ Position Manager initialized');

    // 4. Start Price Engine (in-memory price state)
    console.log('[4/11] Starting Price Engine...');
    const priceEngine = startPriceEngine();
    console.log('       ✓ Price Engine started');

    // 5. Start Binance Feed (connects to Binance WebSocket)
    console.log('[5/11] Starting Binance Price Feed...');
    const binanceFeed = await startBinanceFeed(priceEngine);
    console.log('       ✓ Binance Feed connected');

    // 6. Start WebSocket Server (client connections)
    console.log('[6/11] Starting WebSocket Server...');
    const wsServer = startWebSocketServer(WS_PORT, priceEngine);
    console.log(`       ✓ WebSocket Server listening on port ${WS_PORT}`);

    // 7. Start TP/SL Engine (synchronous triggers)
    console.log('[7/11] Starting TP/SL Engine...');
    const tpslEngine = startTPSLEngine(priceEngine);
    console.log('       ✓ TP/SL Engine started');

    // 8. Start Liquidation Engine
    console.log('[8/11] Starting Liquidation Engine...');
    const liquidationEngine = startLiquidationEngine(priceEngine);
    console.log('       ✓ Liquidation Engine started');

    // 9. Start Risk Engine (continuous monitoring)
    console.log('[9/11] Starting Risk Engine...');
    const riskEngine = startRiskEngine(priceEngine, wsServer);
    console.log('       ✓ Risk Engine started');

    // 10. Start Background Workers (DB persistence retries, cleanup)
    console.log('[10/11] Starting Background Workers...');
    const backgroundWorker = startBackgroundWorker();
    console.log('        ✓ Background Worker started');

    // 11. Start Scheduled Workers
    console.log('[11/11] Starting Scheduled Workers...');
    const dailyResetWorker = startDailyResetWorker();
    const evaluationChecker = startEvaluationChecker(wsServer);
    console.log('        ✓ Daily Reset Worker started');
    console.log('        ✓ Evaluation Checker started');

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║              TRADING ENGINE READY                         ║
╠═══════════════════════════════════════════════════════════╣
║  Architecture: Synchronous In-Memory Execution            ║
║  Target:       <10ms order execution                      ║
║  WebSocket:    ws://localhost:${WS_PORT.toString().padEnd(28)}║
║  Environment:  ${(process.env.NODE_ENV || 'development').padEnd(41)}║
║  Started:      ${new Date().toISOString().padEnd(41)}║
╚═══════════════════════════════════════════════════════════╝
`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[${signal}] Shutting down gracefully...`);

      // Stop accepting new connections
      wsServer.close();

      // Stop all services
      tpslEngine.stop();
      liquidationEngine.stop();
      riskEngine.stop();
      backgroundWorker.stop();
      dailyResetWorker.stop();
      evaluationChecker.stop();

      // Disconnect from Binance
      binanceFeed.disconnect();

      // Flush account state to database
      console.log('Flushing account state to database...');
      await accountManager.shutdown();

      // Flush audit logs before exit
      await auditLogger.shutdown();

      console.log('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start Trading Engine:', error);
    process.exit(1);
  }
}

main();
