// AGENT 4: Risk Management & Compliance
// Enforces position limits, leverage checks, trading hour restrictions
// Utility module called by order execution before every trade

const path = require('path');
const axios = require('axios');
const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
require('dotenv').config();

const MAX_POSITION_SIZE = parseFloat(process.env.MAX_POSITION_SIZE) || 0.5; // 50% of portfolio
const MAX_DAILY_LOSS = parseFloat(process.env.MAX_DAILY_LOSS_PERCENT) || 5; // 5% daily max loss
const MAX_LEVERAGE = parseFloat(process.env.MAX_LEVERAGE) || 1.0; // Spot trading only
const MIN_PRICE = parseFloat(process.env.MIN_PRICE) || 0.00000001; // Dust filter
const TRADING_HOURS_ENABLED = process.env.TRADING_HOURS_ENABLED !== 'false';

let checksPerformed = 0;
let violationsBlocked = 0;
let violationsByType = {};

// Check if within trading hours
function isWithinTradingHours() {
  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentTime = hours * 100 + minutes;

  // Market open: 14:30 UTC (09:30 ET), close: 21:00 UTC (16:00 ET)
  // Extended: 12:30 UTC to 21:00 UTC
  const marketOpen = 1430;
  const marketClose = 2100;

  return currentTime >= marketOpen && currentTime <= marketClose;
}

// Check position size limits
async function checkPositionLimits(symbol, quantity, price) {
  try {
    // Get portfolio value
    const positions = await db.getRows(
      `SELECT quantity, current_price FROM positions WHERE quantity > 0`
    );

    let totalValue = 0;
    positions.forEach(pos => {
      totalValue += pos.quantity * (pos.current_price || 0);
    });

    const newPositionValue = quantity * price;
    const positionPercent = (newPositionValue / totalValue) * 100;

    if (positionPercent > (MAX_POSITION_SIZE * 100)) {
      return {
        allowed: false,
        reason: `Position size ${positionPercent.toFixed(2)}% exceeds limit ${MAX_POSITION_SIZE * 100}%`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('❌ Position limit check failed:', error.message);
    return { allowed: false, reason: 'Risk check error' };
  }
}

// Check daily loss limit
async function checkDailyLossLimit() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await db.getRow(
      `SELECT daily_pnl FROM portfolio_snapshots WHERE snapshot_date = $1`,
      [today]
    );

    if (snapshot && snapshot.daily_pnl < 0) {
      const lossPrecent = Math.abs(snapshot.daily_pnl);
      if (lossPrecent > MAX_DAILY_LOSS) {
        return {
          allowed: false,
          reason: `Daily loss ${lossPrecent.toFixed(2)}% exceeds limit ${MAX_DAILY_LOSS}%`,
        };
      }
    }

    return { allowed: true };
  } catch (error) {
    console.error('❌ Daily loss check failed:', error.message);
    return { allowed: true }; // Allow if check fails
  }
}

// Validate order against all risk rules
async function validateOrder(order) {
  checksPerformed++;

  try {
    // Get current price
    const priceResult = await db.getRow(
      `SELECT current_price FROM market_data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1`,
      [order.symbol]
    );
    const currentPrice = priceResult?.current_price || order.price || 0;

    // Check 1: Basic sanity checks
    if (!order.symbol || order.quantity <= 0 || currentPrice <= MIN_PRICE) {
      return recordViolation(order, 'INVALID_ORDER_PARAMS', 'Invalid order parameters');
    }

    // Check 2: Trading hours (if enabled)
    if (TRADING_HOURS_ENABLED && !isWithinTradingHours()) {
      return recordViolation(order, 'TRADING_HOURS', 'Outside trading hours (14:30-21:00 UTC)');
    }

    // Check 3: Position limits
    const limitCheck = await checkPositionLimits(order.symbol, order.quantity, currentPrice);
    if (!limitCheck.allowed) {
      return recordViolation(order, 'POSITION_LIMIT', limitCheck.reason);
    }

    // Check 4: Daily loss limit
    const lossCheck = await checkDailyLossLimit();
    if (!lossCheck.allowed) {
      return recordViolation(order, 'DAILY_LOSS', lossCheck.reason);
    }

    // Check 5: Leverage restrictions (spot only)
    if (order.orderType === 'MARGIN' && MAX_LEVERAGE < 2) {
      return recordViolation(order, 'MARGIN_NOT_ALLOWED', 'Margin trading disabled');
    }

    // Check 6: Order value minimum ($1)
    const orderValue = order.quantity * currentPrice;
    if (orderValue < 1) {
      return recordViolation(order, 'ORDER_TOO_SMALL', `Order value $${orderValue.toFixed(2)} below $1 minimum`);
    }

    // All checks passed
    return { valid: true, checksPerformed };

  } catch (error) {
    console.error('❌ Validation error:', error.message);
    return recordViolation(order, 'VALIDATION_ERROR', error.message);
  }
}

// Record a violation and send alert
function recordViolation(order, type, reason) {
  violationsBlocked++;
  violationsByType[type] = (violationsByType[type] || 0) + 1;

  const result = {
    valid: false,
    reason,
    type,
    blocked: true,
  };

  console.warn(`🚫 BLOCKED ${type}: ${reason}`);

  // Log to database
  logRiskEvent(order, `${type}: ${reason}`, 'WARNING').catch(err =>
    console.warn('Failed to log violation:', err.message)
  );

  // Send Discord alert for major violations
  if (['POSITION_LIMIT', 'DAILY_LOSS', 'MARGIN_NOT_ALLOWED'].includes(type) && process.env.DISCORD_WEBHOOK_URL) {
    sendRiskAlert(order, type, reason).catch(err =>
      console.warn('Discord alert failed:', err.message)
    );
  }

  return result;
}

// Send Discord alert for risk violations
async function sendRiskAlert(order, type, reason) {
  if (!process.env.DISCORD_WEBHOOK_URL) return;

  try {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, {
      embeds: [{
        color: 0xff6600,
        title: '⚠️ Risk Check Violation',
        fields: [
          { name: 'Type', value: type, inline: true },
          { name: 'Symbol', value: order.symbol, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (error) {
    console.warn('Failed to send risk alert:', error.message);
  }
}

// Log risk event
async function logRiskEvent(order, event, severity = 'INFO') {
  try {
    await db.insert('error_log', {
      order_id: order.order_id,
      error_type: `RISK_${severity}`,
      error_message: event,
      broker: order.broker,
    });
  } catch (error) {
    console.error('❌ Failed to log risk event:', error.message);
  }
}

// Record health metrics
async function recordHealth() {
  try {
    const blockRate = checksPerformed > 0 ? ((violationsBlocked / checksPerformed) * 100).toFixed(1) : 0;

    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat, processed_jobs, failed_jobs, updated_at)
       VALUES ($1, $2, NOW(), $3, $4, NOW())
       ON CONFLICT (agent_name) DO UPDATE SET
         status = $2,
         last_heartbeat = NOW(),
         processed_jobs = agent_health.processed_jobs + $3`,
      ['risk-management-agent', 'HEALTHY', checksPerformed, violationsBlocked]
    );

    if (checksPerformed % 100 === 0) {
      console.log(`🔒 Risk checks: ${checksPerformed} performed | ${violationsBlocked} blocked (${blockRate}%)`);
      console.log(`   Violations by type: ${JSON.stringify(violationsByType)}`);
    }

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

// Get violation stats
function getStats() {
  return {
    checksPerformed,
    violationsBlocked,
    violationsByType,
    blockRate: checksPerformed > 0 ? ((violationsBlocked / checksPerformed) * 100).toFixed(1) : 0,
  };
}

module.exports = {
  validateOrder,
  checkPositionLimits,
  checkDailyLossLimit,
  isWithinTradingHours,
  logRiskEvent,
  recordHealth,
  getStats,
};
