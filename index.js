// Main entry point - starts all 5 trading agents
require('dotenv').config();

const orderExecutionAgent = require('./agents/order-execution-agent');
const marketDataAgent = require('./agents/market-data-agent');
const portfolioMonitorAgent = require('./agents/portfolio-monitor-agent');
const errorRecoveryAgent = require('./agents/error-recovery-agent');

let activeAgents = 0;
const agents = [
  { name: 'Order Execution', start: orderExecutionAgent.start },
  { name: 'Market Data', start: marketDataAgent.start },
  { name: 'Portfolio Monitor', start: portfolioMonitorAgent.start },
  { name: 'Error Recovery', start: errorRecoveryAgent.start },
];

async function startAllAgents() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   🚀 TRADING AGENTS ORCHESTRATION (Railway Production)      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Starting ${agents.length} agents...\n`);

  for (const agent of agents) {
    try {
      await agent.start();
      activeAgents++;
      console.log(`✅ ${agent.name} Agent started successfully`);
    } catch (error) {
      console.error(`❌ ${agent.name} Agent failed to start:`, error.message);
    }
  }

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║   ✨ ${activeAgents}/${agents.length} Agents Running                                      ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  if (activeAgents === agents.length) {
    console.log('🎯 All agents operational. System ready for trading.\n');
  } else if (activeAgents === 0) {
    console.error('🚨 CRITICAL: No agents started. Check logs above.\n');
    process.exit(1);
  } else {
    console.warn(`⚠️  Warning: Only ${activeAgents} of ${agents.length} agents started.\n`);
  }
}

// Start orchestration
startAllAgents().catch(error => {
  console.error('❌ Fatal error during startup:', error);
  process.exit(1);
});

// Graceful shutdown for all agents
process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Initiating graceful shutdown...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Initiating graceful shutdown...');
  process.exit(0);
});
