// AGENT 1: Order Execution Engine
// Executes pending orders from PostgreSQL queue via Binance/IB APIs
// Runs continuously, checking queue every ORDER_EXECUTION_INTERVAL ms

const path = require('path');
const db = require(path.join(__dirname, '../../lib/database'));
const BinanceClient = require(path.join(__dirname, '../../lib/brokers/binance'));
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const ORDER_EXECUTION_INTERVAL = parseInt(process.env.ORDER_EXECUTION_INTERVAL) || 5000;
const TRADING_MODE = process.env.TRADING_MODE || 'TESTNET';
const USE_TESTNET = TRADING_MODE === 'TESTNET';

let binance = null;
let isRunning = false;

// Initialize broker clients
async function initializeBrokers() {
  try {
    binance = new BinanceClient(USE_TESTNET);
    console.log(`✅ Binance client initialized (${USE_TESTNET ? 'TESTNET' : 'PRODUCTION'})`);
  } catch (error) {
    console.error('❌ Failed to initialize brokers:', error.message);
    throw error;
  }
}

// Main execution loop
async function executeOrders() {
  try {
    // Get pending orders from job queue
    const pendingOrders = await db.getRows(
      `SELECT * FROM job_queue
       WHERE status = 'PENDING' AND job_type = 'EXECUTE_ORDER'
       ORDER BY priority DESC, scheduled_for ASC
       LIMIT 10`
    );

    if (pendingOrders.length === 0) {
      return; // No orders to execute
    }

    console.log(`📋 Processing ${pendingOrders.length} pending orders`);

    for (const job of pendingOrders) {
      await executeOrder(job);
    }
  } catch (error) {
    console.error('❌ Order execution loop error:', error.message);
  }
}

// Execute single order
async function executeOrder(job) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Update job status to PROCESSING
    await client.query(
      `UPDATE job_queue SET status = 'PROCESSING', started_at = NOW() WHERE id = $1`,
      [job.id]
    );

    const payload = job.payload;
    console.log(`🔄 Executing order: ${payload.symbol} ${payload.side} ${payload.quantity}`);

    // Execute via appropriate broker
    let result;
    if (payload.broker === 'BINANCE') {
      result = await binance.placeOrder(
        payload.symbol,
        payload.side,
        payload.quantity,
        payload.orderType || 'MARKET',
        payload.price || null
      );
    } else {
      throw new Error(`Unknown broker: ${payload.broker}`);
    }

    // Record execution in database
    await client.query(
      `INSERT INTO executions (order_id, symbol, side, quantity, executed_price, executed_at, broker, execution_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [
        payload.orderId,
        payload.symbol,
        payload.side,
        payload.quantity,
        result.price || 0,
        payload.broker,
        result.orderId,
      ]
    );

    // Update order status
    await client.query(
      `UPDATE orders SET status = 'FILLED', updated_at = NOW() WHERE order_id = $1`,
      [payload.orderId]
    );

    // Mark job as completed
    await client.query(
      `UPDATE job_queue SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
      [job.id]
    );

    // Update position
    await client.query(
      `INSERT INTO positions (symbol, broker, quantity, current_price, last_updated)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (symbol, broker) DO UPDATE SET
         quantity = positions.quantity + $3,
         current_price = $4,
         last_updated = NOW()`,
      [payload.symbol, payload.broker, payload.quantity, result.price || 0]
    );

    await client.query('COMMIT');
    console.log(`✅ Order executed successfully: ${result.orderId}`);

  } catch (error) {
    await client.query('ROLLBACK');

    console.error(`❌ Order execution failed: ${error.message}`);

    // Log error
    await db.insert('error_log', {
      order_id: job.payload.orderId,
      error_type: error.name || 'EXECUTION_ERROR',
      error_message: error.message,
      broker: job.payload.broker,
      retry_count: job.payload.retryCount || 0,
    });

    // Move to DLQ if max retries exceeded
    if ((job.payload.retryCount || 0) >= parseInt(process.env.MAX_RETRIES || 3)) {
      await db.query(
        `INSERT INTO job_dlq (job_id, job_type, payload, error_message, retry_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [job.job_id, job.job_type, JSON.stringify(job.payload), error.message, job.payload.retryCount || 0]
      );

      await db.query(
        `UPDATE job_queue SET status = 'FAILED' WHERE id = $1`,
        [job.id]
      );
    } else {
      // Retry with exponential backoff
      const retryCount = (job.payload.retryCount || 0) + 1;
      const backoff = Math.min(
        parseInt(process.env.INITIAL_BACKOFF || 1000) * Math.pow(2, retryCount),
        parseInt(process.env.MAX_BACKOFF || 30000)
      );

      const newPayload = { ...job.payload, retryCount };
      await db.query(
        `UPDATE job_queue SET status = 'PENDING', payload = $1, scheduled_for = NOW() + ($2 || 'ms')::interval
         WHERE id = $3`,
        [JSON.stringify(newPayload), backoff, job.id]
      );

      console.log(`⏳ Order retry scheduled in ${backoff}ms`);
    }

  } finally {
    client.release();
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
         last_heartbeat = NOW(),
         processed_jobs = agent_health.processed_jobs + 1`,
      ['order-execution-agent', 'HEALTHY', 1]
    );
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  console.log('🚀 Order Execution Agent started');
  await initializeBrokers();

  setInterval(async () => {
    try {
      await executeOrders();
      await recordHealth();
    } catch (error) {
      console.error('Agent error:', error.message);
    }
  }, ORDER_EXECUTION_INTERVAL);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down Order Execution Agent...');
    isRunning = false;
    if (binance) binance.closeWebSocket();
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

module.exports = { start, executeOrders };
