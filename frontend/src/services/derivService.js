class DerivService {
  constructor() {
    this.ws = null
    this.isConnected = false
    this.accountInfo = null
    this.balance = 0
    this.currency = 'USD'
    this.accountType = 'real'
    this.listeners = []
    this.connectionAttempts = 0
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const token = localStorage.getItem('deriv_access_token')
        console.log('🔑 Attempting to connect with token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN')
        
        if (!token) {
          console.error('❌ No access token found in localStorage')
          reject(new Error('No access token found'))
          return
        }

        // Connect to Deriv WebSocket
        const wsUrl = 'wss://ws.derivws.com/websockets/v3?app_id=349eTg55tt6ZVaefjBIAH'
        console.log('🔌 Connecting to:', wsUrl)
        
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected successfully')
          this.isConnected = true
          this.connectionAttempts = 0
          
          // Authorize with token
          console.log('📤 Sending authorize request...')
          this.ws.send(JSON.stringify({ authorize: token }))
        }

        this.ws.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data)
            console.log('📥 Received:', data.msg_type, data)
            this.handleMessage(data)
          } catch (e) {
            console.error('❌ Error parsing message:', e)
          }
        }

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          this.isConnected = false
          reject(error)
        }

        this.ws.onclose = () => {
          console.log(' WebSocket closed')
          this.isConnected = false
        }

        // Set timeout for connection
        setTimeout(() => {
          if (!this.isConnected) {
            console.error('⏱️ Connection timeout')
            reject(new Error('Connection timeout'))
          }
        }, 10000)
      } catch (error) {
        console.error('❌ Connection error:', error)
        reject(error)
      }
    })
  }

  handleMessage(data) {
    if (data.error) {
      console.error('❌ API Error:', data.error)
      return
    }

    if (data.msg_type === 'authorize' && data.authorize) {
      console.log('✅ Authorized successfully!')
      // Store account info
      this.accountInfo = data.authorize
      this.accountType = data.authorize.is_virtual ? 'demo' : 'real'
      
      console.log('📊 Account Info:', {
        loginid: data.authorize.loginid,
        email: data.authorize.email,
        currency: data.authorize.currency,
        isVirtual: data.authorize.is_virtual
      })
      
      // Request balance
      console.log('📤 Requesting balance...')
      this.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }))
    }

    if (data.msg_type === 'balance' && data.balance) {
      console.log('💰 Balance received:', data.balance)
      this.balance = data.balance.balance
      this.currency = data.balance.currency
      this.notifyListeners()
    }
  }

  // Add listener for balance updates
  addListener(callback) {
    this.listeners.push(callback)
    // Immediately call with current data if available
    if (this.accountInfo) {
      callback({
        balance: this.balance,
        currency: this.currency,
        accountType: this.accountType,
        accountInfo: this.accountInfo
      })
    }
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
