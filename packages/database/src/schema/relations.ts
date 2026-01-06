// ===========================================
// DATABASE RELATIONS
// ===========================================

import { relations } from 'drizzle-orm';
import { users } from './users';
import { sessions } from './sessions';
import { tradingAccounts } from './trading-accounts';
import { positions } from './positions';
import { trades } from './trades';
import { orders } from './orders';
import { tradeEvents } from './trade-events';
import { payments } from './payments';
import { payouts } from './payouts';
import { evaluationPlans } from './evaluation-plans';
import { dailySnapshots } from './daily-snapshots';

// ===========================================
// USER RELATIONS
// ===========================================
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  tradingAccounts: many(tradingAccounts),
  payments: many(payments),
  payouts: many(payouts),
}));

// ===========================================
// SESSION RELATIONS
// ===========================================
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ===========================================
// TRADING ACCOUNT RELATIONS
// ===========================================
export const tradingAccountsRelations = relations(tradingAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [tradingAccounts.userId],
    references: [users.id],
  }),
  plan: one(evaluationPlans, {
    fields: [tradingAccounts.planId],
    references: [evaluationPlans.id],
  }),
  parentAccount: one(tradingAccounts, {
    fields: [tradingAccounts.parentAccountId],
    references: [tradingAccounts.id],
    relationName: 'parentChild',
  }),
  childAccounts: many(tradingAccounts, {
    relationName: 'parentChild',
  }),
  positions: many(positions),
  trades: many(trades),
  orders: many(orders),
  tradeEvents: many(tradeEvents),
  dailySnapshots: many(dailySnapshots),
}));

// ===========================================
// EVALUATION PLAN RELATIONS
// ===========================================
export const evaluationPlansRelations = relations(evaluationPlans, ({ many }) => ({
  tradingAccounts: many(tradingAccounts),
}));

// ===========================================
// POSITION RELATIONS
// ===========================================
export const positionsRelations = relations(positions, ({ one }) => ({
  account: one(tradingAccounts, {
    fields: [positions.accountId],
    references: [tradingAccounts.id],
  }),
}));

// ===========================================
// TRADE RELATIONS
// ===========================================
export const tradesRelations = relations(trades, ({ one }) => ({
  account: one(tradingAccounts, {
    fields: [trades.accountId],
    references: [tradingAccounts.id],
  }),
}));

// ===========================================
// ORDER RELATIONS
// ===========================================
export const ordersRelations = relations(orders, ({ one }) => ({
  account: one(tradingAccounts, {
    fields: [orders.accountId],
    references: [tradingAccounts.id],
  }),
  position: one(positions, {
    fields: [orders.positionId],
    references: [positions.id],
  }),
}));

// ===========================================
// TRADE EVENT RELATIONS
// ===========================================
export const tradeEventsRelations = relations(tradeEvents, ({ one }) => ({
  account: one(tradingAccounts, {
    fields: [tradeEvents.accountId],
    references: [tradingAccounts.id],
  }),
}));

// ===========================================
// PAYMENT RELATIONS
// ===========================================
export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  account: one(tradingAccounts, {
    fields: [payments.accountId],
    references: [tradingAccounts.id],
  }),
}));

// ===========================================
// PAYOUT RELATIONS
// ===========================================
export const payoutsRelations = relations(payouts, ({ one }) => ({
  user: one(users, {
    fields: [payouts.userId],
    references: [users.id],
  }),
  account: one(tradingAccounts, {
    fields: [payouts.accountId],
    references: [tradingAccounts.id],
  }),
  approvedByUser: one(users, {
    fields: [payouts.approvedBy],
    references: [users.id],
    relationName: 'approvedBy',
  }),
  rejectedByUser: one(users, {
    fields: [payouts.rejectedBy],
    references: [users.id],
    relationName: 'rejectedBy',
  }),
}));

// ===========================================
// DAILY SNAPSHOT RELATIONS
// ===========================================
export const dailySnapshotsRelations = relations(dailySnapshots, ({ one }) => ({
  account: one(tradingAccounts, {
    fields: [dailySnapshots.accountId],
    references: [tradingAccounts.id],
  }),
}));

