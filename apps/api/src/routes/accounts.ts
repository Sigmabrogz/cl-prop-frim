// ===========================================
// ACCOUNT ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as accountService from '../services/account-service.js';

const accounts = new Hono();

// All account routes require authentication
accounts.use('*', requireAuth);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createAccountSchema = z.object({
  planId: z.number().int().positive('Invalid plan ID'),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/accounts
 * List all accounts for the current user
 */
accounts.get('/', async (c) => {
  const user = c.get('user');
  const accountList = await accountService.getUserAccounts(user.id);

  return c.json({
    accounts: accountList,
    count: accountList.length,
  });
});

/**
 * POST /api/accounts
 * Create a new evaluation account
 */
accounts.post('/', zValidator('json', createAccountSchema), async (c) => {
  const user = c.get('user');
  const { planId } = c.req.valid('json');

  const account = await accountService.createAccount({
    userId: user.id,
    planId,
  });

  return c.json(
    {
      message: 'Account created successfully',
      account,
    },
    201
  );
});

/**
 * GET /api/accounts/:id
 * Get account details
 */
accounts.get('/:id', async (c) => {
  const user = c.get('user');
  const accountId = c.req.param('id');

  const account = await accountService.getAccountById(accountId, user.id);

  return c.json({ account });
});

/**
 * GET /api/accounts/:id/stats
 * Get real-time account statistics
 */
accounts.get('/:id/stats', async (c) => {
  const user = c.get('user');
  const accountId = c.req.param('id');

  const stats = await accountService.getAccountStats(accountId, user.id);

  return c.json({ stats });
});

/**
 * GET /api/accounts/:id/trades
 * Get account trade history
 */
accounts.get('/:id/trades', zValidator('query', paginationSchema), async (c) => {
  const user = c.get('user');
  const accountId = c.req.param('id');
  const { limit, offset } = c.req.valid('query');

  const result = await accountService.getAccountTrades(accountId, user.id, {
    limit,
    offset,
  });

  return c.json(result);
});

/**
 * GET /api/accounts/:id/positions
 * Get account open positions
 */
accounts.get('/:id/positions', async (c) => {
  const user = c.get('user');
  const accountId = c.req.param('id');

  const positionList = await accountService.getAccountPositions(accountId, user.id);

  return c.json({
    positions: positionList,
    count: positionList.length,
  });
});

export default accounts;

