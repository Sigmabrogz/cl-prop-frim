// ===========================================
// PLANS ROUTES
// ===========================================

import { Hono } from 'hono';
import { db } from '@propfirm/database';
import { evaluationPlans } from '@propfirm/database/schema';
import { eq, asc } from 'drizzle-orm';

const plans = new Hono();

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Transform database plan to frontend-friendly format
 */
function transformPlan(plan: typeof evaluationPlans.$inferSelect) {
  const accountSize = parseFloat(plan.accountSize);
  return {
    ...plan,
    // Computed fields for display convenience
    price: parseFloat(plan.evaluationFee),
    accountSizeNum: accountSize,
    accountSize: accountSize, // Override string with number for frontend
    profitTargetStep1: parseFloat(plan.step1ProfitTargetPct),
    profitTargetStep2: plan.step2ProfitTargetPct ? parseFloat(plan.step2ProfitTargetPct) : undefined,
    dailyLossLimit: parseFloat(plan.dailyLossLimitPct),
    maxDrawdown: parseFloat(plan.maxDrawdownPct),
    maxLeverage: Math.max(plan.btcEthMaxLeverage, plan.altcoinMaxLeverage),
    profitSplit: plan.profitSplitPct,
  };
}

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

  const transformedPlans = planList.map(transformPlan);

  // Group by evaluation type and tier
  const grouped = {
    oneStep: {
      classic: transformedPlans.filter((p) => p.evaluationType === '1-STEP' && p.accountTier === 'CLASSIC'),
      turbo: transformedPlans.filter((p) => p.evaluationType === '1-STEP' && p.accountTier === 'TURBO'),
    },
    twoStep: transformedPlans.filter((p) => p.evaluationType === '2-STEP'),
  };

  return c.json({
    plans: transformedPlans,
    grouped,
    count: transformedPlans.length,
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

  const transformedPlan = transformPlan(plan);

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
    plan: transformedPlan,
    derived,
  });
});

export default plans;

