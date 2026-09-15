class DerivService {
  constructor() {
    this.ws = null
    this.isConnected = false
    this.accountInfo = null
    this.balance = 0
    this.currency = 'USD'
    this.accountType = 'real' // 'real' or 'demo'
    this.listeners = []
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const token = localStorage.getItem('deriv_access_token')
        if (!token) {
          reject(new Error('No access token found'))
          return
        }

        // Connect to Deriv WebSocket
        this.ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=349eTg55tt6ZVaefjBIAH')

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected')
          this.isConnected = true
          
          // Authorize with token
          this.ws.send(JSON.stringify({ authorize: token }))
        }

        this.ws.onmessage = (message) => {
          const data = JSON.parse(message.data)
          this.handleMessage(data)
        }

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          this.isConnected = false
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('🔌 WebSocket closed')
          this.isConnected = false
        }

        // Set timeout for connection
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'))
          }
        }, 10000)
      } catch (error) {
        reject(error)
      }
    })
  }

  handleMessage(data) {
    if (data.error) {
      console.error('API Error:', data.error)
      return
    }

    if (data.authorize) {
      // Store account info
      this.accountInfo = data.authorize
      this.accountType = data.authorize.is_virtual ? 'demo' : 'real'
      
      // Request balance
      this.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }))
    }

    if (data.balance) {
      this.balance = data.balance.balance
      this.currency = data.balance.currency
      this.notifyListeners()
    }
  }

  // Add listener for balance updates
  addListener(callback) {
    this.listeners.push(callback)
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(callback => {
      callback({
        balance: this.balance,
        currency: this.currency,
        accountType: this.accountType,
        accountInfo: this.accountInfo
      })
    })
  }

  // Get current account login ID
  getAccountId() {
    return this.accountInfo?.loginid || 'N/A'
  }

  // Disconnect
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }
}

// Export singleton instance
export const derivService = new DerivService()
export default derivService
