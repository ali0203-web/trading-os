const { Pool } = require('pg');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class ReconciliationAgent {
  constructor() {
    this.name = 'Reconciliation Agent';
  }

  async start() {
    console.log(`🔄 ${this.name} started`);
    await this.registerHealth();
    setInterval(() => this.dailyReconciliation(), 24 * 60 * 60 * 1000);
    await this.dailyReconciliation();
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

  async dailyReconciliation() {
    try {
      console.log(`📊 Daily reconciliation at ${new Date().toISOString()}`);
      
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const orders = (await pool.query(`SELECT * FROM orders WHERE created_at >= $1`, [yesterday])).rows;
      const executions = (await pool.query(`SELECT * FROM executions WHERE created_at >= $1`, [yesterday])).rows;
      
      const executedIds = new Set(executions.map(e => e.order_id));
      const unmatched = orders.filter(o => !executedIds.has(o.id)).length;
      const pnl = executions.reduce((sum, e) => sum + (e.realized_pnl || 0), 0);
      const portfolio = (await pool.query(`SELECT SUM(quantity * current_price) as total FROM positions WHERE quantity != 0`)).rows[0];

      const report = {
        id: uuidv4(),
        date: new Date().toISOString().split('T')[0],
        total_orders: orders.length,
        executed: executions.length,
        unmatched,
        pnl_total: pnl,
        portfolio_value: portfolio?.total || 0
      };

      await pool.query(`INSERT INTO daily_reports (report_date, report_data) VALUES ($1, $2)`, [report.date, JSON.stringify(report)]);
      await this.sendDiscordAlert(report);
      await this.updateHealth('HEALTHY', 'Reconciliation complete');
      console.log(`✅ Reconciliation: ${orders.length} orders, ${executions.length} exec, P&L: $${pnl.toFixed(2)}`);
    } catch (error) {
      console.error('❌ Reconciliation error:', error.message);
      await this.updateHealth('ERROR', error.message);
    }
  }

  async sendDiscordAlert(report) {
    try {
      const webhook = process.env.DISCORD_WEBHOOK;
      if (!webhook) return;
      await axios.post(webhook, {
        embeds: [{
          title: `📊 Daily Reconciliation - ${report.date}`,
          color: report.pnl_total >= 0 ? 0x00ff00 : 0xff0000,
          fields: [
            { name: 'Orders', value: `${report.total_orders}`, inline: true },
            { name: 'Executed', value: `${report.executed}`, inline: true },
            { name: 'P&L', value: `$${report.pnl_total.toFixed(2)}`, inline: true }
          ]
        }]
      });
    } catch (error) {
      console.error('Discord alert failed:', error.message);
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

const agent = new ReconciliationAgent();
agent.start().catch(console.error);

process.on('SIGTERM', () => {
  console.log('🛑 Reconciliation Agent shutting down');
  pool.end();
  process.exit(0);
});
