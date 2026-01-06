// ===========================================
// PAYOUT ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as payoutService from '../services/payout-service.js';

const payoutRoutes = new Hono();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createPayoutSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  amount: z.number().positive('Amount must be positive'),
  payoutMethod: z.enum(['crypto_usdt', 'crypto_btc', 'crypto_eth', 'bank_wire']),
  destinationAddress: z.string().min(1, 'Destination address is required'),
  destinationNetwork: z.string().optional(),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/payouts
 * Get all payouts for current user
 */
payoutRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const payouts = await payoutService.getUserPayouts(user.id);

  return c.json({ payouts });
});

/**
 * GET /api/payouts/stats
 * Get payout statistics for current user
 */
payoutRoutes.get('/stats', requireAuth, async (c) => {
  const user = c.get('user');
  const stats = await payoutService.getPayoutStats(user.id);

  return c.json({ stats });
});

/**
 * GET /api/payouts/accounts
 * Get funded accounts with withdrawable amounts
 */
payoutRoutes.get('/accounts', requireAuth, async (c) => {
  const user = c.get('user');
  const accounts = await payoutService.getFundedAccountsWithWithdrawable(user.id);

  return c.json({ accounts });
});

/**
 * GET /api/payouts/:id
 * Get a specific payout
 */
payoutRoutes.get('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const payoutId = c.req.param('id');
  const payout = await payoutService.getPayoutById(payoutId, user.id);

  return c.json({ payout });
});

/**
 * POST /api/payouts
 * Request a new payout
 */
payoutRoutes.post('/', requireAuth, zValidator('json', createPayoutSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  const payout = await payoutService.createPayout(user.id, data);

  return c.json(
    {
      message: 'Payout request submitted successfully',
      payout,
    },
    201
  );
});

/**
 * DELETE /api/payouts/:id
 * Cancel a pending payout
 */
payoutRoutes.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const payoutId = c.req.param('id');

  const result = await payoutService.cancelPayout(payoutId, user.id);

  return c.json(result);
});

export default payoutRoutes;

