const { spawn } = require('child_process');
const path = require('path');

const agents = [
  { name: 'Order Execution', path: 'agents/order-execution-agent' },
  { name: 'Market Data', path: 'agents/market-data-agent' },
  { name: 'Portfolio Monitor', path: 'agents/portfolio-monitor-agent' },
  { name: 'Error Recovery', path: 'agents/error-recovery-agent' },
  { name: 'Reconciliation', path: 'agents/reconciliation-agent' },
  { name: 'Notifications', path: 'agents/notification-agent' },
  { name: 'Monitoring', path: 'agents/monitoring-agent' },
  { name: 'Queue Manager', path: 'agents/queue-manager' }
];

const processes = [];

console.log(`🚀 Starting ${agents.length} agents on Railway...\n`);

agents.forEach(agent => {
  const proc = spawn('node', [path.join(__dirname, agent.path, 'index.js')], {
    stdio: 'inherit',
    env: process.env
  });

  processes.push({ name: agent.name, process: proc });
  console.log(`✅ ${agent.name} Agent started (PID: ${proc.pid})`);
});

console.log(`\n✨ ${agents.length}/8 Agents Running\n`);

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down all agents...');
  processes.forEach(({ name, process: proc }) => {
    console.log(`Stopping ${name}...`);
    proc.kill('SIGTERM');
  });
  
  setTimeout(() => {
    console.log('✅ All agents stopped');
    process.exit(0);
  }, 5000);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Interrupt received, shutting down...');
  processes.forEach(({ process: proc }) => proc.kill());
  process.exit(0);
});
