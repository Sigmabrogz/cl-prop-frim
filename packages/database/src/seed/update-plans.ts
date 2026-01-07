// ===========================================
// UPDATE EVALUATION PLANS SCRIPT
// ===========================================
// This script removes old plans and inserts the new 16 plans

import { db } from '../index.js';
import { evaluationPlans, tradingAccounts } from '../schema/index.js';
import { eq, sql, isNotNull } from 'drizzle-orm';

async function updatePlans() {
  console.log('🔄 Updating evaluation plans...\n');

  // First, check if any accounts are using old plans
  const accountsWithPlans = await db.query.tradingAccounts.findMany({
    columns: { id: true },
    where: isNotNull(tradingAccounts.planId),
  });
  
  const accountCount = accountsWithPlans.length;
  
  if (accountCount > 0) {
    console.log(`⚠️  Warning: ${accountCount} accounts are linked to existing plans.`);
    console.log('   Skipping plan deletion to preserve data integrity.');
    console.log('   New plans will be added alongside existing ones.\n');
  }

  // Delete old plans (only if no accounts are using them)
  if (accountCount === 0) {
    console.log('🗑️  Deleting old plans...');
    await db.delete(evaluationPlans);
    console.log('   ✓ Old plans deleted\n');
  }

  // New plans data
  const plans = [
    // ===========================================
    // CLASSIC PLANS (1-STEP) - 10% profit target, 4% daily, 6% max DD
    // ===========================================
    {
      name: 'Classic $2.5K',
      slug: '1-step-classic-2.5k',
      description: 'Classic 1-Step evaluation - Prove your skills and get funded',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '2500',
      evaluationFee: '35',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '6.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 1,
    },
    {
      name: 'Classic $5K',
      slug: '1-step-classic-5k',
      description: 'Classic 1-Step evaluation - Prove your skills and get funded',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '5000',
      evaluationFee: '59',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '6.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 2,
    },
    {
      name: 'Classic $10K',
      slug: '1-step-classic-10k',
      description: 'Classic 1-Step evaluation - Prove your skills and get funded',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '10000',
      evaluationFee: '99',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '6.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 3,
    },
    {
      name: 'Classic $25K',
      slug: '1-step-classic-25k',
      description: 'Classic 1-Step evaluation - Prove your skills and get funded',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '25000',
      evaluationFee: '199',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '6.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 4,
    },
    {
      name: 'Classic $50K',
      slug: '1-step-classic-50k',
      description: 'Classic 1-Step evaluation - Prove your skills and get funded',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '50000',
      evaluationFee: '349',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '6.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 5,
    },

    // ===========================================
    // TURBO PLANS (1-STEP) - 8% profit target, 4% daily, 4% max DD
    // ===========================================
    {
      name: 'Turbo $2.5K',
      slug: '1-step-turbo-2.5k',
      description: 'Turbo 1-Step evaluation - Lower target, faster funding',
      evaluationType: '1-STEP' as const,
      accountTier: 'TURBO' as const,
      accountSize: '2500',
      evaluationFee: '45',
      step1ProfitTargetPct: '8.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '4.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 70,
      displayOrder: 10,
    },
    {
      name: 'Turbo $5K',
      slug: '1-step-turbo-5k',
      description: 'Turbo 1-Step evaluation - Lower target, faster funding',
      evaluationType: '1-STEP' as const,
      accountTier: 'TURBO' as const,
      accountSize: '5000',
      evaluationFee: '79',
      step1ProfitTargetPct: '8.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '4.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 70,
      displayOrder: 11,
    },
    {
      name: 'Turbo $10K',
      slug: '1-step-turbo-10k',
      description: 'Turbo 1-Step evaluation - Lower target, faster funding',
      evaluationType: '1-STEP' as const,
      accountTier: 'TURBO' as const,
      accountSize: '10000',
      evaluationFee: '129',
      step1ProfitTargetPct: '8.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '4.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 70,
      displayOrder: 12,
    },
    {
      name: 'Turbo $25K',
      slug: '1-step-turbo-25k',
      description: 'Turbo 1-Step evaluation - Lower target, faster funding',
      evaluationType: '1-STEP' as const,
      accountTier: 'TURBO' as const,
      accountSize: '25000',
      evaluationFee: '259',
      step1ProfitTargetPct: '8.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '4.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 70,
      displayOrder: 13,
    },
    {
      name: 'Turbo $50K',
      slug: '1-step-turbo-50k',
      description: 'Turbo 1-Step evaluation - Lower target, faster funding',
      evaluationType: '1-STEP' as const,
      accountTier: 'TURBO' as const,
      accountSize: '50000',
      evaluationFee: '449',
      step1ProfitTargetPct: '8.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '4.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 70,
      displayOrder: 14,
    },
    {
      name: 'Turbo $100K',
      slug: '1-step-turbo-100k',
      description: 'Turbo 1-Step evaluation - Lower target, faster funding',
      evaluationType: '1-STEP' as const,
      accountTier: 'TURBO' as const,
      accountSize: '100000',
      evaluationFee: '749',
      step1ProfitTargetPct: '8.00',
      dailyLossLimitPct: '4.00',
      maxDrawdownPct: '4.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 70,
      displayOrder: 15,
    },

    // ===========================================
    // 2-STEP PLANS - 4% step1, 9% step2, 6% daily, 9% max DD
    // ===========================================
    {
      name: '2-Step $2.5K',
      slug: '2-step-classic-2.5k',
      description: 'Two-step evaluation - Lower fees, two phases',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '2500',
      evaluationFee: '25',
      step1ProfitTargetPct: '4.00',
      step2ProfitTargetPct: '9.00',
      dailyLossLimitPct: '6.00',
      maxDrawdownPct: '9.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 20,
    },
    {
      name: '2-Step $5K',
      slug: '2-step-classic-5k',
      description: 'Two-step evaluation - Lower fees, two phases',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '5000',
      evaluationFee: '45',
      step1ProfitTargetPct: '4.00',
      step2ProfitTargetPct: '9.00',
      dailyLossLimitPct: '6.00',
      maxDrawdownPct: '9.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 21,
    },
    {
      name: '2-Step $10K',
      slug: '2-step-classic-10k',
      description: 'Two-step evaluation - Lower fees, two phases',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '10000',
      evaluationFee: '79',
      step1ProfitTargetPct: '4.00',
      step2ProfitTargetPct: '9.00',
      dailyLossLimitPct: '6.00',
      maxDrawdownPct: '9.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 22,
    },
    {
      name: '2-Step $25K',
      slug: '2-step-classic-25k',
      description: 'Two-step evaluation - Lower fees, two phases',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '25000',
      evaluationFee: '159',
      step1ProfitTargetPct: '4.00',
      step2ProfitTargetPct: '9.00',
      dailyLossLimitPct: '6.00',
      maxDrawdownPct: '9.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 23,
    },
    {
      name: '2-Step $50K',
      slug: '2-step-classic-50k',
      description: 'Two-step evaluation - Lower fees, two phases',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '50000',
      evaluationFee: '279',
      step1ProfitTargetPct: '4.00',
      step2ProfitTargetPct: '9.00',
      dailyLossLimitPct: '6.00',
      maxDrawdownPct: '9.00',
      trailingDrawdown: true,
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 5,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 24,
    },
  ];

  console.log('📋 Inserting new plans...');
  
  for (const plan of plans) {
    // Check if plan already exists
    const existing = await db.query.evaluationPlans.findFirst({
      where: eq(evaluationPlans.slug, plan.slug),
    });

    if (existing) {
      // Update existing plan
      await db.update(evaluationPlans)
        .set({
          ...plan,
          updatedAt: new Date(),
        })
        .where(eq(evaluationPlans.slug, plan.slug));
      console.log(`   ✓ Updated: ${plan.name}`);
    } else {
      // Insert new plan
      await db.insert(evaluationPlans).values(plan);
      console.log(`   ✓ Created: ${plan.name}`);
    }
  }

  // Deactivate old plans that are no longer in the new list
  const newSlugs = plans.map(p => p.slug);
  const allPlans = await db.query.evaluationPlans.findMany();
  
  for (const plan of allPlans) {
    if (!newSlugs.includes(plan.slug) && plan.isActive) {
      await db.update(evaluationPlans)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(evaluationPlans.id, plan.id));
      console.log(`   ⚠️  Deactivated old plan: ${plan.name}`);
    }
  }

  console.log('\n✅ Plan update complete!\n');
  
  // Show summary
  const finalPlans = await db.query.evaluationPlans.findMany({
    where: eq(evaluationPlans.isActive, true),
  });
  
  console.log('📊 Summary:');
  console.log(`   Total active plans: ${finalPlans.length}`);
  console.log(`   Classic 1-Step: ${finalPlans.filter(p => p.evaluationType === '1-STEP' && p.accountTier === 'CLASSIC').length}`);
  console.log(`   Turbo 1-Step: ${finalPlans.filter(p => p.evaluationType === '1-STEP' && p.accountTier === 'TURBO').length}`);
  console.log(`   2-Step: ${finalPlans.filter(p => p.evaluationType === '2-STEP').length}`);
}

// Run the update
updatePlans()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Update failed:', error);
    process.exit(1);
  });

