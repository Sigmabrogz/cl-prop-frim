// ===========================================
// ACCOUNT TYPES
// ===========================================

export type AccountType = 'evaluation' | 'funded';
export type AccountTier = 'CLASSIC' | 'ELITE' | 'PRO';
export type EvaluationType = '1-STEP' | '2-STEP';

export type AccountStatus =
  | 'pending_payment'
  | 'active'
  | 'step1_passed'
  | 'passed'
  | 'breached'
  | 'expired'
  | 'suspended';

export type BreachType = 'daily_loss' | 'max_drawdown' | 'rule_violation';

export interface EvaluationPlan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  evaluationType: EvaluationType;
  accountTier: AccountTier;
  accountSize: string; // Decimal as string
  evaluationFee: string;
  step1ProfitTargetPct: string;
  step2ProfitTargetPct: string | null;
  dailyLossLimitPct: string;
  maxDrawdownPct: string;
  trailingDrawdown: boolean;
  minTradingDays: number;
  maxDailyTrades: number | null;
  minTradeDurationSeconds: number;
  btcEthMaxLeverage: number;
  altcoinMaxLeverage: number;
  profitSplitPct: number;
  maxProfitFromSingleTradePct: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface TradingAccount {
  id: string;
  userId: string;
  planId: number | null;
  accountType: AccountType;
  accountNumber: string;
  currentStep: number;
  parentAccountId: string | null;

  // Balances
  startingBalance: string;
  currentBalance: string;
  peakBalance: string;

  // Margin
  totalMarginUsed: string;
  availableMargin: string;

  // Daily tracking
  dailyStartingBalance: string;
  dailyPnl: string;
  dailyResetAt: Date;

  // Risk limits
  dailyLossLimit: string;
  maxDrawdownLimit: string;

  // Progress
  profitTarget: string;
  currentProfit: string;

  // Stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalVolume: string;
  tradingDays: number;
  lastTradeAt: Date | null;

  // Status
  status: AccountStatus;
  breachType: BreachType | null;
  breachReason: string | null;
  breachedAt: Date | null;
  step1PassedAt: Date | null;
  passedAt: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface AccountStats {
  equity: string;
  unrealizedPnl: string;
  dailyPnl: string;
  dailyLossPercent: number;
  drawdownPercent: number;
  marginUsedPercent: number;
  winRate: number;
  profitFactor: number;
}

export interface AccountWithPlan extends TradingAccount {
  plan: EvaluationPlan | null;
}



