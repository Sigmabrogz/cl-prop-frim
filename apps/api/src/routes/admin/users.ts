// ===========================================
// ADMIN - USERS ROUTES
// ===========================================

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@propfirm/database';
import { users } from '@propfirm/database/schema';
import { eq, desc, like, or, sql } from 'drizzle-orm';

const usersAdmin = new Hono();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const listUsersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  role: z.enum(['user', 'admin', 'support']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const updateUserSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  role: z.enum(['user', 'admin', 'support']).optional(),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/admin/users
 * List all users
 */
usersAdmin.get('/', zValidator('query', listUsersSchema), async (c) => {
  const { search, status, role, limit, offset } = c.req.valid('query');

  // Build conditions
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        like(users.email, `%${search}%`),
        like(users.username, `%${search}%`),
        like(users.fullName, `%${search}%`)
      )
    );
  }

  if (status) {
    conditions.push(eq(users.status, status));
  }

  if (role) {
    conditions.push(eq(users.role, role));
  }

  const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  // Get users (without sensitive fields)
  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      fullName: users.fullName,
      status: users.status,
      role: users.role,
      kycStatus: users.kycStatus,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause);

  return c.json({
    users: userList,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + userList.length < count,
    },
  });
});

/**
 * GET /api/admin/users/:id
 * Get a single user
 */
usersAdmin.get('/:id', async (c) => {
  const userId = c.req.param('id');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      phone: true,
      countryCode: true,
      status: true,
      role: true,
      kycStatus: true,
      kycSubmittedAt: true,
      kycApprovedAt: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      twoFaEnabled: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      lastLoginIp: true,
    },
    with: {
      tradingAccounts: {
        orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
      },
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

/**
 * PATCH /api/admin/users/:id
 * Update user status or role
 */
usersAdmin.patch('/:id', zValidator('json', updateUserSchema), async (c) => {
  const userId = c.req.param('id');
  const data = c.req.valid('json');
  const admin = c.get('user');

  // Prevent admin from modifying themselves
  if (userId === admin.id) {
    return c.json({ error: 'Cannot modify your own account' }, 400);
  }

  const [user] = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      status: users.status,
      role: users.role,
    });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    message: 'User updated',
    user,
  });
});

/**
 * POST /api/admin/users/:id/suspend
 * Suspend a user
 */
usersAdmin.post('/:id/suspend', async (c) => {
  const userId = c.req.param('id');
  const admin = c.get('user');

  if (userId === admin.id) {
    return c.json({ error: 'Cannot suspend your own account' }, 400);
  }

  const [user] = await db
    .update(users)
    .set({
      status: 'suspended',
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id, status: users.status });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    message: 'User suspended',
    user,
  });
});

/**
 * POST /api/admin/users/:id/activate
 * Activate a suspended user
 */
usersAdmin.post('/:id/activate', async (c) => {
  const userId = c.req.param('id');

  const [user] = await db
    .update(users)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id, status: users.status });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    message: 'User activated',
    user,
  });
});

export default usersAdmin;

