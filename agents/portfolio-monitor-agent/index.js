// AGENT 3: Portfolio Monitor & Rebalancer
// Monitors portfolio drift from target allocation
// Triggers rebalancing orders when drift > threshold
// Features: Real-time monitoring, drift tracking, auto-rebalancing, Discord alerts

const path = require('path');
const axios = require('axios');
const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const PORTFOLIO_MONITOR_INTERVAL = parseInt(process.env.PORTFOLIO_MONITOR_INTERVAL) || 60000;
const REBALANCE_THRESHOLD = parseFloat(process.env.REBALANCE_THRESHOLD) || 5; // %
const MIN_POSITION_SIZE = parseFloat(process.env.MIN_POSITION_SIZE) || 10; // Min $10 position
const SNAPSHOT_INTERVAL = 3600000; // Hourly portfolio snapshots
const MAX_ORDERS_PER_CYCLE = parseInt(process.env.MAX_ORDERS_PER_CYCLE) || 10;

let isRunning = false;
let monitoringCycles = 0;
let rebalanceCount = 0;
let totalDriftDetected = 0;

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

// Record portfolio snapshot (hourly)
async function snapshotPortfolio() {
  try {
    const portfolio = await getPortfolioValue();

    // Get last snapshot for comparison
    const lastSnapshot = await db.getRow(
      `SELECT cumulative_pnl FROM portfolio_snapshots ORDER BY snapshot_date DESC LIMIT 1`
    );

    // Calculate daily P&L (simple: total_value - previous_value)
    const dailyPnl = lastSnapshot ? portfolio.totalValue - (lastSnapshot.cumulative_pnl || 0) : 0;
    const returnPercentage = lastSnapshot
      ? (dailyPnl / (lastSnapshot.cumulative_pnl || portfolio.totalValue)) * 100
      : 0;

    await db.insert('portfolio_snapshots', {
      snapshot_date: new Date().toISOString().split('T')[0],
      total_value: portfolio.totalValue,
      cash_balance: portfolio.cashBalance,
      total_positions_value: portfolio.positionsValue,
      daily_pnl: dailyPnl,
      cumulative_pnl: portfolio.totalValue,
      return_percentage: returnPercentage,
    });

    console.log(`💾 Portfolio snapshot: $${portfolio.totalValue.toFixed(2)} (${returnPercentage > 0 ? '+' : ''}${returnPercentage.toFixed(2)}%)`);
  } catch (error) {
    console.error('❌ Snapshot failed:', error.message);
  }
}

// Monitor and rebalance
async function monitorPortfolio() {
  monitoringCycles++;

  try {
    const portfolio = await getPortfolioValue();
    const drift = await calculateDrift();
    const ordersNeeded = drift.filter(d => d.needsRebalance);

    if (monitoringCycles % 10 === 0) { // Log every 10 cycles (~10 min)
      console.log(`📊 Cycle #${monitoringCycles}: Portfolio $${portfolio.totalValue.toFixed(2)} | Drift issues: ${ordersNeeded.length}`);
    }

    if (ordersNeeded.length === 0) {
      return 0;
    }

    totalDriftDetected += ordersNeeded.length;
    console.log(`⚠️  Drift detected: ${ordersNeeded.map(d => `${d.symbol}(${d.drift.toFixed(1)}%)`).join(', ')}`);

    // Limit orders per cycle to avoid overwhelming the execution engine
    const ordersToCreate = await generateRebalancingOrders(drift, portfolio);
    const limitedOrders = ordersToCreate.slice(0, MAX_ORDERS_PER_CYCLE);
    const queued = await queueRebalancingOrders(limitedOrders);

    if (queued > 0) {
      rebalanceCount++;
      console.log(`✅ Queued ${queued} rebalancing orders (Rebalance #${rebalanceCount})`);

      // Send Discord notification
      if (process.env.DISCORD_WEBHOOK_URL) {
        sendRebalanceAlert(ordersToCreate, portfolio).catch(err =>
          console.warn('Discord alert failed:', err.message)
        );
      }
    }

    return queued;
  } catch (error) {
    console.error('❌ Portfolio monitoring error:', error.message);
    return 0;
  }
}

// Send Discord notification on rebalancing
async function sendRebalanceAlert(orders, portfolio) {
  if (!process.env.DISCORD_WEBHOOK_URL) return;

  try {
    const orderSummary = orders
      .slice(0, 5)
      .map(o => `${o.side} ${o.quantity.toFixed(4)} ${o.symbol}`)
      .join('\n');

    await axios.post(process.env.DISCORD_WEBHOOK_URL, {
      embeds: [{
        color: 0x0099ff,
        title: '⚙️ Rebalancing Orders Generated',
        fields: [
          { name: 'Portfolio Value', value: `$${portfolio.totalValue.toFixed(2)}`, inline: true },
          { name: 'Orders', value: String(orders.length), inline: true },
          { name: 'Orders to Execute', value: orderSummary, inline: false },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (error) {
    console.warn('Failed to send rebalance alert:', error.message);
  }
}

// Health check with detailed metrics
async function recordHealth() {
  try {
    const portfolio = await getPortfolioValue();

    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat, processed_jobs, failed_jobs, updated_at)
       VALUES ($1, $2, NOW(), $3, $4, NOW())
       ON CONFLICT (agent_name) DO UPDATE SET
         status = $2,
         last_heartbeat = NOW(),
         processed_jobs = agent_health.processed_jobs + $3`,
      [
        'portfolio-monitor-agent',
        isRunning ? 'HEALTHY' : 'OFFLINE',
        monitoringCycles,
        rebalanceCount
      ]
    );

    if (monitoringCycles % 60 === 0) { // Log metrics every hour
      console.log(`📈 Health: ${monitoringCycles} cycles | ${rebalanceCount} rebalances | ${totalDriftDetected} drift detections`);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  try {
    console.log('\n🚀 Starting Portfolio Monitor Agent...');
    console.log(`   Monitor Interval: ${PORTFOLIO_MONITOR_INTERVAL}ms`);
    console.log(`   Rebalance Threshold: ${REBALANCE_THRESHOLD}%`);
    console.log(`   Min Position Size: $${MIN_POSITION_SIZE}`);
    console.log(`   Max Orders/Cycle: ${MAX_ORDERS_PER_CYCLE}`);

    // Initial portfolio check
    const portfolio = await getPortfolioValue();
    console.log(`   Initial Portfolio Value: $${portfolio.totalValue.toFixed(2)}`);

    // Take initial snapshot
    await snapshotPortfolio();

    console.log('✅ Portfolio Monitor Agent ready');

    // Main monitoring loop
    const monitorInterval = setInterval(async () => {
      try {
        await monitorPortfolio();
        await recordHealth();
      } catch (error) {
        console.error('❌ Monitoring loop error:', error.message);
      }
    }, PORTFOLIO_MONITOR_INTERVAL);

    // Periodic snapshots (hourly)
    const snapshotInterval = setInterval(async () => {
      try {
        await snapshotPortfolio();
      } catch (error) {
        console.error('❌ Snapshot error:', error.message);
      }
    }, SNAPSHOT_INTERVAL);

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down Portfolio Monitor Agent...');
      isRunning = false;
      clearInterval(monitorInterval);
      clearInterval(snapshotInterval);
      await snapshotPortfolio(); // Final snapshot
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

module.exports = { start, monitorPortfolio };
