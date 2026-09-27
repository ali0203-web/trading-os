const path = require('path');
// AGENT 6: Daily Reconciliation & Reporting
// Reconciles orders vs executions
// Calculates daily P&L
// Generates performance reports
// Scheduled daily at market close (17:00 UTC)

const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
require('dotenv').config();

let isRunning = false;

// Calculate daily portfolio value and P&L
async function calculateDailyMetrics() {
  try {
    console.log('📊 Calculating daily metrics');

    // Get all positions at current prices
    const positions = await db.getRows(
      `SELECT symbol, quantity, current_price FROM positions WHERE quantity > 0`
    );

    let totalPositionsValue = 0;
    positions.forEach(pos => {
      totalPositionsValue += pos.quantity * (pos.current_price || 0);
    });

    // Get last snapshot
    const lastSnapshot = await db.getRow(
      `SELECT total_value, cumulative_pnl FROM portfolio_snapshots
       ORDER BY snapshot_date DESC LIMIT 1`
    );

    const previousValue = lastSnapshot?.total_value || 0;
    const cumulativePnL = lastSnapshot?.cumulative_pnl || 0;

    // Add cash balance (assume initial capital)
    const cashBalance = parseFloat(process.env.INITIAL_CAPITAL) || 100;
    const totalValue = totalPositionsValue + cashBalance;
    const dailyPnL = totalValue - previousValue;
    const newCumulativePnL = cumulativePnL + dailyPnL;
    const returnPercent = previousValue > 0
      ? (dailyPnL / previousValue) * 100
      : 0;

    const today = new Date().toISOString().split('T')[0];

    // Insert snapshot
    await db.insert('portfolio_snapshots', {
      snapshot_date: today,
      total_value: totalValue,
      cash_balance: cashBalance,
      total_positions_value: totalPositionsValue,
      daily_pnl: dailyPnL,
      cumulative_pnl: newCumulativePnL,
      return_percentage: returnPercent,
    });

    console.log(`✅ Daily snapshot created`);
    console.log(`   Portfolio value: $${totalValue.toFixed(2)}`);
    console.log(`   Daily P&L: $${dailyPnL.toFixed(2)}`);
    console.log(`   Cumulative P&L: $${newCumulativePnL.toFixed(2)}`);
    console.log(`   Return: ${returnPercent.toFixed(2)}%`);

    return {
      totalValue,
      dailyPnL,
      cumulativePnL: newCumulativePnL,
      returnPercent,
      positions,
    };
  } catch (error) {
    console.error('❌ Failed to calculate daily metrics:', error.message);
    throw error;
  }
}

// Reconcile orders vs executions
async function reconcileOrders() {
  try {
    console.log('🔍 Reconciling orders and executions');

    // Find orders without matching executions
    const unreconciledOrders = await db.getRows(
      `SELECT o.id, o.order_id, o.symbol, o.status FROM orders o
       LEFT JOIN executions e ON o.order_id = e.order_id
       WHERE o.status = 'PLACED' AND e.id IS NULL
       AND o.created_at < NOW() - INTERVAL '5 minutes'`
    );

    if (unreconciledOrders.length > 0) {
      console.warn(`⚠️  Found ${unreconciledOrders.length} unmatched orders`);

      for (const order of unreconciledOrders) {
        await db.insert('error_log', {
          order_id: order.order_id,
          error_type: 'RECONCILIATION_MISMATCH',
          error_message: `Order ${order.order_id} not executed within 5 minutes`,
          broker: 'BINANCE',
        });
      }
    }

    return unreconciledOrders.length;
  } catch (error) {
    console.error('❌ Reconciliation failed:', error.message);
    return 0;
  }
}

// Generate performance report
async function generateReport(metrics) {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📈 DAILY PERFORMANCE REPORT');
    console.log('='.repeat(60));

    console.log(`\n📊 PORTFOLIO METRICS`);
    console.log(`  Total Value:        $${metrics.totalValue.toFixed(2)}`);
    console.log(`  Daily P&L:          $${metrics.dailyPnL.toFixed(2)}`);
    console.log(`  Cumulative P&L:     $${metrics.cumulativePnL.toFixed(2)}`);
    console.log(`  Return:             ${metrics.returnPercent.toFixed(4)}%`);

    console.log(`\n💼 POSITIONS (${metrics.positions.length})`);
    metrics.positions.forEach(pos => {
      const value = pos.quantity * pos.current_price;
      console.log(`  ${pos.symbol}: ${pos.quantity.toFixed(8)} @ $${pos.current_price.toFixed(2)} = $${value.toFixed(2)}`);
    });

    // Get execution stats
    const today = new Date().toISOString().split('T')[0];
    const stats = await db.getRow(
      `SELECT COUNT(*) as total_executions,
              COUNT(DISTINCT symbol) as unique_symbols,
              SUM(quantity) as total_volume
       FROM executions WHERE DATE(executed_at) = $1`,
      [today]
    );

    console.log(`\n📋 EXECUTION STATS`);
    console.log(`  Total Executions:   ${stats.total_executions || 0}`);
    console.log(`  Unique Symbols:     ${stats.unique_symbols || 0}`);
    console.log(`  Total Volume:       ${(stats.total_volume || 0).toFixed(8)}`);

    // Get error stats
    const errors = await db.getRow(
      `SELECT COUNT(*) as error_count FROM error_log
       WHERE DATE(created_at) = $1`,
      [today]
    );

    console.log(`\n⚠️  ERROR STATS`);
    console.log(`  Daily Errors:       ${errors.error_count || 0}`);

    console.log('\n' + '='.repeat(60) + '\n');

    return {
      metrics,
      executions: stats.total_executions || 0,
      errors: errors.error_count || 0,
    };
  } catch (error) {
    console.error('❌ Report generation failed:', error.message);
    return null;
  }
}

// Run daily reconciliation
async function runDailyReconciliation() {
  try {
    console.log('🔄 Daily reconciliation started');

    const reconciledCount = await reconcileOrders();
    const metrics = await calculateDailyMetrics();
    const report = await generateReport(metrics);

    console.log(`✅ Daily reconciliation completed`);
    return report;
  } catch (error) {
    console.error('❌ Reconciliation error:', error.message);
  }
}

// Schedule daily execution
function scheduleDaily() {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(17, 0, 0, 0); // 17:00 UTC (market close)

  if (target <= now) {
    target.setDate(target.getDate() + 1); // Next day if already past
  }

  const delay = target - now;
  console.log(`⏰ Scheduled daily reconciliation in ${Math.floor(delay / 1000)}s`);

  setTimeout(() => {
    runDailyReconciliation();
    // Then repeat daily
    setInterval(runDailyReconciliation, 86400000); // 24 hours
  }, delay);
}

// Health check
async function recordHealth() {
  try {
    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat)
       VALUES ($1, $2, NOW())
       ON CONFLICT (agent_name) DO UPDATE SET status = $2, last_heartbeat = NOW()`,
      ['reconciliation-agent', 'HEALTHY']
    );
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  console.log('🚀 Reconciliation Agent started');

  scheduleDaily();

  // Health check every hour
  setInterval(recordHealth, 3600000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Reconciliation Agent...');
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

module.exports = { start, runDailyReconciliation };
