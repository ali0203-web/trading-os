/**
 * Arqam Capital Trading API Client
 * Connects to real DFM trading account
 * Real-time order placement, position tracking, market data
 */

class ArqamAPI {
  constructor() {
    // Use local proxy to avoid CORS issues
    this.baseURL = '/api/arqam-proxy'
    this.apiKey = process.env.NEXT_PUBLIC_ARQAM_API_KEY
    this.accountId = process.env.NEXT_PUBLIC_ARQAM_ACCOUNT_ID
    this.headers = {
      'Content-Type': 'application/json',
    }
    this.sessionToken = null
    this.isConnected = false
  }

  /**
   * Helper to make proxied requests
   */
  async makeProxyRequest(path, method = 'GET', body = null) {
    const payload = {
      path,
      method,
      body,
    }

    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return response
  }

  /**
   * Initialize connection with Arqam Capital
   */
  async connect() {
    try {
      const response = await this.makeProxyRequest('/auth/token', 'POST', {
        api_key: this.apiKey,
        account_id: this.accountId,
      })

      if (response.ok) {
        const data = await response.json()
        this.sessionToken = data.token
        this.isConnected = true
        console.log('✅ Connected to Arqam Capital')
        return true
      } else {
        console.error('❌ Arqam connection failed:', response.statusText)
        return false
      }
    } catch (error) {
      console.error('❌ Connection error:', error.message)
      return false
    }
  }

  /**
   * Get account balance and overview
   */
  async getAccountBalance() {
    try {
      const response = await this.makeProxyRequest('/account/balance', 'GET')

      if (response.ok) {
        return await response.json()
      } else {
        throw new Error('Failed to fetch balance')
      }
    } catch (error) {
      console.error('Error fetching balance:', error)
      return null
    }
  }

  /**
   * Get all open positions
   */
  async getOpenPositions() {
    try {
      const response = await this.makeProxyRequest('/positions/open', 'GET')

      if (response.ok) {
        const data = await response.json()
        return data.positions || []
      } else {
        throw new Error('Failed to fetch positions')
      }
    } catch (error) {
      console.error('Error fetching positions:', error)
      return []
    }
  }

  /**
   * Get trading history
   */
  async getTradeHistory(limit = 50) {
    try {
      const response = await fetch(
        `${this.baseURL}/trades/history?limit=${limit}`,
        { headers: this.headers }
      )

      if (response.ok) {
        const data = await response.json()
        return data.trades || []
      } else {
        throw new Error('Failed to fetch trade history')
      }
    } catch (error) {
      console.error('Error fetching trade history:', error)
      return []
    }
  }

  /**
   * Place a new order (BUY or SELL)
   */
  async placeOrder(symbol, side, quantity, orderType = 'MARKET', limitPrice = null) {
    try {
      const payload = {
        symbol,
        side, // 'BUY' or 'SELL'
        quantity,
        order_type: orderType, // 'MARKET', 'LIMIT', 'STOP'
        limit_price: limitPrice,
        time_in_force: 'DAY',
      }

      const response = await this.makeProxyRequest('/orders/place', 'POST', payload)

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ Order placed: ${side} ${quantity} ${symbol}`)
        return { success: true, orderId: data.order_id, ...data }
      } else {
        const error = await response.json()
        console.error('❌ Order failed:', error.message)
        return { success: false, error: error.message }
      }
    } catch (error) {
      console.error('Error placing order:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Cancel an open order
   */
  async cancelOrder(orderId) {
    try {
      const response = await fetch(`${this.baseURL}/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: this.headers,
      })

      if (response.ok) {
        console.log(`✅ Order ${orderId} cancelled`)
        return { success: true }
      } else {
        throw new Error('Failed to cancel order')
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get live quote for a symbol
   */
  async getQuote(symbol) {
    try {
      const response = await this.makeProxyRequest(`/quotes/${symbol}`, 'GET')

      if (response.ok) {
        return await response.json()
      } else {
        throw new Error(`Failed to fetch quote for ${symbol}`)
      }
    } catch (error) {
      console.error('Error fetching quote:', error)
      return null
    }
  }

  /**
   * Get market data for multiple symbols
   */
  async getMultipleQuotes(symbols) {
    try {
      const promises = symbols.map(symbol => this.getQuote(symbol))
      const results = await Promise.all(promises)
      return results.filter(result => result !== null)
    } catch (error) {
      console.error('Error fetching multiple quotes:', error)
      return []
    }
  }

  /**
   * Check if market is currently open
   */
  async isMarketOpen() {
    try {
      const response = await fetch(`${this.baseURL}/market/status`, {
        headers: this.headers,
      })

      if (response.ok) {
        const data = await response.json()
        return data.is_open
      }
      return false
    } catch (error) {
      console.error('Error checking market status:', error)
      return false
    }
  }

  /**
   * Get account orders (open and closed)
   */
  async getOrders(status = 'all') {
    try {
      const response = await fetch(
        `${this.baseURL}/orders?status=${status}`,
        { headers: this.headers }
      )

      if (response.ok) {
        const data = await response.json()
        return data.orders || []
      } else {
        throw new Error('Failed to fetch orders')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      return []
    }
  }

  /**
   * Subscribe to real-time updates via WebSocket
   */
  subscribeToUpdates(callback) {
    try {
      // Don't attempt WebSocket connection if using mock data or if no session token
      if (!this.sessionToken || this.sessionToken.startsWith('mock_')) {
        console.log('⚠️  WebSocket skipped (mock data mode)')
        return null
      }

      const wsURL = `wss://api.arqamcapital.com/v1/stream?token=${this.sessionToken}`
      const ws = new WebSocket(wsURL)

      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        ws.send(JSON.stringify({ action: 'subscribe', channels: ['positions', 'orders', 'quotes'] }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        callback(data)
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('⚠️  WebSocket disconnected')
      }

      return ws
    } catch (error) {
      console.error('Error subscribing to updates:', error)
      return null
    }
  }

  /**
   * Get account performance metrics
   */
  async getPerformanceMetrics() {
    try {
      const response = await fetch(`${this.baseURL}/account/performance`, {
        headers: this.headers,
      })

      if (response.ok) {
        return await response.json()
      } else {
        throw new Error('Failed to fetch performance metrics')
      }
    } catch (error) {
      console.error('Error fetching performance metrics:', error)
      return null
    }
  }

  /**
   * Validate API connection
   */
  async validate() {
    if (!this.apiKey || !this.accountId) {
      console.error('❌ Missing API credentials')
      return false
    }

    return await this.connect()
  }
}

// Export singleton instance
export const arqamAPI = new ArqamAPI()
export default ArqamAPI
