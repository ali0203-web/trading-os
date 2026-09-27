const path = require('path');
// AGENT 9: Queue Manager
// Manages PostgreSQL job queue and dead-letter queue
// Handles job lifecycle and cleanup
// Market-hour aware scheduling
// Replaces SQS + EventBridge ($4/month)

const db = require(path.join(__dirname, '..', '..', 'lib', 'database'));
require('dotenv').config();

const QUEUE_CLEANUP_INTERVAL = 300000; // 5 minutes
let isRunning = false;

// Get queue statistics
async function getQueueStats() {
  try {
    const stats = await db.getRow(
      `SELECT
        (SELECT COUNT(*) FROM job_queue WHERE status = 'PENDING') as pending,
        (SELECT COUNT(*) FROM job_queue WHERE status = 'PROCESSING') as processing,
        (SELECT COUNT(*) FROM job_queue WHERE status = 'COMPLETED') as completed,
        (SELECT COUNT(*) FROM job_queue WHERE status = 'FAILED') as failed,
        (SELECT COUNT(*) FROM job_dlq) as dlq_count`
    );

    return stats;
  } catch (error) {
    console.error('❌ Failed to get queue stats:', error.message);
    return null;
  }
}

// Get pending jobs
async function getPendingJobs(limit = 20) {
  try {
    const jobs = await db.getRows(
      `SELECT id, job_id, job_type, status, priority, scheduled_for
       FROM job_queue
       WHERE status = 'PENDING'
       AND (scheduled_for IS NULL OR scheduled_for <= NOW())
       ORDER BY priority DESC, scheduled_for ASC
       LIMIT $1`,
      [limit]
    );

    return jobs;
  } catch (error) {
    console.error('❌ Failed to get pending jobs:', error.message);
    return [];
  }
}

// Check if within market hours
function isMarketHours() {
  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const day = now.getUTCDay();

  // Monday (1) to Friday (5), 14:30 UTC to 21:00 UTC
  if (day === 0 || day === 6) return false; // Weekend

  const currentTime = hours * 100 + minutes;
  return currentTime >= 1430 && currentTime <= 2100;
}

// Cleanup completed jobs
async function cleanupCompletedJobs() {
  try {
    // Delete completed jobs older than 7 days
    const result = await db.query(
      `DELETE FROM job_queue
       WHERE status = 'COMPLETED'
       AND completed_at < NOW() - INTERVAL '7 days'`
    );

    if (result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} completed jobs`);
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Cleanup stale jobs
async function cleanupStaleJobs() {
  try {
    // Find jobs stuck in PROCESSING for > 30 minutes
    const staleJobs = await db.getRows(
      `SELECT id, job_id FROM job_queue
       WHERE status = 'PROCESSING'
       AND started_at < NOW() - INTERVAL '30 minutes'`
    );

    for (const job of staleJobs) {
      await db.query(
        `UPDATE job_queue SET status = 'FAILED' WHERE id = $1`,
        [job.id]
      );

      console.warn(`⚠️  Marked stale job as failed: ${job.job_id}`);
    }

    return staleJobs.length;
  } catch (error) {
    console.error('❌ Stale job cleanup failed:', error.message);
    return 0;
  }
}

// Pause trading during off-hours
async function handleMarketHours() {
  try {
    if (!isMarketHours()) {
      // Pause any order execution jobs
      await db.query(
        `UPDATE job_queue SET status = 'PENDING', scheduled_for = NOW() + INTERVAL '1 hour'
         WHERE status = 'PENDING' AND job_type = 'EXECUTE_ORDER'
         AND scheduled_for > NOW()`
      );

      console.log('🌙 Market closed, paused order execution until market open');
      return;
    }

    // Resume paused jobs
    const resumedCount = await db.query(
      `UPDATE job_queue SET scheduled_for = NOW()
       WHERE status = 'PENDING' AND job_type = 'EXECUTE_ORDER'
       AND scheduled_for IS NOT NULL`
    );

    if (resumedCount.rowCount > 0) {
      console.log(`☀️  Market open, resumed ${resumedCount.rowCount} orders`);
    }
  } catch (error) {
    console.error('❌ Market hours handling failed:', error.message);
  }
}

// Print queue status
async function printQueueStatus() {
  try {
    const stats = await getQueueStats();
    if (!stats) return;

    console.log('\n📊 JOB QUEUE STATUS');
    console.log(`  Pending:           ${stats.pending}`);
    console.log(`  Processing:        ${stats.processing}`);
    console.log(`  Completed:         ${stats.completed}`);
    console.log(`  Failed:            ${stats.failed}`);
    console.log(`  Dead-Letter Queue: ${stats.dlq_count}`);
    console.log(`  Market Hours:      ${isMarketHours() ? '✅ Open' : '🌙 Closed'}`);

    const pending = await getPendingJobs(5);
    if (pending.length > 0) {
      console.log(`\n  Next jobs:`);
      pending.forEach(job => {
        const scheduled = job.scheduled_for
          ? new Date(job.scheduled_for).toLocaleTimeString()
          : 'NOW';
        console.log(`    - ${job.job_type} (${scheduled})`);
      });
    }
  } catch (error) {
    console.error('❌ Status print failed:', error.message);
  }
}

// Health check
async function recordHealth() {
  try {
    const stats = await getQueueStats();
    const totalJobs = (stats.pending || 0) + (stats.processing || 0);

    await db.query(
      `INSERT INTO agent_health (agent_name, status, last_heartbeat, processed_jobs)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (agent_name) DO UPDATE SET
         status = $2,
         last_heartbeat = NOW(),
         processed_jobs = $3`,
      ['queue-manager', 'HEALTHY', totalJobs]
    );
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Start agent
async function start() {
  if (isRunning) return;
  isRunning = true;

  console.log('🚀 Queue Manager started');

  // Cleanup every 5 minutes
  setInterval(async () => {
    try {
      await cleanupCompletedJobs();
      await cleanupStaleJobs();
      await handleMarketHours();
      await recordHealth();
    } catch (error) {
      console.error('Queue management error:', error.message);
    }
  }, QUEUE_CLEANUP_INTERVAL);

  // Print status every minute
  setInterval(printQueueStatus, 60000);

  // Initial status
  setTimeout(printQueueStatus, 1000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Queue Manager...');
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

module.exports = { start, getQueueStats };
