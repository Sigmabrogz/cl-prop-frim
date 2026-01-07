const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Get CSRF token from cookie (for double-submit pattern)
 */
function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get WebSocket token from sessionStorage
   * This is a short-lived token used only for WebSocket authentication
   */
  getWsToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('ws_token');
  }

  /**
   * Store WebSocket token in sessionStorage (more secure than localStorage)
   */
  setWsToken(token: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('ws_token', token);
  }

  /**
   * Clear WebSocket token
   */
  clearWsToken(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('ws_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { skipAuth = false, ...fetchOptions } = options;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method || 'GET')) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers,
        credentials: 'include', // SECURITY: Send httpOnly cookies
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle API error responses - prefer message over error name
        const errorMessage = data.message || data.error || 'An error occurred';
        return {
          success: false,
          error: typeof errorMessage === 'string' ? errorMessage : 'An error occurred',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/api/auth/login', { email, password }, { skipAuth: true }),

  signup: (data: { email: string; username: string; password: string }) =>
    api.post<{ token: string; user: User }>('/api/auth/signup', data, { skipAuth: true }),

  logout: () => api.post('/api/auth/logout'),

  me: () => api.get<{ user: User; token?: string }>('/api/auth/me'),

  refresh: () => api.post<{ token: string }>('/api/auth/refresh'),

  updateProfile: (data: { fullName?: string }) =>
    api.patch<{ user: User }>('/api/auth/me', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/api/auth/change-password', { currentPassword, newPassword }),

  getSessions: () =>
    api.get<{ sessions: Session[] }>('/api/auth/sessions'),

  revokeSession: (sessionId: string) =>
    api.delete<{ message: string }>(`/api/auth/sessions/${sessionId}`),

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }, { skipAuth: true }),

  resetPassword: (token: string, password: string) =>
    api.post('/api/auth/reset-password', { token, password }, { skipAuth: true }),
};

// Accounts API
export const accountsApi = {
  list: () => api.get<{ accounts: TradingAccount[] }>('/api/accounts'),

  get: (id: string) => api.get<{ account: TradingAccount }>(`/api/accounts/${id}`),

  create: (planId: string) =>
    api.post<{ account: TradingAccount }>('/api/accounts', { planId }),

  getStats: (id: string) =>
    api.get<{ stats: AccountStats }>(`/api/accounts/${id}/stats`),
};

// Plans API
export const plansApi = {
  list: () => api.get<{ plans: EvaluationPlan[] }>('/api/plans'),

  get: (id: string) => api.get<{ plan: EvaluationPlan }>(`/api/plans/${id}`),
};

// Orders API
export const ordersApi = {
  list: (params?: {
    accountId?: string;
    symbol?: string;
    side?: 'LONG' | 'SHORT';
    status?: 'pending' | 'validating' | 'executing' | 'filled' | 'rejected' | 'cancelled' | 'expired';
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.accountId) query.set('accountId', params.accountId);
    if (params?.symbol) query.set('symbol', params.symbol);
    if (params?.side) query.set('side', params.side);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('offset', ((params.page - 1) * (params.limit || 50)).toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return api.get<{ orders: Order[]; pagination: Pagination }>(`/api/orders?${query}`);
  },

  history: (params?: {
    accountId?: string;
    symbol?: string;
    side?: 'LONG' | 'SHORT';
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.accountId) query.set('accountId', params.accountId);
    if (params?.symbol) query.set('symbol', params.symbol);
    if (params?.side) query.set('side', params.side);
    if (params?.page) query.set('offset', ((params.page - 1) * (params.limit || 50)).toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return api.get<{ orders: Order[]; pagination: Pagination }>(`/api/orders/history?${query}`);
  },

  get: (orderId: string) =>
    api.get<{ order: Order }>(`/api/orders/${orderId}`),
};

// Trades API
export const tradesApi = {
  list: (params?: {
    accountId?: string;
    symbol?: string;
    side?: 'LONG' | 'SHORT';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.accountId) query.set('accountId', params.accountId);
    if (params?.symbol) query.set('symbol', params.symbol);
    if (params?.side) query.set('side', params.side);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return api.get<{ trades: Trade[]; total: number }>(`/api/trades?${query}`);
  },

  get: (tradeId: string) =>
    api.get<{ trade: Trade }>(`/api/trades/${tradeId}`),
};

// Trade Events API
export const tradeEventsApi = {
  list: (params?: {
    accountId?: string;
    positionId?: string;
    symbol?: string;
    side?: 'LONG' | 'SHORT';
    eventType?: string;
    eventTypes?: string[];
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.accountId) query.set('accountId', params.accountId);
    if (params?.positionId) query.set('positionId', params.positionId);
    if (params?.symbol) query.set('symbol', params.symbol);
    if (params?.side) query.set('side', params.side);
    if (params?.eventType) query.set('eventType', params.eventType);
    if (params?.eventTypes) query.set('eventTypes', params.eventTypes.join(','));
    if (params?.fromDate) query.set('fromDate', params.fromDate);
    if (params?.toDate) query.set('toDate', params.toDate);
    if (params?.page) query.set('offset', ((params.page - 1) * (params.limit || 50)).toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return api.get<{ events: TradeEvent[]; pagination: Pagination }>(`/api/trade-events?${query}`);
  },

  getByPosition: (positionId: string) =>
    api.get<{ events: TradeEvent[] }>(`/api/trade-events/position/${positionId}`),

  getTypes: () =>
    api.get<{ types: { value: string; label: string }[] }>('/api/trade-events/types'),
};

// Payouts API
export const payoutsApi = {
  list: () => api.get<{ payouts: Payout[] }>('/api/payouts'),

  get: (id: string) => api.get<{ payout: Payout }>(`/api/payouts/${id}`),

  getStats: () => api.get<{ stats: PayoutStats }>('/api/payouts/stats'),

  getAccounts: () => api.get<{ accounts: WithdrawableAccount[] }>('/api/payouts/accounts'),

  create: (data: CreatePayoutInput) =>
    api.post<{ payout: Payout; message: string }>('/api/payouts', data),

  cancel: (id: string) => api.delete<{ message: string }>(`/api/payouts/${id}`),
};

// Types
export interface User {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface TradingAccount {
  id: string;
  accountNumber: string;
  userId: string;
  planId: number;
  status: 'pending_payment' | 'active' | 'passed' | 'failed' | 'breached' | 'funded';
  accountType: 'evaluation' | 'funded';
  currentStep: number;
  startingBalance: string;
  currentBalance: string;
  peakBalance: string;
  availableMargin: string;
  totalMarginUsed: string;
  dailyStartingBalance: string;
  dailyPnl: string;
  dailyLossLimit: string;
  maxDrawdownLimit: string;
  profitTarget: string;
  currentProfit: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalVolume: string;
  tradingDays: number;
  maxLeverage: number;
  lastTradeAt?: string;
  breachType?: string;
  breachReason?: string;
  passedAt?: string;
  breachedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationPlan {
  id: string;
  name: string;
  accountSize: number;
  price: number;
  evaluationType: '1-step' | '2-step';
  profitTargetStep1: number;
  profitTargetStep2?: number;
  dailyLossLimit: number;
  maxDrawdown: number;
  minTradingDays: number;
  maxLeverage: number;
  profitSplit: number;
  isActive: boolean;
}

export interface Order {
  id: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  orderType: 'MARKET' | 'LIMIT';
  quantity: string;
  limitPrice?: string;
  takeProfit?: string;
  stopLoss?: string;
  status: 'pending' | 'validating' | 'executing' | 'filled' | 'rejected' | 'cancelled' | 'expired';
  filledAt?: string;
  filledPrice?: string;
  positionId?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  createdAt: string;
  expiresAt?: string;
  clientOrderId?: string;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  leverage: number;
  takeProfit?: string;
  stopLoss?: string;
  openedAt: string;
  closedAt: string;
  closeReason: string;
  grossPnl: string;
  fees: string;
  fundingFee: string;
  netPnl: string;
  holdDurationSeconds: number;
}

export interface TradeEvent {
  id: number;
  accountId: string;
  positionId?: string;
  tradeId?: string;
  orderId?: string;
  eventType: string;
  symbol?: string;
  side?: string;
  quantity?: string;
  price?: string;
  details: Record<string, unknown>;
  binancePrice?: string;
  priceTimestamp?: string;
  previousEventHash?: string;
  eventHash: string;
  createdAt: string;
}

export interface AccountStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  averageHoldTime: number;
}

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface Payout {
  id: string;
  accountId: string;
  accountNumber?: string;
  requestedAmount: number;
  platformFee: number;
  netAmount: number;
  payoutMethod: 'crypto_usdt' | 'crypto_btc' | 'crypto_eth' | 'bank_wire';
  destinationAddress: string;
  destinationNetwork?: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  txHash?: string;
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
  processedAt?: string;
  rejectedAt?: string;
}

export interface PayoutStats {
  totalPaidOut: number;
  pendingAmount: number;
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
}

export interface WithdrawableAccount {
  accountId: string;
  accountNumber: string;
  balance: number;
  startingBalance: number;
  profit: number;
  profitSplit: number;
  withdrawable: number;
  pendingAmount?: number;
  planType?: string;
  reason?: string;
}

export interface CreatePayoutInput {
  accountId: string;
  amount: number;
  payoutMethod: 'crypto_usdt' | 'crypto_btc' | 'crypto_eth' | 'bank_wire';
  destinationAddress: string;
  destinationNetwork?: string;
}

// ==========================================
// ADMIN API
// ==========================================

export interface AdminStats {
  users: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersThisMonth: number;
  };
  accounts: {
    totalAccounts: number;
    activeAccounts: number;
    fundedAccounts: number;
    breachedAccounts: number;
    pendingPayment: number;
  };
  payouts: {
    total: number;
    pending: number;
    completed: number;
    totalPaidOut: number;
    pendingAmount: number;
  };
  trading: {
    totalTrades: number;
    tradesToday: number;
    totalVolume: number;
    totalPnl: number;
  };
  charts: {
    accountStatusBreakdown: Record<string, number>;
    recentSignups: Array<{ date: string; count: number }>;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  status: 'active' | 'suspended' | 'banned';
  role: 'user' | 'admin' | 'support';
  kycStatus: string;
  createdAt: string;
  lastLoginAt?: string;
  tradingAccounts?: TradingAccount[];
}

export interface AdminAccount {
  id: string;
  accountNumber: string;
  accountType: 'evaluation' | 'funded';
  status: string;
  currentStep: number;
  startingBalance: string;
  currentBalance: string;
  dailyPnl: string;
  currentProfit: string;
  totalTrades: number;
  tradingDays: number;
  createdAt: string;
  breachType?: string;
  breachedAt?: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

export interface AdminPayout {
  id: string;
  userId: string;
  accountId: string;
  requestedAmount: string;
  platformFee: string;
  netAmount: string;
  payoutMethod: string;
  destinationAddress: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  processedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
  account: {
    id: string;
    accountNumber: string;
    accountType: string;
  };
}

export interface PaginatedResponse<T> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  [key: string]: T[] | { total: number; limit: number; offset: number; hasMore: boolean };
}

// Admin API
export const adminApi = {
  // Stats
  getStats: () => api.get<AdminStats>('/api/admin/stats'),

  // Users
  listUsers: (params?: {
    search?: string;
    status?: 'active' | 'suspended' | 'banned';
    role?: 'user' | 'admin' | 'support';
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.role) query.set('role', params.role);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    return api.get<{ users: AdminUser[]; pagination: PaginatedResponse<AdminUser>['pagination'] }>(
      `/api/admin/users?${query}`
    );
  },

  getUser: (id: string) => api.get<{ user: AdminUser }>(`/api/admin/users/${id}`),

  updateUser: (id: string, data: { status?: string; role?: string }) =>
    api.patch<{ user: AdminUser; message: string }>(`/api/admin/users/${id}`, data),

  suspendUser: (id: string) =>
    api.post<{ user: AdminUser; message: string }>(`/api/admin/users/${id}/suspend`),

  activateUser: (id: string) =>
    api.post<{ user: AdminUser; message: string }>(`/api/admin/users/${id}/activate`),

  // Accounts
  listAccounts: (params?: {
    status?: string;
    accountType?: 'evaluation' | 'funded';
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.accountType) query.set('accountType', params.accountType);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    return api.get<{
      accounts: AdminAccount[];
      statusCounts: Record<string, number>;
      pagination: PaginatedResponse<AdminAccount>['pagination'];
    }>(`/api/admin/accounts?${query}`);
  },

  getAccount: (id: string) => api.get<{ account: AdminAccount }>(`/api/admin/accounts/${id}`),

  breachAccount: (id: string, data: { breachType: string; reason: string }) =>
    api.post<{ account: AdminAccount; message: string }>(`/api/admin/accounts/${id}/breach`, data),

  activateAccount: (id: string) =>
    api.post<{ account: AdminAccount; message: string }>(`/api/admin/accounts/${id}/activate`),

  suspendAccount: (id: string) =>
    api.post<{ account: AdminAccount; message: string }>(`/api/admin/accounts/${id}/suspend`),

  unsuspendAccount: (id: string) =>
    api.post<{ account: AdminAccount; message: string }>(`/api/admin/accounts/${id}/unsuspend`),

  // Payouts
  listPayouts: (params?: {
    status?: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    return api.get<{
      payouts: AdminPayout[];
      pendingCount: number;
      pagination: PaginatedResponse<AdminPayout>['pagination'];
    }>(`/api/admin/payouts?${query}`);
  },

  getPayout: (id: string) => api.get<{ payout: AdminPayout }>(`/api/admin/payouts/${id}`),

  approvePayout: (id: string) =>
    api.post<{ payout: AdminPayout; message: string }>(`/api/admin/payouts/${id}/approve`),

  rejectPayout: (id: string, reason: string) =>
    api.post<{ payout: AdminPayout; message: string }>(`/api/admin/payouts/${id}/reject`, { reason }),

  processPayout: (id: string) =>
    api.post<{ payout: AdminPayout; message: string }>(`/api/admin/payouts/${id}/process`),

  completePayout: (id: string, txHash?: string) =>
    api.post<{ payout: AdminPayout; message: string }>(`/api/admin/payouts/${id}/complete`, { txHash }),
};

