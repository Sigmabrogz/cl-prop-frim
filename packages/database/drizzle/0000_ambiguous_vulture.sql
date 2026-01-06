CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"account_id" uuid,
	"action" text NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"starting_balance" numeric(18, 8) NOT NULL,
	"ending_balance" numeric(18, 8) NOT NULL,
	"peak_balance" numeric(18, 8) NOT NULL,
	"daily_pnl" numeric(18, 8) NOT NULL,
	"daily_pnl_pct" numeric(8, 4) NOT NULL,
	"max_daily_drawdown" numeric(18, 8) NOT NULL,
	"max_total_drawdown" numeric(18, 8) NOT NULL,
	"trades_count" integer NOT NULL,
	"winning_trades" integer NOT NULL,
	"losing_trades" integer NOT NULL,
	"volume" numeric(18, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_snapshot" UNIQUE("account_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "evaluation_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"evaluation_type" varchar(20) NOT NULL,
	"account_tier" varchar(20) DEFAULT 'CLASSIC' NOT NULL,
	"account_size" numeric(18, 2) NOT NULL,
	"evaluation_fee" numeric(18, 2) NOT NULL,
	"step1_profit_target_pct" numeric(5, 2) NOT NULL,
	"step2_profit_target_pct" numeric(5, 2),
	"daily_loss_limit_pct" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"max_drawdown_pct" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"trailing_drawdown" boolean DEFAULT false NOT NULL,
	"min_trading_days" integer DEFAULT 5 NOT NULL,
	"max_daily_trades" integer,
	"min_trade_duration_seconds" integer DEFAULT 120 NOT NULL,
	"btc_eth_max_leverage" integer DEFAULT 10 NOT NULL,
	"altcoin_max_leverage" integer DEFAULT 5 NOT NULL,
	"profit_split_pct" integer DEFAULT 80 NOT NULL,
	"max_profit_from_single_trade_pct" numeric(5, 2) DEFAULT '50.00',
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_plans_slug_unique" UNIQUE("slug"),
	CONSTRAINT "valid_evaluation_type" CHECK ("evaluation_plans"."evaluation_type" IN ('1-STEP', '2-STEP')),
	CONSTRAINT "valid_account_tier" CHECK ("evaluation_plans"."account_tier" IN ('CLASSIC', 'ELITE', 'PRO')),
	CONSTRAINT "positive_account_size" CHECK ("evaluation_plans"."account_size" > 0),
	CONSTRAINT "positive_evaluation_fee" CHECK ("evaluation_plans"."evaluation_fee" > 0),
	CONSTRAINT "valid_profit_split" CHECK ("evaluation_plans"."profit_split_pct" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"email_verified_at" timestamp with time zone,
	"phone" varchar(20),
	"phone_verified_at" timestamp with time zone,
	"password_hash" varchar(255),
	"two_fa_secret" varchar(255),
	"two_fa_enabled" boolean DEFAULT false NOT NULL,
	"username" varchar(50) NOT NULL,
	"full_name" varchar(255),
	"country_code" varchar(2),
	"kyc_status" varchar(20) DEFAULT 'none' NOT NULL,
	"kyc_submitted_at" timestamp with time zone,
	"kyc_approved_at" timestamp with time zone,
	"kyc_documents" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"last_login_ip" "inet",
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "valid_email" CHECK ("users"."email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+.[A-Za-z]{2,}$'),
	CONSTRAINT "valid_kyc_status" CHECK ("users"."kyc_status" IN ('none', 'pending', 'approved', 'rejected')),
	CONSTRAINT "valid_status" CHECK ("users"."status" IN ('active', 'suspended', 'banned')),
	CONSTRAINT "valid_role" CHECK ("users"."role" IN ('user', 'admin', 'support'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"user_agent" text,
	"ip_address" "inet",
	"device_fingerprint" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" varchar(100),
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "trading_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" integer,
	"account_type" varchar(20) NOT NULL,
	"account_number" varchar(20) NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"parent_account_id" uuid,
	"starting_balance" numeric(18, 8) NOT NULL,
	"current_balance" numeric(18, 8) NOT NULL,
	"peak_balance" numeric(18, 8) NOT NULL,
	"total_margin_used" numeric(18, 8) DEFAULT '0' NOT NULL,
	"available_margin" numeric(18, 8) NOT NULL,
	"daily_starting_balance" numeric(18, 8) NOT NULL,
	"daily_pnl" numeric(18, 8) DEFAULT '0' NOT NULL,
	"daily_reset_at" timestamp with time zone NOT NULL,
	"daily_loss_limit" numeric(18, 8) NOT NULL,
	"max_drawdown_limit" numeric(18, 8) NOT NULL,
	"profit_target" numeric(18, 8) NOT NULL,
	"current_profit" numeric(18, 8) DEFAULT '0' NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"winning_trades" integer DEFAULT 0 NOT NULL,
	"losing_trades" integer DEFAULT 0 NOT NULL,
	"total_volume" numeric(18, 8) DEFAULT '0' NOT NULL,
	"trading_days" integer DEFAULT 0 NOT NULL,
	"last_trade_at" timestamp with time zone,
	"status" varchar(30) DEFAULT 'pending_payment' NOT NULL,
	"breach_type" varchar(50),
	"breach_reason" text,
	"breached_at" timestamp with time zone,
	"step1_passed_at" timestamp with time zone,
	"passed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "trading_accounts_account_number_unique" UNIQUE("account_number"),
	CONSTRAINT "valid_account_type" CHECK ("trading_accounts"."account_type" IN ('evaluation', 'funded')),
	CONSTRAINT "valid_account_status" CHECK ("trading_accounts"."status" IN ('pending_payment', 'active', 'step1_passed', 'passed', 'breached', 'expired', 'suspended')),
	CONSTRAINT "valid_balance" CHECK ("trading_accounts"."current_balance"::numeric >= 0),
	CONSTRAINT "valid_margin" CHECK ("trading_accounts"."available_margin"::numeric >= 0)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"quantity" numeric(18, 8) NOT NULL,
	"leverage" integer NOT NULL,
	"entry_price" numeric(18, 8) NOT NULL,
	"entry_value" numeric(18, 8) NOT NULL,
	"margin_used" numeric(18, 8) NOT NULL,
	"entry_fee" numeric(18, 8) NOT NULL,
	"take_profit" numeric(18, 8),
	"stop_loss" numeric(18, 8),
	"liquidation_price" numeric(18, 8) NOT NULL,
	"current_price" numeric(18, 8),
	"unrealized_pnl" numeric(18, 8) DEFAULT '0' NOT NULL,
	"last_price_update" timestamp with time zone,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"binance_price_at_entry" numeric(18, 8) NOT NULL,
	"price_source" varchar(50) DEFAULT 'binance' NOT NULL,
	CONSTRAINT "valid_side" CHECK ("positions"."side" IN ('LONG', 'SHORT')),
	CONSTRAINT "valid_quantity" CHECK ("positions"."quantity"::numeric > 0),
	CONSTRAINT "valid_leverage" CHECK ("positions"."leverage" >= 1)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"position_id" uuid,
	"symbol" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"quantity" numeric(18, 8) NOT NULL,
	"leverage" integer NOT NULL,
	"entry_price" numeric(18, 8) NOT NULL,
	"entry_value" numeric(18, 8) NOT NULL,
	"margin_used" numeric(18, 8) NOT NULL,
	"entry_fee" numeric(18, 8) NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"exit_price" numeric(18, 8) NOT NULL,
	"exit_value" numeric(18, 8) NOT NULL,
	"exit_fee" numeric(18, 8) NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"close_reason" varchar(50) NOT NULL,
	"gross_pnl" numeric(18, 8) NOT NULL,
	"total_fees" numeric(18, 8) NOT NULL,
	"net_pnl" numeric(18, 8) NOT NULL,
	"duration_seconds" integer NOT NULL,
	"binance_price_at_entry" numeric(18, 8) NOT NULL,
	"binance_price_at_exit" numeric(18, 8) NOT NULL,
	"take_profit_was" numeric(18, 8),
	"stop_loss_was" numeric(18, 8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_trade_side" CHECK ("trades"."side" IN ('LONG', 'SHORT')),
	CONSTRAINT "valid_close_reason" CHECK ("trades"."close_reason" IN ('MANUAL', 'TAKE_PROFIT', 'STOP_LOSS', 'LIQUIDATION', 'BREACH'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"order_type" varchar(20) NOT NULL,
	"quantity" numeric(18, 8) NOT NULL,
	"limit_price" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"stop_loss" numeric(18, 8),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"filled_at" timestamp with time zone,
	"filled_price" numeric(18, 8),
	"position_id" uuid,
	"rejection_reason" text,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"client_order_id" varchar(100),
	CONSTRAINT "unique_client_order" UNIQUE("account_id","client_order_id"),
	CONSTRAINT "valid_order_side" CHECK ("orders"."side" IN ('LONG', 'SHORT')),
	CONSTRAINT "valid_order_type" CHECK ("orders"."order_type" IN ('MARKET', 'LIMIT')),
	CONSTRAINT "valid_order_status" CHECK ("orders"."status" IN ('pending', 'validating', 'executing', 'filled', 'rejected', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "trade_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"position_id" uuid,
	"trade_id" uuid,
	"order_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"symbol" varchar(20),
	"side" varchar(10),
	"quantity" numeric(18, 8),
	"price" numeric(18, 8),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"binance_price" numeric(18, 8),
	"price_timestamp" timestamp with time zone,
	"previous_event_hash" varchar(64),
	"event_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "no_future_events" CHECK ("trade_events"."created_at" <= NOW()),
	CONSTRAINT "valid_event_type" CHECK ("trade_events"."event_type" IN (
        'ORDER_PLACED', 'ORDER_VALIDATED', 'ORDER_REJECTED', 'ORDER_FILLED',
        'POSITION_OPENED', 'POSITION_MODIFIED', 'POSITION_CLOSED',
        'TP_SET', 'TP_MODIFIED', 'TP_TRIGGERED',
        'SL_SET', 'SL_MODIFIED', 'SL_TRIGGERED',
        'LIQUIDATION_WARNING', 'LIQUIDATION_TRIGGERED',
        'DAILY_LOSS_WARNING', 'DAILY_LOSS_BREACH',
        'DRAWDOWN_WARNING', 'DRAWDOWN_BREACH',
        'BALANCE_UPDATE', 'MARGIN_UPDATE'
      ))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"payment_type" varchar(20) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payment_id" varchar(255),
	"provider_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refund_reason" text,
	CONSTRAINT "valid_payment_type" CHECK ("payments"."payment_type" IN ('evaluation_fee', 'addon', 'reset')),
	CONSTRAINT "valid_payment_provider" CHECK ("payments"."provider" IN ('stripe', 'coinbase', 'crypto_manual')),
	CONSTRAINT "valid_payment_status" CHECK ("payments"."status" IN ('pending', 'processing', 'completed', 'failed', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"requested_amount" numeric(18, 8) NOT NULL,
	"platform_fee" numeric(18, 8) NOT NULL,
	"net_amount" numeric(18, 8) NOT NULL,
	"payout_method" varchar(50) NOT NULL,
	"destination_address" varchar(255) NOT NULL,
	"destination_network" varchar(50),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"tx_hash" varchar(255),
	"rejected_by" uuid,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_payout_method" CHECK ("payouts"."payout_method" IN ('crypto_btc', 'crypto_usdt', 'crypto_eth', 'bank_wire')),
	CONSTRAINT "valid_payout_status" CHECK ("payouts"."status" IN ('pending', 'approved', 'processing', 'completed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "market_pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"base_currency" varchar(10) NOT NULL,
	"quote_currency" varchar(10) NOT NULL,
	"display_name" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"spread_bps" integer DEFAULT 5 NOT NULL,
	"max_leverage" integer DEFAULT 10 NOT NULL,
	"min_quantity" numeric(18, 8) NOT NULL,
	"max_quantity" numeric(18, 8),
	"quantity_precision" integer DEFAULT 8 NOT NULL,
	"price_precision" integer DEFAULT 2 NOT NULL,
	"category" varchar(20) DEFAULT 'major' NOT NULL,
	"volatility_tier" varchar(20) DEFAULT 'normal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_pairs_symbol_unique" UNIQUE("symbol"),
	CONSTRAINT "valid_category" CHECK ("market_pairs"."category" IN ('major', 'altcoin', 'defi', 'meme')),
	CONSTRAINT "valid_volatility" CHECK ("market_pairs"."volatility_tier" IN ('low', 'normal', 'high', 'extreme')),
	CONSTRAINT "positive_spread" CHECK ("market_pairs"."spread_bps" >= 0),
	CONSTRAINT "positive_leverage" CHECK ("market_pairs"."max_leverage" >= 1)
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"bid_price" numeric(18, 8) NOT NULL,
	"ask_price" numeric(18, 8) NOT NULL,
	"mid_price" numeric(18, 8) NOT NULL,
	"volume_24h" numeric(18, 8),
	"source" varchar(50) DEFAULT 'binance' NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_plan_id_evaluation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."evaluation_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_account_id" ON "audit_logs" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_action" ON "audit_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "idx_snapshots_account_date" ON "daily_snapshots" USING btree ("account_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_plans_active" ON "evaluation_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_plans_type" ON "evaluation_plans" USING btree ("evaluation_type");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "trading_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_status" ON "trading_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_accounts_type" ON "trading_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "idx_accounts_number" ON "trading_accounts" USING btree ("account_number");--> statement-breakpoint
CREATE INDEX "idx_positions_account" ON "positions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_positions_symbol" ON "positions" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_positions_side" ON "positions" USING btree ("side");--> statement-breakpoint
CREATE INDEX "idx_trades_account" ON "trades" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_trades_closed_at" ON "trades" USING btree ("closed_at");--> statement-breakpoint
CREATE INDEX "idx_trades_symbol" ON "trades" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_trades_position" ON "trades" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_orders_account" ON "orders" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_client" ON "orders" USING btree ("client_order_id");--> statement-breakpoint
CREATE INDEX "idx_events_account" ON "trade_events" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_events_position" ON "trade_events" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_events_type" ON "trade_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_events_created" ON "trade_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_user" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_provider" ON "payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_user" ON "payouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_status" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payouts_account" ON "payouts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_pairs_symbol" ON "market_pairs" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_pairs_enabled" ON "market_pairs" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_pairs_category" ON "market_pairs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_prices_symbol_time" ON "price_snapshots" USING btree ("symbol","timestamp");--> statement-breakpoint
CREATE INDEX "idx_prices_created" ON "price_snapshots" USING btree ("created_at");