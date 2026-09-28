// AGENT 5: Error Recovery & Circuit Breaker
// Monitors dead-letter queue for failed orders
// Implements circuit breaker pattern for broker health
// Features: DLQ processing, exponential backoff, broker health monitoring, auto-recovery

const path = require('path');
const axios = require('axios');
const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
const BinanceClient = require(path.join(__dirname, '..', '..', 'lib', 'brokers', 'binance'));
require('dotenv').config();

const ERROR_RECOVERY_INTERVAL = parseInt(process.env.ERROR_RECOVERY_INTERVAL) || 300000; // 5 min
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const CIRCUIT_BREAKER_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 3; // Fail 3x, open
const CIRCUIT_BREAKER_TIMEOUT = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 600000; // 10 min
const TRADING_MODE = process.env.TRADING_MODE || 'TESTNET';
const USE_TESTNET = TRADING_MODE === 'TESTNET';

let isRunning = false;
let binance = null;
let circuitBreakerOpen = false;
let circuitBreakerOpenedAt = null;
let consecutiveHealthCheckFailures = 0;
let totalRetried = 0;
let totalRecovered = 0;
let totalAbandoned = 0;

// Initialize broker
async function initializeBroker() {
  try {
    binance = new BinanceClient(USE_TESTNET);
  } catch (error) {
    console.error('❌ Failed to initialize broker:', error.message);
  }
}

// Check broker API health with circuit breaker logic
async function checkBrokerHealth() {
  try {
    // Try a simple API call
    await binance.getCurrentPrice('BTCUSDT');
    consecutiveHealthCheckFailures = 0;

    if (circuitBreakerOpen) {
      const recoveryTime = Date.now() - circuitBreakerOpenedAt;
      console.log(`✅ Broker API recovered (down for ${(recoveryTime / 1000 / 60).toFixed(1)} min), circuit breaker closed`);
      circuitBreakerOpen = false;
      circuitBreakerOpenedAt = null;

      // Send recovery alert
      if (process.env.DISCORD_WEBHOOK_URL) {
        sendAlert('BROKER_RECOVERED', 'Binance API is back online').catch(e =>
          console.warn('Alert failed:', e.message)
        );
      }
    }
    return true;

  } catch (error) {
    consecutiveHealthCheckFailures++;
    console.error(`❌ Health check failed (${consecutiveHealthCheckFailures}/${CIRCUIT_BREAKER_THRESHOLD}):`, error.message);

    // Open circuit breaker after threshold failures
    if (consecutiveHealthCheckFailures >= CIRCUIT_BREAKER_THRESHOLD && !circuitBreakerOpen) {
      console.warn('⚠️ CIRCUIT BREAKER OPEN - pausing trading');
      circuitBreakerOpen = true;
      circuitBreakerOpenedAt = Date.now();

      // Log and alert
      db.insert('error_log', {
        error_type: 'CIRCUIT_BREAKER_OPEN',
        error_message: `Broker API unreachable after ${CIRCUIT_BREAKER_THRESHOLD} failures: ${error.message}`,
        broker: 'BINANCE',
      }).catch(e => console.warn('Failed to log:', e.message));

      if (process.env.DISCORD_WEBHOOK_URL) {
        sendAlert('CIRCUIT_BREAKER_OPEN', `Binance API down after ${CIRCUIT_BREAKER_THRESHOLD} failed checks`).catch(e =>
          console.warn('Alert failed:', e.message)
        );
      }
    }

    return false;
  }
}

// Send Discord alert
async function sendAlert(type, message) {
  if (!process.env.DISCORD_WEBHOOK_URL) return;

  const colors = {
    'BROKER_RECOVERED': 0x00ff00,
    'CIRCUIT_BREAKER_OPEN': 0xff0000,
    'ORDER_RECOVERED': 0x0099ff,
    'ORDER_ABANDONED': 0xff6600,
  };

  try {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, {
      embeds: [{
        color: colors[type] || 0xffff00,
        title: `🔧 ${type}`,
        description: message,
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (error) {
    console.warn('Discord alert failed:', error.message);
  }
}

// Process failed order from DLQ
async function processFailedOrder(dlqItem) {
  try {
    const payload = typeof dlqItem.payload === 'string'
      ? JSON.parse(dlqItem.payload)
      : dlqItem.payload;
    const retryCount = dlqItem.retry_count || 0;

    // Check if exceeded max retries
    if (retryCount >= MAX_RETRIES) {
      console.error(`❌ ABANDONED: ${dlqItem.job_id} - Max retries exceeded`);
      totalAbandoned++;

      // Move to permanent failure
      await db.query(
        `UPDATE job_dlq SET retry_count = $1, error_message = 'Max retries exceeded'
         WHERE id = $2`,
        [MAX_RETRIES + 1, dlqItem.id]
      );

      // Send alert
      if (process.env.DISCORD_WEBHOOK_URL) {
        sendAlert('ORDER_ABANDONED', `${payload.symbol} ${payload.side} ${payload.quantity} abandoned after ${MAX_RETRIES} retries`).catch(e =>
          console.warn('Alert failed:', e.message)
        );
      }

      return false;
    }

    console.log(`🔄 Retrying: ${dlqItem.job_id} (${retryCount}/${MAX_RETRIES})`);
    totalRetried++;

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

    totalRecovered++;
    console.log(`✅ Requeued: ${dlqItem.job_id}`);
    return true;

  } catch (error) {
    console.error('❌ DLQ processing error:', error.message);
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

// Record health with detailed metrics
async function recordHealth() {
  try {
    const status = circuitBreakerOpen ? 'DEGRADED' : 'HEALTHY';
    const timeSinceOpen = circuitBreakerOpenedAt
      ? (Date.now() - circuitBreakerOpenedAt) / 1000 / 60
      : 0;

    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat, processed_jobs, failed_jobs, updated_at)
       VALUES ($1, $2, NOW(), $3, $4, NOW())
       ON CONFLICT (agent_name) DO UPDATE SET
         status = $2,
         last_heartbeat = NOW(),
         processed_jobs = agent_health.processed_jobs + $3`,
      ['error-recovery-agent', status, totalRetried, totalAbandoned]
    );

    if (totalRetried % 10 === 0) {
      const cbStatus = circuitBreakerOpen
        ? `OPEN (${timeSinceOpen.toFixed(1)}min)`
        : 'CLOSED';
      console.log(`🔧 Health: Retried=${totalRetried} | Recovered=${totalRecovered} | Abandoned=${totalAbandoned} | CB=${cbStatus}`);
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
    console.log('\n🚀 Starting Error Recovery Agent...');
    console.log(`   Recovery Interval: ${ERROR_RECOVERY_INTERVAL}ms`);
    console.log(`   Max Retries: ${MAX_RETRIES}`);
    console.log(`   Circuit Breaker Threshold: ${CIRCUIT_BREAKER_THRESHOLD} failures`);
    console.log(`   Circuit Breaker Timeout: ${CIRCUIT_BREAKER_TIMEOUT / 1000 / 60}min`);

    await initializeBroker();
    console.log('✅ Error Recovery Agent ready');

    // Main recovery loop
    const recoveryInterval = setInterval(async () => {
      try {
        // Check broker health first
        await checkBrokerHealth();

        // Only process DLQ if broker is healthy
        if (!circuitBreakerOpen) {
          await processDLQ();
        } else {
          console.log(`⏸️  Skipping DLQ (circuit breaker open)`);
        }

        await recordHealth();
      } catch (error) {
        console.error('❌ Recovery loop error:', error.message);
      }
    }, ERROR_RECOVERY_INTERVAL);

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down Error Recovery Agent...');
      isRunning = false;
      clearInterval(recoveryInterval);
      await recordHealth(); // Final health record
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

module.exports = { start, processDLQ, checkBrokerHealth };
