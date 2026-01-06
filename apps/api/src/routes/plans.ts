// ===========================================
// PLANS ROUTES
// ===========================================

import { Hono } from 'hono';
import { db } from '@propfirm/database';
import { evaluationPlans } from '@propfirm/database/schema';
import { eq, asc } from 'drizzle-orm';

const plans = new Hono();

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/plans
 * List all active evaluation plans
 */
plans.get('/', async (c) => {
  const planList = await db.query.evaluationPlans.findMany({
    where: eq(evaluationPlans.isActive, true),
    orderBy: [asc(evaluationPlans.displayOrder), asc(evaluationPlans.accountSize)],
  });

  // Group by evaluation type
  const grouped = {
    oneStep: planList.filter((p) => p.evaluationType === '1-STEP'),
    twoStep: planList.filter((p) => p.evaluationType === '2-STEP'),
  };

  return c.json({
    plans: planList,
    grouped,
    count: planList.length,
  });
});

/**
 * GET /api/plans/:slug
 * Get a single plan by slug
 */
plans.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const plan = await db.query.evaluationPlans.findFirst({
    where: eq(evaluationPlans.slug, slug),
  });

  if (!plan) {
    return c.json({ error: 'Plan not found' }, 404);
  }

  // Calculate derived values for display
  const accountSize = parseFloat(plan.accountSize);
  const derived = {
    dailyLossLimitAmount: (accountSize * parseFloat(plan.dailyLossLimitPct) / 100).toFixed(2),
    maxDrawdownAmount: (accountSize * parseFloat(plan.maxDrawdownPct) / 100).toFixed(2),
    step1ProfitTargetAmount: (accountSize * parseFloat(plan.step1ProfitTargetPct) / 100).toFixed(2),
    step2ProfitTargetAmount: plan.step2ProfitTargetPct
      ? (accountSize * parseFloat(plan.step2ProfitTargetPct) / 100).toFixed(2)
      : null,
  };

  return c.json({
    plan,
    derived,
  });
});

export default plans;

