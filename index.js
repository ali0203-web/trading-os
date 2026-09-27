// Main Entry Point - Start All Trading Agents
// Run on Railway Node.js runtime

require('dotenv').config();
const db = require('./lib/database');

// Import all agents
const orderExecutionAgent = require('./agents/order-execution-agent/index');
const marketDataAgent = require('./agents/market-data-agent/index');
const portfolioMonitorAgent = require('./agents/portfolio-monitor-agent/index');
// Risk management is a utility module, imported by order execution
const errorRecoveryAgent = require('./agents/error-recovery-agent/index');
const reconciliationAgent = require('./agents/reconciliation-agent/index');
const notificationAgent = require('./agents/notification-agent/index');
const monitoringAgent = require('./agents/monitoring-agent/index');
const queueManagerAgent = require('./agents/queue-manager/index');

const NODE_ENV = process.env.NODE_ENV || 'production';
const TRADING_MODE = process.env.TRADING_MODE || 'TESTNET';

// Startup banner
console.log('\n' + '='.repeat(70));
console.log('🚀 AUTONOMOUS TRADING AGENT SYSTEM - STARTUP');
console.log('='.repeat(70));
console.log(`\n⚙️  Configuration:`);
console.log(`   Environment: ${NODE_ENV}`);
console.log(`   Trading Mode: ${TRADING_MODE}`);
console.log(`   Database URL: ${process.env.DATABASE_URL ? '✅ Configured' : '❌ Missing'}`);
console.log(`   Binance API Keys: ${process.env.BINANCE_TESTNET_API_KEY ? '✅ Configured' : '❌ Missing'}`);
console.log(`   Discord Webhook: ${process.env.DISCORD_WEBHOOK_URL ? '✅ Configured' : '❌ Missing'}`);

// Start all agents
async function startup() {
  try {
    console.log(`\n📊 Initializing database...`);
    await db.initializeDatabase();
    console.log(`✅ Database ready`);

    console.log(`\n🔄 Starting agents...\n`);

    // Start agents in order of dependency
    // 1. Queue manager first (manages job routing)
    await queueManagerAgent.start();

    // 2. Market data agent (fetches prices)
    await marketDataAgent.start();

    // 3. Portfolio monitor (uses market data)
    await portfolioMonitorAgent.start();

    // 4. Order execution (executes from queue)
    await orderExecutionAgent.start();

    // 5. Error recovery (handles failures)
    await errorRecoveryAgent.start();

    // 6. Reconciliation (daily reporting)
    await reconciliationAgent.start();

    // 7. Notification (sends alerts)
    await notificationAgent.start();

    // 8. Monitoring (logs everything)
    await monitoringAgent.start();

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL AGENTS STARTED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('\n📡 System is operational. Monitoring in progress...\n');

  } catch (error) {
    console.error('\n❌ STARTUP FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Shutting down all agents...');
  await db.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n\n🛑 Interrupted, shutting down...');
  await db.shutdown();
  process.exit(0);
});

// Start the system
startup();
