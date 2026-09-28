const { Pool } = require('pg');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class NotificationAgent {
  constructor() {
    this.name = 'Notification Agent';
    this.alertQueue = [];
    this.lastAlert = 0;
    this.alertBatchInterval = 60 * 1000;
  }

  async start() {
    console.log(`🔔 ${this.name} started`);
    await this.registerHealth();
    
    setInterval(() => this.processAlertQueue(), 10 * 1000);
    this.startListeners();
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

  startListeners() {
    const listener = pool.query('LISTEN order_executed');
    pool.on('notification', async (msg) => {
      if (msg.channel === 'order_executed') {
        const order = JSON.parse(msg.payload);
        this.queueAlert('ORDER_EXECUTED', {
          symbol: order.symbol,
          quantity: order.quantity,
          price: order.price,
          side: order.side,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  queueAlert(type, data) {
    this.alertQueue.push({
      id: uuidv4(),
      type,
      data,
      timestamp: Date.now()
    });
  }

  async processAlertQueue() {
    if (this.alertQueue.length === 0) return;
    
    const now = Date.now();
    if (now - this.lastAlert < this.alertBatchInterval) return;

    try {
      const alerts = this.alertQueue.splice(0, this.alertQueue.length);
      
      for (const alert of alerts) {
        await this.sendAlert(alert);
        await this.logAlert(alert);
      }

      this.lastAlert = now;
      await this.updateHealth('HEALTHY', `Processed ${alerts.length} alerts`);
    } catch (error) {
      console.error('❌ Alert processing error:', error.message);
      await this.updateHealth('ERROR', error.message);
    }
  }

  async sendAlert(alert) {
    try {
      const webhook = process.env.DISCORD_WEBHOOK;
      if (!webhook) return;

      const embed = this.buildEmbed(alert);
      await axios.post(webhook, { embeds: [embed] });
      console.log(`✅ Alert sent: ${alert.type}`);
    } catch (error) {
      console.error('Discord send failed:', error.message);
    }
  }

  buildEmbed(alert) {
    const { type, data } = alert;

    if (type === 'ORDER_EXECUTED') {
      return {
        title: `📈 Order Executed - ${data.symbol}`,
        description: `${data.side.toUpperCase()} ${data.quantity} @ $${data.price}`,
        color: data.side === 'buy' ? 0x00ff00 : 0xff0000,
        timestamp: data.timestamp
      };
    }

    if (type === 'REBALANCE_TRIGGERED') {
      return {
        title: `⚖️ Rebalancing Started`,
        description: `Drift detected: ${data.drift}%`,
        color: 0xffa500,
        timestamp: new Date().toISOString()
      };
    }

    if (type === 'RISK_ALERT') {
      return {
        title: `⚠️ Risk Alert`,
        description: data.message,
        color: 0xff0000,
        timestamp: new Date().toISOString()
      };
    }

    return {
      title: `📢 ${type}`,
      description: JSON.stringify(data),
      color: 0x0099ff,
      timestamp: new Date().toISOString()
    };
  }

  async logAlert(alert) {
    try {
      await pool.query(
        `INSERT INTO notification_log (alert_id, alert_type, alert_data) VALUES ($1, $2, $3)`,
        [alert.id, alert.type, JSON.stringify(alert.data)]
      );
    } catch (error) {
      console.error('Alert log failed:', error.message);
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

const agent = new NotificationAgent();
agent.start().catch(console.error);

process.on('SIGTERM', () => {
  console.log('🛑 Notification Agent shutting down');
  pool.end();
  process.exit(0);
});
