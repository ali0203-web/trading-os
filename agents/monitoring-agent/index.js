const { Pool } = require('pg');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class MonitoringAgent {
  constructor() {
    this.name = 'Monitoring Agent';
    this.startTime = Date.now();
  }

  async start() {
    console.log(`📊 ${this.name} started`);
    await this.registerHealth();
    
    setInterval(() => this.checkAgentHealth(), 5 * 60 * 1000);
    setInterval(() => this.generateMetrics(), 60 * 1000);
    setInterval(() => this.checkAnomalies(), 10 * 60 * 1000);
    
    await this.checkAgentHealth();
    await this.generateMetrics();
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

  async checkAgentHealth() {
    try {
      const result = await pool.query(`
        SELECT agent_name, status, last_heartbeat,
               EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat
        FROM agent_health
        ORDER BY last_heartbeat DESC
      `);

      const agents = result.rows;
      const unhealthy = agents.filter(a => a.seconds_since_heartbeat > 300);

      console.log(`✅ Health check: ${agents.length} agents, ${unhealthy.length} unhealthy`);

      for (const agent of agents) {
        await pool.query(
          `INSERT INTO agent_metrics (agent_name, metric_type, metric_value) 
           VALUES ($1, $2, $3)`,
          [agent.agent_name, 'uptime_seconds', agent.seconds_since_heartbeat]
        );
      }

      if (unhealthy.length > 0) {
        await this.sendHealthAlert(unhealthy);
      }

      await this.updateHealth('HEALTHY', `Checked ${agents.length} agents`);
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      await this.updateHealth('ERROR', error.message);
    }
  }

  async generateMetrics() {
    try {
      const orders = (await pool.query(`SELECT COUNT(*) as count FROM orders WHERE created_at > NOW() - INTERVAL '1 hour'`)).rows[0];
      const executions = (await pool.query(`SELECT COUNT(*) as count FROM executions WHERE created_at > NOW() - INTERVAL '1 hour'`)).rows[0];
      const errors = (await pool.query(`SELECT COUNT(*) as count FROM error_log WHERE created_at > NOW() - INTERVAL '1 hour'`)).rows[0];
      
      const metrics = {
        timestamp: new Date().toISOString(),
        orders_per_hour: orders.count,
        executions_per_hour: executions.count,
        errors_per_hour: errors.count,
        uptime_hours: (Date.now() - this.startTime) / (1000 * 60 * 60)
      };

      await pool.query(
        `INSERT INTO performance_metrics (metric_data) VALUES ($1)`,
        [JSON.stringify(metrics)]
      );

      console.log(`📈 Metrics: ${orders.count} orders/h, ${executions.count} exec/h, ${errors.count} errors/h`);
    } catch (error) {
      console.error('❌ Metrics generation failed:', error.message);
    }
  }

  async checkAnomalies() {
    try {
      const orders = (await pool.query(`SELECT COUNT(*) as count FROM orders WHERE created_at > NOW() - INTERVAL '1 hour'`)).rows[0];
      
      if (orders.count === 0) {
        const webhook = process.env.DISCORD_WEBHOOK;
        if (webhook) {
          await axios.post(webhook, {
            embeds: [{
              title: '⚠️ Anomaly Detected',
              description: 'No orders executed in the last hour',
              color: 0xff0000
            }]
          });
        }
      }

      console.log(`✅ Anomaly check complete`);
    } catch (error) {
      console.error('❌ Anomaly check failed:', error.message);
    }
  }

  async sendHealthAlert(unhealthy) {
    try {
      const webhook = process.env.DISCORD_WEBHOOK;
      if (!webhook) return;

      const description = unhealthy.map(a => `${a.agent_name}: ${a.status}`).join('\n');
      await axios.post(webhook, {
        embeds: [{
          title: '⚠️ Unhealthy Agents Detected',
          description,
          color: 0xff0000
        }]
      });
    } catch (error) {
      console.error('Health alert failed:', error.message);
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

const agent = new MonitoringAgent();
agent.start().catch(console.error);

process.on('SIGTERM', () => {
  console.log('🛑 Monitoring Agent shutting down');
  pool.end();
  process.exit(0);
});
