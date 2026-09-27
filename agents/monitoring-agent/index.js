const path = require('path');
// AGENT 8: Monitoring & Logging
// Logs all agent activity to PostgreSQL
// Generates performance metrics
// Alerts on system anomalies
// Replaces CloudWatch ($10/month)

const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
require('dotenv').config();

const MONITORING_INTERVAL = 60000; // 1 minute
let isRunning = false;

// Get agent health status
async function getAgentStatus() {
  try {
    const agents = await db.getRows(
      `SELECT agent_name, status, last_heartbeat, processed_jobs, failed_jobs, avg_latency_ms
       FROM agent_health
       ORDER BY agent_name ASC`
    );

    return agents;
  } catch (error) {
    console.error('❌ Failed to get agent status:', error.message);
    return [];
  }
}

// Check for anomalies
async function checkAnomalies() {
  try {
    const anomalies = [];

    // Check 1: No orders processed in last hour
    const recentOrders = await db.getRow(
      `SELECT COUNT(*) as count FROM orders WHERE created_at > NOW() - INTERVAL '1 hour'`
    );

    if (recentOrders.count === 0) {
      anomalies.push('⚠️  No orders processed in last hour');
    }

    // Check 2: High error rate
    const errorRate = await db.getRow(
      `SELECT COUNT(*) as count FROM error_log WHERE created_at > NOW() - INTERVAL '1 hour'`
    );

    if (errorRate.count > 10) {
      anomalies.push(`⚠️  High error rate: ${errorRate.count} errors in last hour`);
    }

    // Check 3: Agent health
    const agentHealth = await db.getRows(
      `SELECT agent_name, status, last_heartbeat FROM agent_health
       WHERE status != 'HEALTHY' OR last_heartbeat < NOW() - INTERVAL '5 minutes'`
    );

    agentHealth.forEach(agent => {
      anomalies.push(`⚠️  ${agent.agent_name} status: ${agent.status}`);
    });

    // Check 4: Queue buildup
    const queueSize = await db.getRow(
      `SELECT COUNT(*) as count FROM job_queue WHERE status = 'PENDING'`
    );

    if (queueSize.count > 50) {
      anomalies.push(`⚠️  Large job queue: ${queueSize.count} pending jobs`);
    }

    return anomalies;
  } catch (error) {
    console.error('❌ Anomaly check failed:', error.message);
    return [];
  }
}

// Generate performance metrics
async function generateMetrics() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get execution metrics
    const executions = await db.getRow(
      `SELECT COUNT(*) as total, COUNT(DISTINCT symbol) as symbols,
              SUM(quantity) as volume, AVG(executed_price) as avg_price
       FROM executions WHERE DATE(executed_at) = $1`,
      [today]
    );

    // Get portfolio metrics
    const portfolio = await db.getRow(
      `SELECT total_value, daily_pnl, return_percentage FROM portfolio_snapshots
       WHERE snapshot_date = $1`,
      [today]
    );

    // Get system metrics
    const agents = await getAgentStatus();
    const healthyAgents = agents.filter(a => a.status === 'HEALTHY').length;

    return {
      date: today,
      executions: executions.total || 0,
      symbols: executions.symbols || 0,
      volume: executions.volume || 0,
      avgPrice: executions.avg_price || 0,
      portfolio: portfolio || { total_value: 0, daily_pnl: 0, return_percentage: 0 },
      healthyAgents: `${healthyAgents}/${agents.length}`,
    };
  } catch (error) {
    console.error('❌ Metrics generation failed:', error.message);
    return null;
  }
}

// Print system status
async function printSystemStatus() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🖥️  SYSTEM MONITORING REPORT');
    console.log('='.repeat(60));

    // Agent status
    const agents = await getAgentStatus();
    console.log('\n📊 AGENT STATUS');
    agents.forEach(agent => {
      const icon = agent.status === 'HEALTHY' ? '✅' : '⚠️';
      const lastBeat = new Date(agent.last_heartbeat);
      const secondsAgo = Math.floor((Date.now() - lastBeat) / 1000);
      console.log(`  ${icon} ${agent.agent_name.padEnd(25)} | ${agent.status.padEnd(10)} | ${secondsAgo}s ago`);
    });

    // Anomalies
    const anomalies = await checkAnomalies();
    if (anomalies.length > 0) {
      console.log('\n⚠️  ANOMALIES DETECTED');
      anomalies.forEach(anomaly => {
        console.log(`  ${anomaly}`);
      });
    } else {
      console.log('\n✅ No anomalies detected');
    }

    // Performance metrics
    const metrics = await generateMetrics();
    if (metrics) {
      console.log('\n📈 PERFORMANCE METRICS');
      console.log(`  Executions:         ${metrics.executions}`);
      console.log(`  Unique Symbols:     ${metrics.symbols}`);
      console.log(`  Total Volume:       ${metrics.volume}`);
      console.log(`  Portfolio Value:    $${metrics.portfolio.total_value.toFixed(2)}`);
      console.log(`  Daily P&L:          $${metrics.portfolio.daily_pnl.toFixed(2)}`);
      console.log(`  Return %:           ${metrics.portfolio.return_percentage.toFixed(2)}%`);
      console.log(`  Healthy Agents:     ${metrics.healthyAgents}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Status report failed:', error.message);
  }
}

// Cleanup old logs
async function cleanupOldLogs() {
  try {
    // Delete logs older than 30 days
    const result = await db.query(
      `DELETE FROM error_log WHERE created_at < NOW() - INTERVAL '30 days'`
    );

    if (result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} old error logs`);
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  console.log('🚀 Monitoring Agent started');

  // Print status every minute
  setInterval(printSystemStatus, MONITORING_INTERVAL);

  // Cleanup every hour
  setInterval(cleanupOldLogs, 3600000);

  // Initial status
  setTimeout(printSystemStatus, 2000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Monitoring Agent...');
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

module.exports = { start, printSystemStatus };
