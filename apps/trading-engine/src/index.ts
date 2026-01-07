// ===========================================
// TRADING ENGINE - MAIN ENTRY POINT
// ===========================================
// Optimized for <10ms order execution using synchronous in-memory processing

import { startWebSocketServer } from './websocket/server.js';
import { startPriceEngine } from './price/price-engine.js';
import { startBinanceFeed } from './price/binance-feed.js';
import { startMarketDataService } from './price/market-data-service.js';
import { startOrderBookFeed } from './price/orderbook-feed.js';
import { startBackgroundWorker } from './workers/background-worker.js';
import { startRiskEngine } from './risk/risk-engine.js';
import { startTPSLEngine } from './triggers/tpsl-engine.js';
import { startLiquidationEngine } from './triggers/liquidation-engine.js';
import { startDailyResetWorker } from './workers/daily-reset-worker.js';
import { startFundingWorker } from './workers/funding-worker.js';
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
    console.log('[1/14] Checking Redis connection...');
    const redisHealthy = await checkRedisHealth();
    if (!redisHealthy) {
      throw new Error('Redis is not available');
    }
    console.log('       ✓ Redis connected');

    // 2. Initialize Account Manager (in-memory account state)
    console.log('[2/14] Initializing Account Manager...');
    await accountManager.initialize();
    console.log('       ✓ Account Manager initialized');

    // 3. Initialize Position Manager (load from DB)
    console.log('[3/14] Initializing Position Manager...');
    await initializePositionManager();
    console.log('       ✓ Position Manager initialized');

    // 4. Start Price Engine (in-memory price state)
    console.log('[4/14] Starting Price Engine...');
    const priceEngine = startPriceEngine();
    console.log('       ✓ Price Engine started');

    // 5. Start Binance Feed (connects to Binance WebSocket)
    console.log('[5/14] Starting Binance Price Feed...');
    const binanceFeed = await startBinanceFeed(priceEngine);
    console.log('       ✓ Binance Feed connected');

    // 6. Start Market Data Service (24h stats, funding rates)
    console.log('[6/14] Starting Market Data Service...');
    const marketDataService = startMarketDataService();
    console.log('       ✓ Market Data Service started');

    // 7. Start Order Book Feed (real-time order book from Binance)
    console.log('[7/14] Starting Order Book Feed...');
    const orderBookFeed = await startOrderBookFeed();
    console.log('       ✓ Order Book Feed connected');

    // 8. Start WebSocket Server (client connections)
    console.log('[8/14] Starting WebSocket Server...');
    const wsServer = startWebSocketServer(WS_PORT, priceEngine, marketDataService, orderBookFeed);
    console.log(`       ✓ WebSocket Server listening on port ${WS_PORT}`);

    // 9. Start TP/SL Engine (synchronous triggers)
    console.log('[9/14] Starting TP/SL Engine...');
    const tpslEngine = startTPSLEngine(priceEngine);
    console.log('       ✓ TP/SL Engine started');

    // 10. Start Liquidation Engine
    console.log('[10/14] Starting Liquidation Engine...');
    const liquidationEngine = startLiquidationEngine(priceEngine);
    console.log('        ✓ Liquidation Engine started');

    // 11. Start Risk Engine (continuous monitoring)
    console.log('[11/14] Starting Risk Engine...');
    const riskEngine = startRiskEngine(priceEngine, wsServer);
    console.log('        ✓ Risk Engine started');

    // 12. Start Background Workers (DB persistence retries, cleanup)
    console.log('[12/14] Starting Background Workers...');
    const backgroundWorker = startBackgroundWorker();
    console.log('        ✓ Background Worker started');

    // 13. Start Scheduled Workers
    console.log('[13/14] Starting Scheduled Workers...');
    const dailyResetWorker = startDailyResetWorker();
    const evaluationChecker = startEvaluationChecker(wsServer);
    console.log('        ✓ Daily Reset Worker started');
    console.log('        ✓ Evaluation Checker started');

    // 14. Start Funding Worker (8-hour funding rate application)
    console.log('[14/14] Starting Funding Worker...');
    const fundingWorker = startFundingWorker();
    console.log('        ✓ Funding Worker started');

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
      fundingWorker.stop();
      evaluationChecker.stop();
      marketDataService.stop();

      // Disconnect from Binance
      binanceFeed.disconnect();
      orderBookFeed.disconnect();

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
