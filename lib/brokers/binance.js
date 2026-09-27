// Binance REST API & WebSocket Client
const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
require('dotenv').config();

const TESTNET_BASE_URL = 'https://testnet.binance.vision/api';
const MAINNET_BASE_URL = 'https://api.binance.com/api';
const TESTNET_WS_URL = 'wss://stream.testnet.binance.vision:9443/ws';
const MAINNET_WS_URL = 'wss://stream.binance.com:9443/ws';

class BinanceClient {
  constructor(useTestnet = true) {
    this.useTestnet = useTestnet;
    this.baseURL = useTestnet ? TESTNET_BASE_URL : MAINNET_BASE_URL;
    this.wsURL = useTestnet ? TESTNET_WS_URL : MAINNET_WS_URL;

    this.apiKey = useTestnet
      ? process.env.BINANCE_TESTNET_API_KEY
      : process.env.BINANCE_LIVE_API_KEY;

    this.secretKey = useTestnet
      ? process.env.BINANCE_TESTNET_SECRET_KEY
      : process.env.BINANCE_LIVE_SECRET_KEY;

    if (!this.apiKey || !this.secretKey) {
      throw new Error(`Missing Binance ${useTestnet ? 'testnet' : 'live'} credentials`);
    }

    this.ws = null;
    this.priceListeners = {};
  }

  // Generate request signature
  signature(query) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(query)
      .digest('hex');
  }

  // Place order
  async placeOrder(symbol, side, quantity, orderType = 'MARKET', price = null) {
    try {
      const params = {
        symbol,
        side: side.toUpperCase(),
        type: orderType.toUpperCase(),
        quantity,
        timestamp: Date.now(),
        recvWindow: 5000,
      };

      if (orderType === 'LIMIT' && price) {
        params.price = price;
        params.timeInForce = 'GTC';
      }

      const query = new URLSearchParams(params).toString();
      const signature = this.signature(query);

      const response = await axios.post(
        `${this.baseURL}/v3/order?${query}&signature=${signature}`,
        {},
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
          },
        }
      );

      console.log(`✅ Order placed: ${symbol} ${side} ${quantity}`);
      return {
        orderId: response.data.orderId.toString(),
        symbol: response.data.symbol,
        side: response.data.side,
        quantity: parseFloat(response.data.origQty),
        price: parseFloat(response.data.price),
        status: response.data.status,
        executedQuantity: parseFloat(response.data.executedQty),
        cummulativeQuoteQty: parseFloat(response.data.cummulativeQuoteQty),
      };
    } catch (error) {
      console.error('❌ Order placement failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Cancel order
  async cancelOrder(symbol, orderId) {
    try {
      const params = {
        symbol,
        orderId,
        timestamp: Date.now(),
        recvWindow: 5000,
      };

      const query = new URLSearchParams(params).toString();
      const signature = this.signature(query);

      await axios.delete(
        `${this.baseURL}/v3/order?${query}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
          },
        }
      );

      console.log(`✅ Order cancelled: ${orderId}`);
      return true;
    } catch (error) {
      console.error('❌ Order cancellation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get order status
  async getOrderStatus(symbol, orderId) {
    try {
      const params = {
        symbol,
        orderId,
        timestamp: Date.now(),
        recvWindow: 5000,
      };

      const query = new URLSearchParams(params).toString();
      const signature = this.signature(query);

      const response = await axios.get(
        `${this.baseURL}/v3/order?${query}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
          },
        }
      );

      return {
        orderId: response.data.orderId.toString(),
        symbol: response.data.symbol,
        status: response.data.status,
        executedQuantity: parseFloat(response.data.executedQty),
        cummulativeQuoteQty: parseFloat(response.data.cummulativeQuoteQty),
      };
    } catch (error) {
      console.error('❌ Failed to get order status:', error.message);
      throw error;
    }
  }

  // Get current positions (open orders + balances)
  async getPositions() {
    try {
      const params = {
        timestamp: Date.now(),
        recvWindow: 5000,
      };

      const query = new URLSearchParams(params).toString();
      const signature = this.signature(query);

      const response = await axios.get(
        `${this.baseURL}/v3/account?${query}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
          },
        }
      );

      const positions = response.data.balances
        .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map(b => ({
          symbol: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
          total: parseFloat(b.free) + parseFloat(b.locked),
        }));

      return positions;
    } catch (error) {
      console.error('❌ Failed to get positions:', error.message);
      throw error;
    }
  }

  // Get current price
  async getCurrentPrice(symbol) {
    try {
      const response = await axios.get(`${this.baseURL}/v3/ticker/price`, {
        params: { symbol },
      });

      return parseFloat(response.data.price);
    } catch (error) {
      console.error(`❌ Failed to get price for ${symbol}:`, error.message);
      throw error;
    }
  }

  // Subscribe to price updates via WebSocket
  subscribeToPrices(symbols, onUpdate) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const wsUrl = `${this.wsURL}/${streams}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (Array.isArray(message)) {
          message.forEach(msg => onUpdate(msg));
        } else {
          onUpdate(message);
        }
      } catch (error) {
        console.error('❌ WebSocket message parse error:', error.message);
      }
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    this.ws.on('close', () => {
      console.log('⚠️  WebSocket closed, reconnecting...');
      setTimeout(() => this.subscribeToPrices(symbols, onUpdate), 3000);
    });

    console.log(`✅ Subscribed to price updates: ${symbols.join(', ')}`);
  }

  // Close WebSocket
  closeWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = BinanceClient;
