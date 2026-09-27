-- PostgreSQL Schema for Trading Agent System
-- Deploy to Railway PostgreSQL database

-- 1. ORDERS TABLE - All pending and placed orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL, -- BUY or SELL
  quantity DECIMAL(18, 8) NOT NULL,
  price DECIMAL(18, 8),
  order_type VARCHAR(20) NOT NULL, -- MARKET, LIMIT, STOP_LOSS, etc.
  status VARCHAR(20) NOT NULL, -- PENDING, PLACED, FILLED, CANCELLED, FAILED
  broker VARCHAR(50) NOT NULL, -- BINANCE, IB, CUSTOM
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  retry_count INT DEFAULT 0,
  error_message TEXT

);

-- 2. POSITIONS TABLE - Current holdings across all brokers
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  broker VARCHAR(50) NOT NULL,
  quantity DECIMAL(18, 8) NOT NULL,
  average_cost DECIMAL(18, 8),
  current_price DECIMAL(18, 8),
  unrealized_pnl DECIMAL(18, 8),
  realized_pnl DECIMAL(18, 8),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, broker)

);

-- 3. REBALANCING_RULES TABLE - Target allocations and thresholds
CREATE TABLE IF NOT EXISTS rebalancing_rules (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  target_allocation DECIMAL(5, 2) NOT NULL, -- % of portfolio
  min_allocation DECIMAL(5, 2) NOT NULL,
  max_allocation DECIMAL(5, 2) NOT NULL,
  rebalance_threshold DECIMAL(5, 2) NOT NULL, -- % drift trigger
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- 4. EXECUTIONS TABLE - Trade history and confirmations
CREATE TABLE IF NOT EXISTS executions (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  quantity DECIMAL(18, 8) NOT NULL,
  executed_price DECIMAL(18, 8) NOT NULL,
  executed_at TIMESTAMP NOT NULL,
  commission DECIMAL(18, 8),
  broker VARCHAR(50) NOT NULL,
  execution_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- 5. PORTFOLIO_SNAPSHOTS TABLE - Daily portfolio state
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  total_value DECIMAL(18, 8) NOT NULL,
  cash_balance DECIMAL(18, 8),
  total_positions_value DECIMAL(18, 8),
  daily_pnl DECIMAL(18, 8),
  cumulative_pnl DECIMAL(18, 8),
  return_percentage DECIMAL(8, 4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. ERROR_LOG TABLE - Failed orders and recovery attempts
CREATE TABLE IF NOT EXISTS error_log (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255),
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  broker VARCHAR(50),
  recovery_attempted BOOLEAN DEFAULT FALSE,
  recovery_status VARCHAR(50),
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- 7. JOB_QUEUE TABLE - Order routing and job management
CREATE TABLE IF NOT EXISTS job_queue (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  job_type VARCHAR(100) NOT NULL, -- EXECUTE_ORDER, REBALANCE, MARKET_DATA, etc.
  status VARCHAR(50) NOT NULL, -- PENDING, PROCESSING, COMPLETED, FAILED
  payload JSONB NOT NULL,
  priority INT DEFAULT 0,
  scheduled_for TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- 8. JOB_DLQ TABLE - Dead-letter queue for failed jobs
CREATE TABLE IF NOT EXISTS job_dlq (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 5,
  last_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- 9. AGENT_HEALTH TABLE - Monitor agent status and uptime
CREATE TABLE IF NOT EXISTS agent_health (
  id SERIAL PRIMARY KEY,
  agent_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL, -- HEALTHY, DEGRADED, OFFLINE
  last_heartbeat TIMESTAMP NOT NULL,
  processed_jobs INT DEFAULT 0,
  failed_jobs INT DEFAULT 0,
  avg_latency_ms DECIMAL(10, 2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- 10. MARKET_DATA TABLE - Real-time price feeds
CREATE TABLE IF NOT EXISTS market_data (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  broker VARCHAR(50) NOT NULL,
  price DECIMAL(18, 8) NOT NULL,
  bid DECIMAL(18, 8),
  ask DECIMAL(18, 8),
  volume DECIMAL(18, 2),
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_value ON positions(symbol, quantity);
CREATE INDEX IF NOT EXISTS idx_executions_date_range ON executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_queue_pending ON job_queue(status, scheduled_for) WHERE status IN ('PENDING', 'PROCESSING');

-- PostgreSQL Indexes
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_broker ON orders(broker);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_broker ON positions(broker);
CREATE INDEX IF NOT EXISTS idx_executions_symbol ON executions(symbol);
CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions(created_at);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_created_at ON job_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_health_agent_name ON agent_health(agent_name);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_created_at ON portfolio_snapshots(created_at);
