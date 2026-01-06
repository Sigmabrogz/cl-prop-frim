// ===========================================
// DATABASE SEED SCRIPT
// ===========================================

import { db } from '../index.js';
import { evaluationPlans, marketPairs, users } from '../schema/index.js';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // ===========================================
  // SEED EVALUATION PLANS
  // ===========================================
  console.log('📋 Seeding evaluation plans...');

  const plans = [
    // 1-STEP CLASSIC
    {
      name: '1-Step Classic $10K',
      slug: '1-step-classic-10k',
      description: 'Start your trading journey with our Classic 1-Step evaluation',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '10000',
      evaluationFee: '99',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '5.00',
      maxDrawdownPct: '10.00',
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 10,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 1,
    },
    {
      name: '1-Step Classic $25K',
      slug: '1-step-classic-25k',
      description: 'Start your trading journey with our Classic 1-Step evaluation',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '25000',
      evaluationFee: '199',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '5.00',
      maxDrawdownPct: '10.00',
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 10,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 2,
    },
    {
      name: '1-Step Classic $50K',
      slug: '1-step-classic-50k',
      description: 'Start your trading journey with our Classic 1-Step evaluation',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '50000',
      evaluationFee: '349',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '5.00',
      maxDrawdownPct: '10.00',
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 10,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 3,
    },
    {
      name: '1-Step Classic $100K',
      slug: '1-step-classic-100k',
      description: 'Start your trading journey with our Classic 1-Step evaluation',
      evaluationType: '1-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '100000',
      evaluationFee: '549',
      step1ProfitTargetPct: '10.00',
      dailyLossLimitPct: '5.00',
      maxDrawdownPct: '10.00',
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 10,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 4,
    },
    // 2-STEP CLASSIC
    {
      name: '2-Step Classic $10K',
      slug: '2-step-classic-10k',
      description: 'Two-step evaluation with lower targets per step',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '10000',
      evaluationFee: '79',
      step1ProfitTargetPct: '8.00',
      step2ProfitTargetPct: '5.00',
      dailyLossLimitPct: '5.00',
      maxDrawdownPct: '10.00',
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 10,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 10,
    },
    {
      name: '2-Step Classic $25K',
      slug: '2-step-classic-25k',
      description: 'Two-step evaluation with lower targets per step',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '25000',
      evaluationFee: '159',
      step1ProfitTargetPct: '8.00',
      step2ProfitTargetPct: '5.00',
      dailyLossLimitPct: '5.00',
      maxDrawdownPct: '10.00',
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 10,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 11,
    },
    {
      name: '2-Step Classic $50K',
      slug: '2-step-classic-50k',
      description: 'Two-step evaluation with lower targets per step',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '50000',
      evaluationFee: '279',
      step1ProfitTargetPct: '8.00',
      step2ProfitTargetPct: '5.00',
      dailyLossLimitPct: '5.00',
      maxDrawdownPct: '10.00',
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 10,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 12,
    },
    {
      name: '2-Step Classic $100K',
      slug: '2-step-classic-100k',
      description: 'Two-step evaluation with lower targets per step',
      evaluationType: '2-STEP' as const,
      accountTier: 'CLASSIC' as const,
      accountSize: '100000',
      evaluationFee: '449',
      step1ProfitTargetPct: '8.00',
      step2ProfitTargetPct: '5.00',
      dailyLossLimitPct: '5.00',
      maxDrawdownPct: '10.00',
      minTradingDays: 5,
      minTradeDurationSeconds: 120,
      btcEthMaxLeverage: 10,
      altcoinMaxLeverage: 5,
      profitSplitPct: 80,
      displayOrder: 13,
    },
  ];

  for (const plan of plans) {
    const existing = await db.query.evaluationPlans.findFirst({
      where: eq(evaluationPlans.slug, plan.slug),
    });

    if (!existing) {
      await db.insert(evaluationPlans).values(plan);
      console.log(`  ✓ Created plan: ${plan.name}`);
    } else {
      console.log(`  - Plan exists: ${plan.name}`);
    }
  }

  // ===========================================
  // SEED MARKET PAIRS
  // ===========================================
  console.log('\n📈 Seeding market pairs...');

  const pairs = [
    { symbol: 'BTCUSDT', baseCurrency: 'BTC', quoteCurrency: 'USDT', displayName: 'Bitcoin', category: 'major', spreadBps: 5, maxLeverage: 10, minQuantity: '0.001', quantityPrecision: 3, pricePrecision: 2 },
    { symbol: 'ETHUSDT', baseCurrency: 'ETH', quoteCurrency: 'USDT', displayName: 'Ethereum', category: 'major', spreadBps: 5, maxLeverage: 10, minQuantity: '0.01', quantityPrecision: 2, pricePrecision: 2 },
    { symbol: 'BNBUSDT', baseCurrency: 'BNB', quoteCurrency: 'USDT', displayName: 'BNB', category: 'major', spreadBps: 8, maxLeverage: 10, minQuantity: '0.01', quantityPrecision: 2, pricePrecision: 2 },
    { symbol: 'SOLUSDT', baseCurrency: 'SOL', quoteCurrency: 'USDT', displayName: 'Solana', category: 'altcoin', spreadBps: 10, maxLeverage: 5, minQuantity: '0.1', quantityPrecision: 1, pricePrecision: 2 },
    { symbol: 'XRPUSDT', baseCurrency: 'XRP', quoteCurrency: 'USDT', displayName: 'Ripple', category: 'altcoin', spreadBps: 10, maxLeverage: 5, minQuantity: '1', quantityPrecision: 0, pricePrecision: 4 },
    { symbol: 'ADAUSDT', baseCurrency: 'ADA', quoteCurrency: 'USDT', displayName: 'Cardano', category: 'altcoin', spreadBps: 12, maxLeverage: 5, minQuantity: '1', quantityPrecision: 0, pricePrecision: 4 },
    { symbol: 'DOGEUSDT', baseCurrency: 'DOGE', quoteCurrency: 'USDT', displayName: 'Dogecoin', category: 'meme', spreadBps: 15, maxLeverage: 5, minQuantity: '10', quantityPrecision: 0, pricePrecision: 5 },
    { symbol: 'DOTUSDT', baseCurrency: 'DOT', quoteCurrency: 'USDT', displayName: 'Polkadot', category: 'altcoin', spreadBps: 10, maxLeverage: 5, minQuantity: '0.1', quantityPrecision: 1, pricePrecision: 3 },
    { symbol: 'LINKUSDT', baseCurrency: 'LINK', quoteCurrency: 'USDT', displayName: 'Chainlink', category: 'defi', spreadBps: 10, maxLeverage: 5, minQuantity: '0.1', quantityPrecision: 1, pricePrecision: 3 },
    { symbol: 'MATICUSDT', baseCurrency: 'MATIC', quoteCurrency: 'USDT', displayName: 'Polygon', category: 'altcoin', spreadBps: 12, maxLeverage: 5, minQuantity: '1', quantityPrecision: 0, pricePrecision: 4 },
    { symbol: 'AVAXUSDT', baseCurrency: 'AVAX', quoteCurrency: 'USDT', displayName: 'Avalanche', category: 'altcoin', spreadBps: 10, maxLeverage: 5, minQuantity: '0.1', quantityPrecision: 1, pricePrecision: 2 },
    { symbol: 'LTCUSDT', baseCurrency: 'LTC', quoteCurrency: 'USDT', displayName: 'Litecoin', category: 'major', spreadBps: 8, maxLeverage: 10, minQuantity: '0.01', quantityPrecision: 2, pricePrecision: 2 },
    { symbol: 'UNIUSDT', baseCurrency: 'UNI', quoteCurrency: 'USDT', displayName: 'Uniswap', category: 'defi', spreadBps: 12, maxLeverage: 5, minQuantity: '0.1', quantityPrecision: 1, pricePrecision: 3 },
    { symbol: 'ATOMUSDT', baseCurrency: 'ATOM', quoteCurrency: 'USDT', displayName: 'Cosmos', category: 'altcoin', spreadBps: 10, maxLeverage: 5, minQuantity: '0.1', quantityPrecision: 1, pricePrecision: 3 },
    { symbol: 'XLMUSDT', baseCurrency: 'XLM', quoteCurrency: 'USDT', displayName: 'Stellar', category: 'altcoin', spreadBps: 12, maxLeverage: 5, minQuantity: '10', quantityPrecision: 0, pricePrecision: 5 },
  ];

  for (const pair of pairs) {
    const existing = await db.query.marketPairs.findFirst({
      where: eq(marketPairs.symbol, pair.symbol),
    });

    if (!existing) {
      await db.insert(marketPairs).values(pair);
      console.log(`  ✓ Created pair: ${pair.symbol}`);
    } else {
      console.log(`  - Pair exists: ${pair.symbol}`);
    }
  }

  // ===========================================
  // SEED ADMIN USER (for testing)
  // ===========================================
  console.log('\n👤 Seeding admin user...');

  const adminEmail = 'admin@propfirm.local';
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  if (!existingAdmin) {
    // Password: Admin123! (hashed with argon2)
    // In production, use a secure password and proper hashing
    await db.insert(users).values({
      email: adminEmail,
      username: 'admin',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$randomsalt$hashedpassword', // Placeholder
      fullName: 'Platform Admin',
      role: 'admin',
      status: 'active',
      emailVerifiedAt: new Date(),
    });
    console.log(`  ✓ Created admin user: ${adminEmail}`);
    console.log('  ⚠️  Note: Update the password hash with a real argon2 hash!');
  } else {
    console.log(`  - Admin user exists: ${adminEmail}`);
  }

  console.log('\n✅ Database seeding complete!\n');
}

// Run seed
seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });

