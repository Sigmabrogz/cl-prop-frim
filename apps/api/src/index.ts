// ===========================================
// API SERVER - MAIN ENTRY POINT
// ===========================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';

import { errorHandler } from './middleware/error-handler.js';
import { rateLimiter } from './middleware/rate-limit.js';

import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import planRoutes from './routes/plans.js';
import tradeRoutes from './routes/trades.js';
import tradeEventsRoutes from './routes/trade-events.js';
import orderRoutes from './routes/orders.js';
import payoutRoutes from './routes/payouts.js';
import adminRoutes from './routes/admin/index.js';

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
// APP INITIALIZATION
// ===========================================

const app = new Hono();

// ===========================================
// GLOBAL MIDDLEWARE
// ===========================================

// Request timing
app.use('*', timing());

// Request logging
app.use('*', logger());

// Security headers
app.use('*', secureHeaders());

// CORS configuration - support multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://perpetual-empathy-production.up.railway.app',
].filter(Boolean) as string[];

app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return 'http://localhost:3000';
      // Check if origin is in allowed list
      if (allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '').replace('http://', '')))) {
        return origin;
      }
      // For Railway preview deployments, allow any railway.app subdomain
      if (origin.includes('.up.railway.app')) {
        return origin;
      }
      return allowedOrigins[0];
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
    exposeHeaders: ['X-Request-ID', 'X-Response-Time'],
    maxAge: 86400, // 24 hours
  })
);

// CSRF Protection - DISABLED for cross-origin API setup
// In production with separate frontend/API domains, CSRF cookies don't work
// We rely on JWT Bearer tokens for authentication instead
// The CORS policy + JWT auth provides sufficient protection for this API setup
//
// If you need CSRF protection in the future, consider:
// 1. Using same-origin deployment (API and frontend on same domain)
// 2. Using a stateless CSRF token passed in response headers
// 3. Using SameSite=None cookies with proper domain configuration

// Rate limiting (1000 req/min per IP)
app.use('*', rateLimiter);

// Global error handler
app.onError(errorHandler);

// ===========================================
// HEALTH CHECK
// ===========================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ===========================================
// API ROUTES
// ===========================================

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/accounts', accountRoutes);
app.route('/api/plans', planRoutes);
app.route('/api/trades', tradeRoutes);
app.route('/api/trade-events', tradeEventsRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/payouts', payoutRoutes);
app.route('/api/admin', adminRoutes);

// ===========================================
// 404 HANDLER
// ===========================================

app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// ===========================================
// START SERVER
// ===========================================

const port = parseInt(process.env.PORT || process.env.API_PORT || '3001', 10);

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                   PROPFIRM API SERVER                     ║
╠═══════════════════════════════════════════════════════════╣
║  Port:        ${port.toString().padEnd(42)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(42)}║
║  Started:     ${new Date().toISOString().padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
`);

export default {
  port,
  fetch: app.fetch,
};

