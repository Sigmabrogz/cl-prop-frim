-- ===========================================
-- PROPFIRM PLATFORM - DATABASE INITIALIZATION
-- ===========================================
-- This script runs automatically when PostgreSQL container starts
-- for the first time. It sets up extensions and initial configuration.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone to UTC (critical for trading)
SET timezone = 'UTC';

-- Grant privileges (if needed for migrations)
GRANT ALL PRIVILEGES ON DATABASE propfirm TO propfirm;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'PropFirm database initialized at %', NOW();
END $$;

