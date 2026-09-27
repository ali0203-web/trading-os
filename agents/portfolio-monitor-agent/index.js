const path = require('path');
// AGENT 3: Portfolio Monitor & Rebalancer
// Monitors portfolio drift from target allocation
// Triggers rebalancing orders when drift > threshold
// Runs on schedule (every 60 seconds)

const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const PORTFOLIO_MONITOR_INTERVAL = parseInt(process.env.PORTFOLIO_MONITOR_INTERVAL) || 60000;
const REBALANCE_THRESHOLD = parseFloat(process.env.REBALANCE_THRESHOLD) || 5; // %
const MIN_POSITION_SIZE = 10; // Min $10 position to avoid dust

let isRunning = false;

// Get portfolio value
async function getPortfolioValue() {
  try {
    // Sum all positions at current prices
    const positions = await db.getRows(
      `SELECT symbol, quantity, current_price FROM positions WHERE quantity > 0`
    );

    let totalValue = 0;
    positions.forEach(pos => {
      totalValue += pos.quantity * (pos.current_price || 0);
    });

    // Add cash balance from last snapshot
    const lastSnapshot = await db.getRow(
      `SELECT cash_balance FROM portfolio_snapshots ORDER BY snapshot_date DESC LIMIT 1`
    );

    const cashBalance = lastSnapshot?.cash_balance || 0;
    return {
      positionsValue: totalValue,
      cashBalance,
      totalValue: totalValue + cashBalance,
    };
  } catch (error) {
    console.error('❌ Failed to get portfolio value:', error.message);
    throw error;
  }
}

// Calculate portfolio drift
async function calculateDrift() {
  try {
    const portfolio = await getPortfolioValue();
    if (portfolio.totalValue === 0) {
      console.log('⚠️  Portfolio empty, skipping rebalance');
      return [];
    }

    const rules = await db.getRows(
      `SELECT symbol, target_allocation, min_allocation, max_allocation, rebalance_threshold
       FROM rebalancing_rules WHERE enabled = true`
    );

    const driftAnalysis = [];

    for (const rule of rules) {
      const position = await db.getRow(
        `SELECT quantity, current_price FROM positions
         WHERE symbol = $1 AND broker = 'BINANCE'`,
        [rule.symbol]
      );

      const positionValue = (position?.quantity || 0) * (position?.current_price || 0);
      const currentAllocation = (positionValue / portfolio.totalValue) * 100;
      const targetAllocation = rule.target_allocation;
      const drift = currentAllocation - targetAllocation;

      driftAnalysis.push({
        symbol: rule.symbol,
        currentAllocation,
        targetAllocation,
        drift,
        positionValue,
        quantity: position?.quantity || 0,
        currentPrice: position?.current_price || 0,
        threshold: rule.rebalance_threshold,
        needsRebalance: Math.abs(drift) > rule.rebalance_threshold,
      });
    }

    return driftAnalysis;
  } catch (error) {
    console.error('❌ Failed to calculate drift:', error.message);
    throw error;
  }
}

// Generate rebalancing orders
async function generateRebalancingOrders(driftAnalysis, portfolio) {
  try {
    const ordersToCreate = [];

    for (const item of driftAnalysis) {
      if (!item.needsRebalance) continue;

      // Calculate target position value
      const targetValue = (portfolio.totalValue * item.targetAllocation) / 100;
      const currentValue = item.positionValue;
      const adjustmentValue = targetValue - currentValue;
      const adjustmentQuantity = adjustmentValue / item.currentPrice;

      if (Math.abs(adjustmentValue) < MIN_POSITION_SIZE) {
        continue; // Skip dust amounts
      }

      const side = adjustmentQuantity > 0 ? 'BUY' : 'SELL';
      const quantity = Math.abs(adjustmentQuantity);

      ordersToCreate.push({
        symbol: item.symbol,
        side,
        quantity,
        currentAllocation: item.currentAllocation,
        targetAllocation: item.targetAllocation,
        drift: item.drift,
        adjustmentValue,
      });

      console.log(`📊 Rebalance needed: ${item.symbol}`);
      console.log(`   Current: ${item.currentAllocation.toFixed(2)}%, Target: ${item.targetAllocation.toFixed(2)}%`);
      console.log(`   Action: ${side} ${quantity.toFixed(8)} (${adjustmentValue.toFixed(2)} USDT)`);
    }

    return ordersToCreate;
  } catch (error) {
    console.error('❌ Failed to generate rebalancing orders:', error.message);
    throw error;
  }
}

// Queue rebalancing orders
async function queueRebalancingOrders(orders) {
  try {
    for (const order of orders) {
      const jobId = uuidv4();
      const orderId = `REBAL-${Date.now()}-${uuidv4().substring(0, 8)}`;

      // Create order record
      await db.insert('orders', {
        order_id: orderId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        order_type: 'MARKET',
        status: 'PENDING',
        broker: 'BINANCE',
      });

      // Queue job
      await db.insert('job_queue', {
        job_id: jobId,
        job_type: 'EXECUTE_ORDER',
        status: 'PENDING',
        payload: JSON.stringify({
          orderId,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          orderType: 'MARKET',
          broker: 'BINANCE',
        }),
        priority: 10, // High priority for rebalancing
        scheduled_for: new Date(),
      });

      console.log(`✅ Queued rebalancing order: ${orderId}`);
    }

    return orders.length;
  } catch (error) {
    console.error('❌ Failed to queue orders:', error.message);
    throw error;
  }
}

// Monitor and rebalance
async function monitorPortfolio() {
  try {
    console.log('📈 Portfolio monitoring cycle started');

    const portfolio = await getPortfolioValue();
    console.log(`   Portfolio value: $${portfolio.totalValue.toFixed(2)}`);

    const drift = await calculateDrift();
    const ordersNeeded = drift.filter(d => d.needsRebalance);

    if (ordersNeeded.length === 0) {
      console.log('✅ Portfolio balanced, no rebalancing needed');
      return 0;
    }

    console.log(`⚠️  Drift detected in ${ordersNeeded.length} positions`);

    const ordersToCreate = await generateRebalancingOrders(drift, portfolio);
    const queued = await queueRebalancingOrders(ordersToCreate);

    console.log(`📋 Queued ${queued} rebalancing orders`);
    return queued;
  } catch (error) {
    console.error('❌ Portfolio monitoring error:', error.message);
    return 0;
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
         last_heartbeat = NOW()`,
      ['portfolio-monitor-agent', 'HEALTHY', 1]
    );
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  console.log('🚀 Portfolio Monitor Agent started');

  setInterval(async () => {
    try {
      await monitorPortfolio();
      await recordHealth();
    } catch (error) {
      console.error('Agent error:', error.message);
    }
  }, PORTFOLIO_MONITOR_INTERVAL);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Portfolio Monitor Agent...');
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

module.exports = { start, monitorPortfolio };
