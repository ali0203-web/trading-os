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
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const INITIAL_BACKOFF = parseInt(process.env.INITIAL_BACKOFF) || 1000;
const MAX_BACKOFF = parseInt(process.env.MAX_BACKOFF) || 30000;

let binance = null;
let isRunning = false;
let executedOrdersCount = 0;
let failedOrdersCount = 0;

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

// Execute single order with full error handling and notifications
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
      `INSERT INTO executions (order_id, symbol, side, quantity, executed_price, executed_at, broker, execution_id, commission)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)`,
      [
        payload.orderId,
        payload.symbol,
        payload.side,
        payload.quantity,
        result.price || 0,
        payload.broker,
        result.orderId,
        payload.commission || 0,
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

    // Update position (handle both new and existing positions)
    await client.query(
      `INSERT INTO positions (symbol, broker, quantity, average_cost, current_price, last_updated)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (symbol, broker) DO UPDATE SET
         quantity = positions.quantity + EXCLUDED.quantity,
         current_price = EXCLUDED.current_price,
         last_updated = NOW()`,
      [payload.symbol, payload.broker, payload.quantity, result.price || 0, result.price || 0]
    );

    await client.query('COMMIT');
    executedOrdersCount++;
    console.log(`✅ Order executed successfully: ${result.orderId} | Total executed: ${executedOrdersCount}`);

    // Send Discord notification on success
    if (process.env.DISCORD_WEBHOOK_URL) {
      sendDiscordNotification('ORDER_EXECUTED', {
        symbol: payload.symbol,
        side: payload.side,
        quantity: payload.quantity,
        price: result.price,
        orderId: result.orderId,
      }).catch(err => console.warn('Discord notification failed:', err.message));
    }

  } catch (error) {
    await client.query('ROLLBACK');
    failedOrdersCount++;

    console.error(`❌ Order execution failed: ${error.message}`);

    // Log error to database
    try {
      await db.insert('error_log', {
        order_id: job.payload.orderId || null,
        error_type: error.name || 'EXECUTION_ERROR',
        error_message: error.message,
        broker: job.payload.broker,
        recovery_attempted: false,
        retry_count: job.payload.retryCount || 0,
      });
    } catch (dbErr) {
      console.error('Failed to log error:', dbErr.message);
    }

    // Move to DLQ if max retries exceeded
    if ((job.payload.retryCount || 0) >= MAX_RETRIES) {
      console.log(`❌ Max retries exceeded for order ${job.payload.orderId}, moving to DLQ`);

      try {
        await db.query(
          `INSERT INTO job_dlq (job_id, job_type, payload, error_message, retry_count, max_retries)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [job.job_id, job.job_type, JSON.stringify(job.payload), error.message, job.payload.retryCount || 0, MAX_RETRIES]
        );

        await db.query(
          `UPDATE job_queue SET status = 'FAILED' WHERE id = $1`,
          [job.id]
        );
      } catch (dlqErr) {
        console.error('Failed to move order to DLQ:', dlqErr.message);
      }

      // Send Discord alert for failed order
      if (process.env.DISCORD_WEBHOOK_URL) {
        sendDiscordNotification('ORDER_FAILED', {
          symbol: job.payload.symbol,
          orderId: job.payload.orderId,
          error: error.message,
          retries: job.payload.retryCount,
        }).catch(err => console.warn('Discord alert failed:', err.message));
      }
    } else {
      // Retry with exponential backoff
      const retryCount = (job.payload.retryCount || 0) + 1;
      const backoff = Math.min(
        INITIAL_BACKOFF * Math.pow(2, retryCount),
        MAX_BACKOFF
      );

      const newPayload = { ...job.payload, retryCount };
      try {
        await db.query(
          `UPDATE job_queue
           SET status = 'PENDING',
               payload = $1,
               scheduled_for = NOW() + ($2 || '0 seconds'::interval)
           WHERE id = $3`,
          [JSON.stringify(newPayload), `${backoff}ms`, job.id]
        );
        console.log(`⏳ Order retry ${retryCount}/${MAX_RETRIES} scheduled in ${backoff}ms`);
      } catch (retryErr) {
        console.error('Failed to reschedule retry:', retryErr.message);
      }
    }

  } finally {
    client.release();
  }
}

// Send Discord notification
async function sendDiscordNotification(eventType, data) {
  const axios = require('axios');

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const embeds = [];

  if (eventType === 'ORDER_EXECUTED') {
    embeds.push({
      color: 0x00ff00,
      title: '✅ Order Executed',
      fields: [
        { name: 'Symbol', value: data.symbol, inline: true },
        { name: 'Side', value: data.side, inline: true },
        { name: 'Quantity', value: String(data.quantity), inline: true },
        { name: 'Price', value: String(data.price), inline: true },
        { name: 'Order ID', value: data.orderId, inline: false },
      ],
      timestamp: new Date().toISOString(),
    });
  } else if (eventType === 'ORDER_FAILED') {
    embeds.push({
      color: 0xff0000,
      title: '❌ Order Failed',
      fields: [
        { name: 'Symbol', value: data.symbol, inline: true },
        { name: 'Order ID', value: data.orderId, inline: true },
        { name: 'Error', value: data.error, inline: false },
        { name: 'Retries', value: `${data.retries}/${MAX_RETRIES}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await axios.post(webhookUrl, { embeds });
  } catch (error) {
    console.warn('Failed to send Discord notification:', error.message);
  }
}

// Health check with detailed metrics
async function recordHealth() {
  try {
    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat, processed_jobs, failed_jobs, avg_latency_ms, updated_at)
       VALUES ($1, $2, NOW(), $3, $4, $5, NOW())
       ON CONFLICT (agent_name) DO UPDATE SET
         status = $2,
         last_heartbeat = NOW(),
         processed_jobs = agent_health.processed_jobs + $3,
         failed_jobs = agent_health.failed_jobs + $4,
         updated_at = NOW()`,
      ['order-execution-agent', isRunning ? 'HEALTHY' : 'OFFLINE', 1, 0, 0]
    );
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  try {
    console.log('\n🚀 Starting Order Execution Agent...');
    console.log(`   Mode: ${USE_TESTNET ? 'TESTNET' : 'PRODUCTION'}`);
    console.log(`   Execution Interval: ${ORDER_EXECUTION_INTERVAL}ms`);
    console.log(`   Max Retries: ${MAX_RETRIES}`);

    await initializeBrokers();
    await recordHealth();

    console.log('✅ Order Execution Agent ready');

    // Main execution loop
    const executionInterval = setInterval(async () => {
      try {
        await executeOrders();
        await recordHealth();
      } catch (error) {
        console.error('❌ Execution loop error:', error.message);
        failedOrdersCount++;
      }
    }, ORDER_EXECUTION_INTERVAL);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down Order Execution Agent...');
      isRunning = false;
      clearInterval(executionInterval);
      if (binance) binance.closeWebSocket();
      await db.shutdown();
      console.log('✅ Agent shutdown complete');
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Order Execution Agent (SIGINT)...');
      isRunning = false;
      clearInterval(executionInterval);
      if (binance) binance.closeWebSocket();
      await db.shutdown();
      console.log('✅ Agent shutdown complete');
      process.exit(0);
    });

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

module.exports = { start, executeOrders };
