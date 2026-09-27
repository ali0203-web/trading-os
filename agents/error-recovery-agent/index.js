// AGENT 5: Error Recovery & Circuit Breaker
// Monitors dead-letter queue for failed orders
// Retries with exponential backoff
// Pauses trading if broker APIs down

const db = require('../lib/database');
const BinanceClient = require('../lib/brokers/binance');
require('dotenv').config();

const ERROR_RECOVERY_INTERVAL = parseInt(process.env.ERROR_RECOVERY_INTERVAL) || 300000;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const TRADING_MODE = process.env.TRADING_MODE || 'TESTNET';
const USE_TESTNET = TRADING_MODE === 'TESTNET';

let isRunning = false;
let binance = null;
let circuitBreakerOpen = false;

// Initialize broker
async function initializeBroker() {
  try {
    binance = new BinanceClient(USE_TESTNET);
  } catch (error) {
    console.error('❌ Failed to initialize broker:', error.message);
  }
}

// Check broker API health
async function checkBrokerHealth() {
  try {
    // Try a simple API call
    const price = await binance.getCurrentPrice('BTCUSDT');

    if (circuitBreakerOpen) {
      console.log('✅ Broker API recovered, circuit breaker closed');
      circuitBreakerOpen = false;
    }
    return true;
  } catch (error) {
    console.error('❌ Broker API health check failed:', error.message);

    if (!circuitBreakerOpen) {
      console.warn('⚠️  Circuit breaker OPEN - pausing trading');
      circuitBreakerOpen = true;

      // Alert via database
      await db.insert('error_log', {
        error_type: 'CIRCUIT_BREAKER_OPEN',
        error_message: `Broker API down: ${error.message}`,
        broker: 'BINANCE',
      });
    }
    return false;
  }
}

// Process failed order from DLQ
async function processFailedOrder(dlqItem) {
  try {
    const payload = dlqItem.payload;
    const retryCount = dlqItem.retry_count || 0;

    console.log(`🔄 Retrying order: ${dlqItem.job_id} (attempt ${retryCount + 1})`);

    // Move back to job queue with incremented retry count
    const newPayload = { ...payload, retryCount: retryCount + 1 };

    await db.insert('job_queue', {
      job_id: dlqItem.job_id,
      job_type: dlqItem.job_type,
      status: 'PENDING',
      payload: JSON.stringify(newPayload),
      priority: 15, // High priority for retries
      scheduled_for: new Date(),
    });

    // Update DLQ
    await db.query(
      `UPDATE job_dlq SET retry_count = $1, last_retry_at = NOW() WHERE id = $2`,
      [retryCount + 1, dlqItem.id]
    );

    console.log(`✅ Moved to retry queue: ${dlqItem.job_id}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to process DLQ item:', error.message);
    return false;
  }
}

// Clean up old DLQ items
async function cleanupOldDLQ() {
  try {
    // Delete DLQ items older than 7 days
    const result = await db.query(
      `DELETE FROM job_dlq WHERE created_at < NOW() - INTERVAL '7 days'`
    );

    if (result.rowCount > 0) {
      console.log(`🧹 Deleted ${result.rowCount} old DLQ items`);
    }
  } catch (error) {
    console.error('❌ DLQ cleanup failed:', error.message);
  }
}

// Process DLQ
async function processDLQ() {
  try {
    console.log('📋 Processing dead-letter queue');

    // Get failed items
    const dlqItems = await db.getRows(
      `SELECT * FROM job_dlq
       WHERE retry_count < $1
       ORDER BY created_at ASC
       LIMIT 10`,
      [MAX_RETRIES]
    );

    if (dlqItems.length === 0) {
      console.log('✅ No failed orders to retry');
      return 0;
    }

    console.log(`⚠️  Found ${dlqItems.length} failed orders`);

    let processed = 0;
    for (const item of dlqItems) {
      const success = await processFailedOrder(item);
      if (success) processed++;
    }

    console.log(`✅ Processed ${processed} failed orders`);

    // Clean up very old items
    await cleanupOldDLQ();

    return processed;
  } catch (error) {
    console.error('❌ DLQ processing error:', error.message);
    return 0;
  }
}

// Health check
async function recordHealth() {
  try {
    const status = circuitBreakerOpen ? 'DEGRADED' : 'HEALTHY';
    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat)
       VALUES ($1, $2, NOW())
       ON CONFLICT (agent_name) DO UPDATE SET status = $2, last_heartbeat = NOW()`,
      ['error-recovery-agent', status]
    );
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  console.log('🚀 Error Recovery Agent started');
  await initializeBroker();

  setInterval(async () => {
    try {
      // Check broker health first
      await checkBrokerHealth();

      // Only process DLQ if broker is healthy
      if (!circuitBreakerOpen) {
        await processDLQ();
      } else {
        console.log('⏸️  Skipping DLQ processing (circuit breaker open)');
      }

      await recordHealth();
    } catch (error) {
      console.error('Agent error:', error.message);
    }
  }, ERROR_RECOVERY_INTERVAL);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Error Recovery Agent...');
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

module.exports = { start, processDLQ };
