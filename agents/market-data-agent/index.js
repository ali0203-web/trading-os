// AGENT 2: Market Data Ingestion Agent
// Streams live prices from Binance WebSocket and stores in PostgreSQL
// Updates market_data table in real-time for all configured symbols
// Features: Real-time WebSocket, historical aggregation, signal detection, multi-broker support

const path = require('path');
const axios = require('axios');
const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
const BinanceClient = require(path.join(__dirname, '..', '..', 'lib', 'brokers', 'binance'));
require('dotenv').config();

const MARKET_DATA_INTERVAL = parseInt(process.env.MARKET_DATA_INTERVAL) || 10000;
const TRADING_MODE = process.env.TRADING_MODE || 'TESTNET';
const USE_TESTNET = TRADING_MODE === 'TESTNET';
const PRICE_UPDATE_THRESHOLD = parseFloat(process.env.PRICE_UPDATE_THRESHOLD) || 0.02; // 2% for db writes

let binance = null;
let isRunning = false;
let monitoredSymbols = [];
let lastPriceUpdate = {};
let priceHistory = {}; // Track last 1h of prices for anomaly detection
let priceStats = {}; // Running stats for signal generation

const MAX_HISTORY_SIZE = 60; // Store 1 hour of 1-minute data per symbol
let statsUpdateCount = 0;
let pricesReceivedCount = 0;
let pricesStoredCount = 0;

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

// Handle price update from WebSocket with signal detection
async function handlePriceUpdate(tickerData) {
  try {
    pricesReceivedCount++;

    const symbol = tickerData.s;
    const price = parseFloat(tickerData.c);
    const bid = parseFloat(tickerData.b);
    const ask = parseFloat(tickerData.a);
    const volume = parseFloat(tickerData.v);
    const priceChangePercent = parseFloat(tickerData.P) || 0;

    if (!symbol || !price) return;

    // Initialize price history for new symbol
    if (!priceHistory[symbol]) {
      priceHistory[symbol] = [];
      priceStats[symbol] = {
        high: price,
        low: price,
        sum: price,
        count: 1,
        lastPrice: price,
        avgPrice: price,
        volatility: 0,
      };
    }

    // Track price history (last 60 updates ~1 hour)
    priceHistory[symbol].push({ price, timestamp: Date.now(), volume });
    if (priceHistory[symbol].length > MAX_HISTORY_SIZE) {
      priceHistory[symbol].shift();
    }

    // Update running stats
    const stats = priceStats[symbol];
    stats.high = Math.max(stats.high, price);
    stats.low = Math.min(stats.low, price);
    stats.sum += price;
    stats.count += 1;
    stats.lastPrice = price;
    stats.avgPrice = stats.sum / stats.count;

    // Calculate volatility (standard deviation approximation)
    if (stats.count > 10) {
      const variance = priceHistory[symbol].reduce((sum, p) => {
        return sum + Math.pow(p.price - stats.avgPrice, 2);
      }, 0) / priceHistory[symbol].length;
      stats.volatility = Math.sqrt(variance);
    }

    // Throttle database writes: only write if price changed significantly
    const lastUpdate = lastPriceUpdate[symbol] || 0;
    const timeSinceLastUpdate = Date.now() - lastUpdate;
    const lastStoredPrice = lastPriceUpdate[`${symbol}_price`] || price;
    const priceChange = Math.abs((price - lastStoredPrice) / lastStoredPrice);

    const shouldWrite = timeSinceLastUpdate > MARKET_DATA_INTERVAL || priceChange > PRICE_UPDATE_THRESHOLD;

    if (shouldWrite) {
      lastPriceUpdate[symbol] = Date.now();
      lastPriceUpdate[`${symbol}_price`] = price;
      pricesStoredCount++;

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

      // Detect anomalies (price moves > 5% in 5 minutes)
      if (pricesReceivedCount % 100 === 0 && priceChangePercent > 5) {
        console.warn(`⚠️  ANOMALY: ${symbol} jumped ${priceChangePercent}% - monitoring price`);
        await sendAnomalyAlert(symbol, price, priceChangePercent);
      }
    }

  } catch (error) {
    console.error(`❌ Price update failed for ${tickerData?.s}:`, error.message);
  }
}

// Send Discord alert for price anomalies
async function sendAnomalyAlert(symbol, price, changePercent) {
  if (!process.env.DISCORD_WEBHOOK_URL) return;

  try {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, {
      embeds: [{
        color: changePercent > 0 ? 0x00ff00 : 0xff0000,
        title: '📈 Price Anomaly Detected',
        fields: [
          { name: 'Symbol', value: symbol, inline: true },
          { name: 'Change', value: `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`, inline: true },
          { name: 'Price', value: `$${price.toFixed(8)}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (error) {
    console.warn('Failed to send anomaly alert:', error.message);
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

// Record detailed health metrics
async function recordHealth() {
  try {
    const avgLatency = pricesReceivedCount > 0
      ? ((pricesStoredCount / pricesReceivedCount) * 100).toFixed(1)
      : 0;

    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat, processed_jobs, failed_jobs, avg_latency_ms, updated_at)
       VALUES ($1, $2, NOW(), $3, $4, $5, NOW())
       ON CONFLICT (agent_name) DO UPDATE SET
         status = $2,
         last_heartbeat = NOW(),
         processed_jobs = agent_health.processed_jobs + $3,
         updated_at = NOW()`,
      [
        'market-data-agent',
        isRunning ? 'HEALTHY' : 'OFFLINE',
        monitoredSymbols.length,
        0,
        avgLatency
      ]
    );

    if (statsUpdateCount % 6 === 0) { // Log every 10 minutes (6 * 60s)
      console.log(`📊 Health: ${monitoredSymbols.length} symbols | Prices: ${pricesReceivedCount} received, ${pricesStoredCount} stored (${avgLatency}%)`);
    }
    statsUpdateCount++;

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

// Periodically cleanup old market data (keep 7 days)
async function cleanupOldData() {
  try {
    const result = await db.query(
      `DELETE FROM market_data WHERE timestamp < NOW() - INTERVAL '7 days'`
    );

    console.log(`🧹 Cleaned up old market data: ${result.rowCount || 0} rows deleted`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Periodically refresh monitored symbols
async function refreshSymbols() {
  try {
    const newSymbols = await getMonitoredSymbols();

    // If symbols changed, restart WebSocket subscription
    if (newSymbols.length !== monitoredSymbols.length ||
        !newSymbols.every(s => monitoredSymbols.includes(s))) {

      console.log(`🔄 Symbol list changed, resubscribing to ${newSymbols.length} symbols...`);

      if (binance) {
        binance.closeWebSocket();
        binance.subscribeToPrices(newSymbols, handlePriceUpdate);
      }
    }
  } catch (error) {
    console.error('❌ Symbol refresh failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  try {
    console.log('\n🚀 Starting Market Data Agent...');
    console.log(`   Mode: ${USE_TESTNET ? 'TESTNET' : 'PRODUCTION'}`);
    console.log(`   Update Interval: ${MARKET_DATA_INTERVAL}ms`);
    console.log(`   Price Change Threshold: ${(PRICE_UPDATE_THRESHOLD * 100).toFixed(2)}%`);

    await initializeBroker();
    const symbols = await getMonitoredSymbols();

    if (symbols.length === 0) {
      console.warn('⚠️  No symbols configured in rebalancing_rules table');
      console.log('   Waiting for configuration...');
      isRunning = false;
      return;
    }

    // Subscribe to price updates
    binance.subscribeToPrices(symbols, handlePriceUpdate);
    console.log('✅ Market Data Agent ready');

    // Periodic background tasks
    const healthInterval = setInterval(recordHealth, 60000); // Every 60 seconds
    const cleanupInterval = setInterval(cleanupOldData, 86400000); // Every 24 hours
    const refreshInterval = setInterval(refreshSymbols, 300000); // Every 5 minutes

    // Graceful shutdown handlers
    const shutdown = async () => {
      console.log('\n🛑 Shutting down Market Data Agent...');
      isRunning = false;
      clearInterval(healthInterval);
      clearInterval(cleanupInterval);
      clearInterval(refreshInterval);
      if (binance) binance.closeWebSocket();
      await db.shutdown();
      console.log('✅ Agent shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Fatal error during startup:', error.message);
    isRunning = false;
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  start().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { start, handlePriceUpdate, priceStats };
