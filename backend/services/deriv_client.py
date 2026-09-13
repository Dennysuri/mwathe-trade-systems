import asyncio
import json
import websockets
from loguru import logger

class DerivClient:
    def __init__(self, client_id: str = "349eTg55tt6ZVaefjBIAH"):
        self.client_id = client_id
        self.ws_url = f"wss://ws.derivws.com/websockets/v3?app_id={self.client_id}"
        self.oauth_url = f"https://oauth.deriv.com/oauth2/authorize?app_id={self.client_id}&l=EN&brand=deriv"
        self.websocket = None
        self.is_connected = False
        self.is_authorized = False
        self.account_balance = 0.0
        self.currency = "USD"
        self.access_token = None

    async def connect(self):
        try:
            logger.info("🔌 Connecting to Deriv WebSocket...")
            self.websocket = await websockets.connect(self.ws_url)
            self.is_connected = True
            logger.success("✅ Connected to Deriv WebSocket successfully!")
            logger.info(f"🆔 Client ID: {self.client_id}")
            logger.info("⏳ Waiting for OAuth authorization...")
            
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            self.is_connected = False

    async def authorize_with_token(self, access_token: str):
        """Authorize using OAuth 2.0 access token"""
        if not self.websocket:
            return
        
        self.access_token = access_token
        auth_payload = {"authorize": access_token}
        await self.websocket.send(json.dumps(auth_payload))
        
        response = await self.websocket.recv()
        data = json.loads(response)
        
        if "error" in data:
            logger.error(f"❌ Auth Error: {data['error']['message']}")
            self.is_authorized = False
        else:
            self.is_authorized = True
            account_info = data['authorize']
            logger.success(f"✅ OAuth 2.0 Authenticated!")
            logger.info(f"📧 Account: {account_info.get('email', 'Unknown')}")
            logger.info(f"💼 Account Type: {account_info.get('account_type', 'Unknown')}")
            logger.info(f"🏦 Currency: {account_info.get('currency', 'USD')}")
            await self.get_balance()

    async def get_balance(self):
        if not self.websocket:
            return
        balance_payload = {"balance": 1, "subscribe": 1}
        await self.websocket.send(json.dumps(balance_payload))
        asyncio.create_task(self._listen_for_updates())

    async def _listen_for_updates(self):
        logger.info("👂 Listening for real-time Deriv updates...")
        try:
            async for message in self.websocket:
                data = json.loads(message)
                if "balance" in data:
                    self.account_balance = data["balance"]["balance"]
                    self.currency = data["balance"]["currency"]
                    logger.info(f"💰 Balance Updated: {self.account_balance} {self.currency}")
        except websockets.exceptions.ConnectionClosed:
            logger.warning("⚠️ Deriv WebSocket connection closed.")
            self.is_connected = False
            self.is_authorized = False

    async def close(self):
        if self.websocket:
            await self.websocket.close()
            self.is_connected = False
            self.is_authorized = False
            logger.info("🔌 Deriv connection closed.")

    def get_oauth_redirect_url(self):
        """Returns the OAuth URL for frontend to redirect user"""
        return self.oauth_url
