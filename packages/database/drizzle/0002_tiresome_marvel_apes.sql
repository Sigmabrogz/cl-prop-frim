ALTER TABLE "evaluation_plans" DROP CONSTRAINT "valid_account_tier";--> statement-breakpoint
ALTER TABLE "trade_events" DROP CONSTRAINT "valid_event_type";--> statement-breakpoint
ALTER TABLE "evaluation_plans" ADD CONSTRAINT "valid_account_tier" CHECK ("evaluation_plans"."account_tier" IN ('CLASSIC', 'TURBO', 'ELITE', 'PRO'));--> statement-breakpoint
ALTER TABLE "trade_events" ADD CONSTRAINT "valid_event_type" CHECK ("trade_events"."event_type" IN (
        'ORDER_PLACED', 'ORDER_VALIDATED', 'ORDER_REJECTED', 'ORDER_FILLED',
        'POSITION_OPENED', 'POSITION_MODIFIED', 'POSITION_CLOSED',
        'TP_SET', 'TP_MODIFIED', 'TP_TRIGGERED',
        'SL_SET', 'SL_MODIFIED', 'SL_TRIGGERED',
        'LIQUIDATION_WARNING', 'LIQUIDATION_TRIGGERED',
        'DAILY_LOSS_WARNING', 'DAILY_LOSS_BREACH',
        'DRAWDOWN_WARNING', 'DRAWDOWN_BREACH',
        'BALANCE_UPDATE', 'MARGIN_UPDATE',
        'DAILY_RESET', 'STEP1_PASSED', 'EVALUATION_PASSED',
        'FUNDING_APPLIED'
      ));