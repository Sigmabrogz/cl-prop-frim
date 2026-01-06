// ===========================================
// ADMIN - PAYOUTS ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@propfirm/database';
import { payouts, tradingAccounts, users } from '@propfirm/database/schema';
import { eq, desc, sql } from 'drizzle-orm';

const payoutsAdmin = new Hono();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const listPayoutsSchema = z.object({
  status: z.enum(['pending', 'approved', 'processing', 'completed', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const rejectPayoutSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/admin/payouts
 * List all payouts
 */
payoutsAdmin.get('/', zValidator('query', listPayoutsSchema), async (c) => {
  const { status, limit, offset } = c.req.valid('query');

  const whereClause = status ? eq(payouts.status, status) : undefined;

  const payoutList = await db
    .select({
      id: payouts.id,
      userId: payouts.userId,
      accountId: payouts.accountId,
      requestedAmount: payouts.requestedAmount,
      platformFee: payouts.platformFee,
      netAmount: payouts.netAmount,
      payoutMethod: payouts.payoutMethod,
      destinationAddress: payouts.destinationAddress,
      status: payouts.status,
      createdAt: payouts.createdAt,
      approvedAt: payouts.approvedAt,
      processedAt: payouts.processedAt,
      rejectedAt: payouts.rejectedAt,
      rejectionReason: payouts.rejectionReason,
      user: {
        id: users.id,
        email: users.email,
        username: users.username,
      },
      account: {
        id: tradingAccounts.id,
        accountNumber: tradingAccounts.accountNumber,
        accountType: tradingAccounts.accountType,
      },
    })
    .from(payouts)
    .leftJoin(users, eq(payouts.userId, users.id))
    .leftJoin(tradingAccounts, eq(payouts.accountId, tradingAccounts.id))
    .where(whereClause)
    .orderBy(desc(payouts.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payouts)
    .where(whereClause);

  // Get pending count
  const [{ pendingCount }] = await db
    .select({ pendingCount: sql<number>`count(*)::int` })
    .from(payouts)
    .where(eq(payouts.status, 'pending'));

  return c.json({
    payouts: payoutList,
    pendingCount,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + payoutList.length < count,
    },
  });
});

/**
 * GET /api/admin/payouts/:id
 * Get a single payout
 */
payoutsAdmin.get('/:id', async (c) => {
  const payoutId = c.req.param('id');

  const payout = await db.query.payouts.findFirst({
    where: eq(payouts.id, payoutId),
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          username: true,
          fullName: true,
        },
      },
      account: true,
    },
  });

  if (!payout) {
    return c.json({ error: 'Payout not found' }, 404);
  }

  return c.json({ payout });
});

/**
 * POST /api/admin/payouts/:id/approve
 * Approve a payout request
 */
payoutsAdmin.post('/:id/approve', async (c) => {
  const payoutId = c.req.param('id');
  const admin = c.get('user');

  const [payout] = await db
    .update(payouts)
    .set({
      status: 'approved',
      approvedBy: admin.id,
      approvedAt: new Date(),
    })
    .where(eq(payouts.id, payoutId))
    .returning();

  if (!payout) {
    return c.json({ error: 'Payout not found' }, 404);
  }

  if (payout.status !== 'pending') {
    return c.json({ error: 'Payout is not pending' }, 400);
  }

  return c.json({
    message: 'Payout approved',
    payout,
  });
});

/**
 * POST /api/admin/payouts/:id/reject
 * Reject a payout request
 */
payoutsAdmin.post('/:id/reject', zValidator('json', rejectPayoutSchema), async (c) => {
  const payoutId = c.req.param('id');
  const admin = c.get('user');
  const { reason } = c.req.valid('json');

  // Get current payout to check status
  const currentPayout = await db.query.payouts.findFirst({
    where: eq(payouts.id, payoutId),
  });

  if (!currentPayout) {
    return c.json({ error: 'Payout not found' }, 404);
  }

  if (currentPayout.status !== 'pending') {
    return c.json({ error: 'Payout is not pending' }, 400);
  }

  const [payout] = await db
    .update(payouts)
    .set({
      status: 'rejected',
      rejectedBy: admin.id,
      rejectedAt: new Date(),
      rejectionReason: reason,
    })
    .where(eq(payouts.id, payoutId))
    .returning();

  return c.json({
    message: 'Payout rejected',
    payout,
  });
});

/**
 * POST /api/admin/payouts/:id/process
 * Mark payout as processing (being sent)
 */
payoutsAdmin.post('/:id/process', async (c) => {
  const payoutId = c.req.param('id');

  const currentPayout = await db.query.payouts.findFirst({
    where: eq(payouts.id, payoutId),
  });

  if (!currentPayout) {
    return c.json({ error: 'Payout not found' }, 404);
  }

  if (currentPayout.status !== 'approved') {
    return c.json({ error: 'Payout must be approved first' }, 400);
  }

  const [payout] = await db
    .update(payouts)
    .set({
      status: 'processing',
    })
    .where(eq(payouts.id, payoutId))
    .returning();

  return c.json({
    message: 'Payout marked as processing',
    payout,
  });
});

/**
 * POST /api/admin/payouts/:id/complete
 * Mark payout as completed
 */
payoutsAdmin.post(
  '/:id/complete',
  zValidator('json', z.object({ txHash: z.string().optional() })),
  async (c) => {
    const payoutId = c.req.param('id');
    const { txHash } = c.req.valid('json');

    const currentPayout = await db.query.payouts.findFirst({
      where: eq(payouts.id, payoutId),
    });

    if (!currentPayout) {
      return c.json({ error: 'Payout not found' }, 404);
    }

    if (currentPayout.status !== 'processing' && currentPayout.status !== 'approved') {
      return c.json({ error: 'Payout must be approved or processing' }, 400);
    }

    const [payout] = await db
      .update(payouts)
      .set({
        status: 'completed',
        processedAt: new Date(),
        txHash: txHash || null,
      })
      .where(eq(payouts.id, payoutId))
      .returning();

    return c.json({
      message: 'Payout completed',
      payout,
    });
  }
);

export default payoutsAdmin;

