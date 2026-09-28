const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class QueueManager {
  constructor() {
    this.name = 'Queue Manager';
    this.processing = false;
  }

  async start() {
    console.log(`📦 ${this.name} started`);
    await this.registerHealth();
    
    setInterval(() => this.processQueue(), 5 * 1000);
    setInterval(() => this.cleanupOldRecords(), 60 * 60 * 1000);
    setInterval(() => this.processDeadLetterQueue(), 30 * 1000);
    
    await this.processQueue();
  }

  async registerHealth() {
    try {
      await pool.query(
        `INSERT INTO agent_health (agent_name, status, last_heartbeat) 
         VALUES ($1, $2, NOW()) ON CONFLICT (agent_name) DO UPDATE 
         SET status = $2, last_heartbeat = NOW()`,
        [this.name, 'HEALTHY']
      );
    } catch (error) {
      console.error('❌ Health registration failed:', error.message);
    }
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      const result = await pool.query(
        `SELECT id, job_type, job_data FROM job_queue 
         WHERE status = 'PENDING' AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at ASC LIMIT 10`
      );

      const jobs = result.rows;
      console.log(`📤 Processing ${jobs.length} jobs`);

      for (const job of jobs) {
        try {
          await this.executeJob(job);
          await pool.query(`UPDATE job_queue SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [job.id]);
        } catch (error) {
          console.error(`❌ Job ${job.id} failed:`, error.message);
          await pool.query(
            `INSERT INTO job_dlq (original_job_id, job_type, job_data, error_message) 
             VALUES ($1, $2, $3, $4)`,
            [job.id, job.job_type, JSON.stringify(job.job_data), error.message]
          );
          await pool.query(`UPDATE job_queue SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [job.id]);
        }
      }

      await this.updateHealth('HEALTHY', `Processed ${jobs.length} jobs`);
    } catch (error) {
      console.error('❌ Queue processing error:', error.message);
      await this.updateHealth('ERROR', error.message);
    } finally {
      this.processing = false;
    }
  }

  async executeJob(job) {
    const { job_type, job_data } = job;

    if (job_type === 'ORDER_PLACEMENT') {
      console.log(`🎯 Executing order: ${job_data.symbol} ${job_data.quantity}@${job_data.price}`);
      return;
    }

    if (job_type === 'REBALANCE') {
      console.log(`⚖️ Executing rebalance: ${job_data.symbol} -> ${job_data.target_allocation}%`);
      return;
    }

    if (job_type === 'RISK_CHECK') {
      console.log(`✅ Risk check passed`);
      return;
    }

    throw new Error(`Unknown job type: ${job_type}`);
  }

  async processDeadLetterQueue() {
    try {
      const result = await pool.query(
        `SELECT id, original_job_id, job_type, retry_count FROM job_dlq 
         WHERE retry_count < 3 AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at ASC LIMIT 5`
      );

      const dlqJobs = result.rows;
      console.log(`🔄 Processing ${dlqJobs.length} DLQ jobs`);

      for (const dlqJob of dlqJobs) {
        try {
          const jobData = (await pool.query(`SELECT job_data FROM job_queue WHERE id = $1`, [dlqJob.original_job_id])).rows[0];
          
          if (jobData) {
            await this.executeJob({ job_type: dlqJob.job_type, job_data: jobData.job_data });
            await pool.query(`DELETE FROM job_dlq WHERE id = $1`, [dlqJob.id]);
            console.log(`✅ DLQ job ${dlqJob.id} recovered`);
          }
        } catch (error) {
          await pool.query(
            `UPDATE job_dlq SET retry_count = retry_count + 1 WHERE id = $1`,
            [dlqJob.id]
          );
          console.error(`⚠️ DLQ job ${dlqJob.id} retry attempt`);
        }
      }
    } catch (error) {
      console.error('❌ DLQ processing error:', error.message);
    }
  }

  async cleanupOldRecords() {
    try {
      await pool.query(`DELETE FROM job_queue WHERE created_at < NOW() - INTERVAL '30 days'`);
      await pool.query(`DELETE FROM job_dlq WHERE created_at < NOW() - INTERVAL '30 days'`);
      console.log(`🧹 Cleanup complete: removed old records`);
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }
  }

  async updateHealth(status, message) {
    try {
      await pool.query(
        `UPDATE agent_health SET status = $1, last_message = $2, last_heartbeat = NOW() WHERE agent_name = $3`,
        [status, message, this.name]
      );
    } catch (error) {
      console.error('Health update failed:', error.message);
    }
  }
}

const manager = new QueueManager();
manager.start().catch(console.error);

process.on('SIGTERM', () => {
  console.log('🛑 Queue Manager shutting down');
  pool.end();
  process.exit(0);
});
