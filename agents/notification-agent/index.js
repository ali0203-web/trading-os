const path = require('path');
// AGENT 7: Notification Engine
// Aggregates trade alerts and sends to Discord Bot
// Batches alerts to reduce noise
// Replaces Slack Pro ($8/month)

const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
const axios = require('axios');
require('dotenv').config();

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const ALERT_BATCH_INTERVAL = 3600000; // 1 hour batch window
const ALERT_THRESHOLD_ERRORS = parseInt(process.env.ALERT_THRESHOLD_ERRORS) || 5;

let isRunning = false;
let pendingAlerts = [];

// Format order alert
function formatOrderAlert(order) {
  return {
    title: `📈 ${order.side} ${order.symbol}`,
    description: `${order.quantity} @ Market | Status: ${order.status}`,
    color: order.side === 'BUY' ? 3066993 : 15158332, // Blue for BUY, Red for SELL
    timestamp: new Date().toISOString(),
  };
}

// Format error alert
function formatErrorAlert(error) {
  return {
    title: `⚠️  ${error.error_type}`,
    description: error.error_message,
    color: 15105570, // Orange for errors
    timestamp: new Date().toISOString(),
  };
}

// Format portfolio alert
function formatPortfolioAlert(portfolio) {
  const color = portfolio.daily_pnl >= 0 ? 65280 : 16711680; // Green if profit, red if loss
  return {
    title: `💰 Daily Report`,
    description: `Value: $${portfolio.total_value.toFixed(2)} | P&L: $${portfolio.daily_pnl.toFixed(2)} (${portfolio.return_percentage.toFixed(2)}%)`,
    color,
    timestamp: new Date().toISOString(),
  };
}

// Send Discord message
async function sendDiscordMessage(alerts) {
  if (!DISCORD_WEBHOOK) {
    console.warn('⚠️  Discord webhook not configured, skipping notification');
    return;
  }

  try {
    const embeds = alerts.map(alert => ({
      title: alert.title,
      description: alert.description,
      color: alert.color,
      timestamp: alert.timestamp,
    }));

    const payload = {
      content: `**Trading Agent Alert Batch** (${alerts.length} alerts)`,
      embeds,
    };

    await axios.post(DISCORD_WEBHOOK, payload);
    console.log(`✅ Sent ${alerts.length} alerts to Discord`);
  } catch (error) {
    console.error('❌ Failed to send Discord message:', error.message);
  }
}

// Collect pending alerts
async function collectAlerts() {
  try {
    // Get recent orders
    const recentOrders = await db.getRows(
      `SELECT * FROM orders
       WHERE status IN ('FILLED', 'CANCELLED')
       AND updated_at > NOW() - INTERVAL '1 hour'
       LIMIT 20`
    );

    recentOrders.forEach(order => {
      pendingAlerts.push(formatOrderAlert(order));
    });

    // Get recent errors
    const recentErrors = await db.getRows(
      `SELECT * FROM error_log
       WHERE created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC
       LIMIT 10`
    );

    recentErrors.forEach(error => {
      pendingAlerts.push(formatErrorAlert(error));
    });

    // Check error threshold
    if (recentErrors.length > ALERT_THRESHOLD_ERRORS) {
      pendingAlerts.unshift({
        title: '🚨 High Error Rate',
        description: `${recentErrors.length} errors in last hour`,
        color: 16711680, // Red
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📋 Collected ${pendingAlerts.length} alerts`);
  } catch (error) {
    console.error('❌ Failed to collect alerts:', error.message);
  }
}

// Send batched alerts
async function sendBatchedAlerts() {
  try {
    if (pendingAlerts.length === 0) {
      console.log('✅ No alerts to send');
      return;
    }

    console.log(`📤 Sending batch of ${pendingAlerts.length} alerts`);
    await sendDiscordMessage(pendingAlerts);

    pendingAlerts = [];
  } catch (error) {
    console.error('❌ Batch send error:', error.message);
  }
}

// Send daily report
async function sendDailyReport() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await db.getRow(
      `SELECT * FROM portfolio_snapshots WHERE snapshot_date = $1`,
      [today]
    );

    if (!snapshot) {
      console.log('⚠️  No portfolio snapshot for today');
      return;
    }

    const alert = formatPortfolioAlert(snapshot);
    await sendDiscordMessage([alert]);
  } catch (error) {
    console.error('❌ Daily report error:', error.message);
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
      ['notification-agent', 'HEALTHY', pendingAlerts.length]
    );
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  console.log('🚀 Notification Agent started');
  console.log(`   Discord webhook: ${DISCORD_WEBHOOK ? '✅ Configured' : '❌ Not configured'}`);

  // Collect alerts every 5 minutes
  setInterval(collectAlerts, 300000);

  // Send batched alerts every hour
  setInterval(async () => {
    await sendBatchedAlerts();
    await sendDailyReport();
    await recordHealth();
  }, ALERT_BATCH_INTERVAL);

  // Initial setup
  setTimeout(() => {
    collectAlerts();
  }, 5000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Notification Agent...');
    isRunning = false;
    process.exit(0);
  });
}

// Run if executed directly
if (require.main === module) {
  start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { start, sendDiscordMessage };
