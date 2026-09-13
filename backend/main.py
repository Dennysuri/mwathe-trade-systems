from fastapi import FastAPI
from contextlib import asynccontextmanager
from services.deriv_client import DerivClient
from loguru import logger
import asyncio

deriv_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global deriv_client
    logger.info("🚀 Starting Mwathe Trade Systems Backend...")
    
    deriv_client = DerivClient(client_id="349eTg55tt6ZVaefjBIAH")
    asyncio.create_task(deriv_client.connect())
    
    yield 
    
    logger.info("🛑 Shutting down Mwathe Trade Systems...")
    if deriv_client:
        await deriv_client.close()

app = FastAPI(title="Mwathe Trade Systems API", lifespan=lifespan)

@app.get("/")
async def root():
    return {"message": "Mwathe Trade Systems API is running!", "status": "online"}

@app.get("/status")
async def get_status():
    global deriv_client
    if deriv_client and deriv_client.is_connected:
        return {
            "connected": True,
            "authorized": deriv_client.is_authorized,
            "balance": deriv_client.account_balance,
            "currency": deriv_client.currency,
            "client_id": deriv_client.client_id
        }
    return {"connected": False, "authorized": False, "balance": 0.0, "currency": "USD"}

@app.get("/oauth-url")
async def get_oauth_url():
    """Returns the OAuth 2.0 authorization URL for frontend"""
    global deriv_client
    if deriv_client:
        return {"oauth_url": deriv_client.get_oauth_redirect_url()}
    return {"error": "Deriv client not initialized"}

@app.post("/authorize")
async def authorize_account(access_token: str):
    """Called by frontend after OAuth redirect with the access token"""
    global deriv_client
    if deriv_client and deriv_client.is_connected:
        await deriv_client.authorize_with_token(access_token)
        return {"status": "Authorization request sent"}
    return {"status": "Error: Not connected to Deriv"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
