const path = require('path');
// AGENT 4: Risk Management & Compliance
// Enforces position limits, leverage checks, trading hour restrictions
// Runs before every order execution

const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
require('dotenv').config();

const MAX_POSITION_SIZE = parseFloat(process.env.MAX_POSITION_SIZE) || 0.5;
const MAX_DAILY_LOSS = parseFloat(process.env.MAX_DAILY_LOSS_PERCENT) || 5;
const MAX_LEVERAGE = parseFloat(process.env.MAX_LEVERAGE) || 1.0;

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

// Validate order
async function validateOrder(order) {
  try {
    console.log(`🔒 Risk checking order: ${order.symbol} ${order.side} ${order.quantity}`);

    // Check 1: Trading hours
    if (!isWithinTradingHours()) {
      return {
        valid: false,
        reason: 'Outside trading hours',
      };
    }

    // Check 2: Position limits
    const priceResult = await db.getRow(
      `SELECT current_price FROM market_data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1`,
      [order.symbol]
    );

    const currentPrice = priceResult?.current_price || 0;
    if (currentPrice > 0) {
      const limitCheck = await checkPositionLimits(order.symbol, order.quantity, currentPrice);
      if (!limitCheck.allowed) {
        return limitCheck;
      }
    }

    // Check 3: Daily loss limit
    const lossCheck = await checkDailyLossLimit();
    if (!lossCheck.allowed) {
      return lossCheck;
    }

    // Check 4: Leverage (binance spot only, max 1x)
    if (order.orderType === 'MARGIN' && MAX_LEVERAGE < 2) {
      return {
        valid: false,
        reason: 'Margin trading not allowed',
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('❌ Validation error:', error.message);
    return { valid: false, reason: 'Validation error' };
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

// Health check
async function recordHealth() {
  try {
    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat)
       VALUES ($1, $2, NOW())
       ON CONFLICT (agent_name) DO UPDATE SET status = $2, last_heartbeat = NOW()`,
      ['risk-management-agent', 'HEALTHY']
    );
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

module.exports = {
  validateOrder,
  checkPositionLimits,
  checkDailyLossLimit,
  isWithinTradingHours,
  logRiskEvent,
  recordHealth,
};
