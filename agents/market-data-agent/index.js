// AGENT 2: Market Data Ingestion Agent
// Streams live prices from Binance WebSocket and stores in PostgreSQL
// Updates market_data table in real-time for all configured symbols

const db = require('../lib/database');
const BinanceClient = require('../lib/brokers/binance');
require('dotenv').config();

const MARKET_DATA_INTERVAL = parseInt(process.env.MARKET_DATA_INTERVAL) || 10000;
const TRADING_MODE = process.env.TRADING_MODE || 'TESTNET';
const USE_TESTNET = TRADING_MODE === 'TESTNET';

let binance = null;
let isRunning = false;
let monitoredSymbols = [];
let lastPriceUpdate = {};

// Initialize broker
async function initializeBroker() {
  try {
    binance = new BinanceClient(USE_TESTNET);
    console.log(`✅ Binance WebSocket initialized (${USE_TESTNET ? 'TESTNET' : 'PRODUCTION'})`);
  } catch (error) {
    console.error('❌ Failed to initialize broker:', error.message);
    throw error;
  }
}

// Get symbols from rebalancing rules
async function getMonitoredSymbols() {
  try {
    const rules = await db.getRows(
      `SELECT DISTINCT symbol FROM rebalancing_rules WHERE enabled = true ORDER BY symbol`
    );

    monitoredSymbols = rules.map(r => r.symbol);
    console.log(`📊 Monitoring ${monitoredSymbols.length} symbols: ${monitoredSymbols.join(', ')}`);
    return monitoredSymbols;
  } catch (error) {
    console.error('❌ Failed to get monitored symbols:', error.message);
    return [];
  }
}

// Handle price update from WebSocket
async function handlePriceUpdate(tickerData) {
  try {
    const symbol = tickerData.s;
    const price = parseFloat(tickerData.c);
    const bid = parseFloat(tickerData.b);
    const ask = parseFloat(tickerData.a);
    const volume = parseFloat(tickerData.v);

    // Only update once per 10s to avoid database thrashing
    const lastUpdate = lastPriceUpdate[symbol] || 0;
    if (Date.now() - lastUpdate < MARKET_DATA_INTERVAL / 2) {
      return;
    }

    lastPriceUpdate[symbol] = Date.now();

    // Store in database
    await db.query(
      `INSERT INTO market_data (symbol, broker, price, bid, ask, volume, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [symbol, 'BINANCE', price, bid, ask, volume]
    );

    // Update current price in positions table
    await db.query(
      `UPDATE positions SET current_price = $1, last_updated = NOW()
       WHERE symbol = $2 AND broker = 'BINANCE'`,
      [price, symbol]
    );

  } catch (error) {
    console.error(`❌ Price update failed for ${tickerData.s}:`, error.message);
  }
}

// Periodically cleanup old market data
async function cleanupOldData() {
  try {
    // Keep only last 7 days of market data
    await db.query(
      `DELETE FROM market_data WHERE timestamp < NOW() - INTERVAL '7 days'`
    );

    // Vacuum table monthly
    const lastVacuum = await db.getRow(
      `SELECT MAX(timestamp) as last_vacuum FROM market_data`
    );

    console.log('🧹 Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Health check
async function recordHealth() {
  try {
    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat, processed_jobs)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (agent_name) DO UPDATE SET
         status = $2,
         last_heartbeat = NOW(),
         processed_jobs = agent_health.processed_jobs + 1`,
      ['market-data-agent', 'HEALTHY', monitoredSymbols.length]
    );
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  console.log('🚀 Market Data Agent started');

  try {
    await initializeBroker();
    const symbols = await getMonitoredSymbols();

    if (symbols.length === 0) {
      console.warn('⚠️  No symbols to monitor, waiting for rebalancing rules...');
      return;
    }

    // Subscribe to price updates
    binance.subscribeToPrices(symbols, handlePriceUpdate);

    // Periodic tasks
    const healthInterval = setInterval(recordHealth, 60000); // Every minute
    const cleanupInterval = setInterval(cleanupOldData, 86400000); // Every 24 hours

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 Shutting down Market Data Agent...');
      isRunning = false;
      clearInterval(healthInterval);
      clearInterval(cleanupInterval);
      if (binance) binance.closeWebSocket();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start agent:', error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { start, handlePriceUpdate };
