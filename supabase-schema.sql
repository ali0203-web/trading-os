-- DFM Trading Bot Database Schema
-- Layer 3: Data Persistence (Supabase PostgreSQL)
-- Created: Sept 28, 2026

-- Table 1: Trades (Complete trade history)
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  entry_price DECIMAL(10,4) NOT NULL,
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_price DECIMAL(10,4),
  exit_time TIMESTAMP WITH TIME ZONE,
  confidence_score DECIMAL(5,2) NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('RSI_OVERSOLD', 'MACD_CROSSOVER', 'VOLUME_SURGE', 'MEAN_REVERSION')),
  quantity DECIMAL(10,2) NOT NULL,
  pnl DECIMAL(10,4),
  pnl_percent DECIMAL(6,2),
  exit_reason TEXT CHECK (exit_reason IN ('STOP_LOSS', 'TAKE_PROFIT', 'TIME_STOP', 'MANUAL')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_created ON trades(created_at);

-- Table 2: Positions (Currently open positions only)
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  entry_price DECIMAL(10,4) NOT NULL,
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL,
  signal_type TEXT NOT NULL,
  stop_loss DECIMAL(10,4) NOT NULL,
  take_profit DECIMAL(10,4) NOT NULL,
  unrealized_pnl DECIMAL(10,4),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_status ON positions(status);

-- Table 3: Daily Performance
CREATE TABLE IF NOT EXISTS daily_performance (
  date DATE PRIMARY KEY,
  trades_executed INTEGER DEFAULT 0,
  trades_won INTEGER DEFAULT 0,
  trades_lost INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  total_pnl DECIMAL(10,4),
  daily_pnl DECIMAL(10,4),
  max_drawdown DECIMAL(10,4),
  ending_balance DECIMAL(10,4),
  average_confidence DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 4: Weekly Performance
CREATE TABLE IF NOT EXISTS weekly_performance (
  week_start DATE PRIMARY KEY,
  trades_executed INTEGER DEFAULT 0,
  trades_won INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  total_pnl DECIMAL(10,4),
  max_drawdown DECIMAL(10,4),
  profit_factor DECIMAL(6,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 5: Signal Accuracy Tracking
CREATE TABLE IF NOT EXISTS signal_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type TEXT NOT NULL,
  confidence_bucket TEXT NOT NULL CHECK (confidence_bucket IN ('HIGH', 'MEDIUM', 'LOW')),
  win_rate DECIMAL(5,2),
  sample_size INTEGER DEFAULT 0,
  average_pnl DECIMAL(10,4),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 6: Risk Tracking
CREATE TABLE IF NOT EXISTS risk_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_date DATE NOT NULL,
  daily_loss DECIMAL(10,4),
  daily_limit DECIMAL(10,4),
  daily_limit_breached BOOLEAN DEFAULT FALSE,
  weekly_loss DECIMAL(10,4),
  weekly_limit DECIMAL(10,4),
  weekly_limit_breached BOOLEAN DEFAULT FALSE,
  trades_executed INTEGER DEFAULT 0,
  max_trades_daily INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_risk_tracking_date ON risk_tracking(tracking_date);

-- Enable Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public access for demo)
CREATE POLICY "Enable read access for all users" ON trades FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON trades FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON trades FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON positions FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON positions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON positions FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON daily_performance FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON daily_performance FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON daily_performance FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON weekly_performance FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON weekly_performance FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON signal_accuracy FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON signal_accuracy FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON risk_tracking FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON risk_tracking FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_trades_entry_time ON trades(entry_time DESC);
CREATE INDEX idx_positions_entry_time ON positions(entry_time DESC);
