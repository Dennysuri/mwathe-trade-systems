import asyncio
import json
import logging
import math
import random
from collections import deque

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("MwatheTradeCore")

# Official 7 Trade Types & Sub-Trade Types Architecture
TRADE_TYPES_CONFIG = {
    "Multipliers": {"sub_types": ["Multipliers"]},
    "Ups_And_Downs": {"sub_types": ["Rise_Fall", "Higher_Lower"]},
    "Touch_And_No_Touch": {"sub_types": ["Touch", "No_Touch"]},
    "Digits": {"sub_types": ["Over_Under", "Matches_Differs", "Even_Odd"]},
    "Accumulators": {"sub_types": ["Standard"]},
    "Vanillas": {"sub_types": ["Call_Put"]},
    "Turbos": {"sub_types": ["Turbos"]}
}

class AdvancedQuantEngine:
    @staticmethod
    entropy = lambda ticks: -sum((c/len(ticks)) * math.log2(c/len(ticks)) for c in [ticks.count(d) for d in set(ticks)] if c > 0) if len(ticks) > 0 else 0
    
    @staticmethod
    def calculate_hurst(prices):
        """Simplified Hurst Exponent estimator for tick memory persistence"""
        if len(prices) < 20:
            return 0.5
        lags = range(2, min(20, len(prices)//2))
        tau = [math.sqrt(std := math.sqrt(sum((prices[i] - sum(prices[i:i+l])/l)**2 for i in range(len(prices)-l))/l)) for l in lags]
        return 0.5 if not tau else max(0.0, min(1.0, 0.5 + (sum(tau)/len(tau))/10))

    @staticmethod
    def markov_transition_probability(digits, target_digit):
        """Markov chain probability of transition to target digit"""
        if len(digits) < 10:
            return 0.1
        transitions = 0
        total_from_prev = 0
        for i in range(len(digits) - 1):
            if digits[i] != target_digit and digits[i+1] == target_digit:
                transitions += 1
                total_from_prev += 1
            elif digits[i] != target_digit:
                total_from_prev += 1
        return transitions / total_from_prev if total_from_prev > 0 else 0.1

class MarketScannerEngine:
    def __init__(self, markets):
        self.markets = markets
        self.market_data = {symbol: {"ticks": deque(maxlen=100), "prices": deque(maxlen=100), "blacklisted": False, "losses": 0} for symbol in markets}

    async def simulate_market_feed(self, symbol):
        """Simulates asynchronous WebSocket tick and price streaming across 13 assets"""
        while True:
            await asyncio.sleep(random.uniform(0.4, 1.2))
            price = round(random.uniform(1000, 5000), 4)
            digit = int(str(price).split('.')[-1][-1])
            
            data = self.market_data[symbol]
            if not data["blacklisted"]:
                data["ticks"].append(digit)
                data["prices"].append(price)

    async def evaluate_market(self, symbol, trade_type, sub_type, parameters):
        data = self.market_data[symbol]
        if data["blacklisted"] or len(data["ticks"]) < 30:
            return -1.0 # Exclude blacklisted or uninitialized markets
            
        ticks = list(data["ticks"])
        prices = list(data["prices"])
        
        # Advanced quant scoring using Entropy, Hurst, and Markov models
        ent = AdvancedQuantEngine.entropy(ticks)
        hurst = AdvancedQuantEngine.calculate_hurst(prices)
        
        score = 50.0
        if trade_type == "Digits":
            target = parameters.get("prediction", 4)
            markov_prob = AdvancedQuantEngine.markov_transition_probability(ticks, target)
            score += (markov_prob * 50) + (hurst * 10)
        else:
            score += hurst * 40 + ent * 10
            
        return max(0.0, min(100.0, score))

    async def scan_all_markets(self, trade_type, sub_type, parameters):
        scores = {}
        for symbol in self.markets:
            if self.market_data[symbol]["blacklisted"]:
                continue
            scores[symbol] = await self.evaluate_market(symbol, trade_type, sub_type, parameters)
            
        valid_scores = {s: sc for s, sc in scores.items() if sc >= 0}
        if not valid_scores:
            return None, 0.0
        best_market = max(valid_scores, key=valid_scores.get)
        return best_market, valid_scores[best_market]

class RiskAndRecoveryEngine:
    @staticmethod
    def calculate_stake(base_stake, consecutive_losses, sub_type):
        """Controlled recovery sizing avoiding destructive Martingale spirals"""
        if sub_type in ["Matches_Differs", "Over_Under"]:
            multiplier = min(1.5 ** consecutive_losses, 4.0) # Bounded recovery cap
        else:
            multiplier = 1.0
        return round(base_stake * multiplier, 2)

    @staticmethod
    def evaluate_blacklisting(market_state, loss_threshold=3):
        """Market blacklisting logic for handling persistent losing streaks"""
        if market_state["losses"] >= loss_threshold:
            market_state["blacklisted"] = True
            logger.warning(f"Market blacklisted due to {loss_threshold} consecutive losses.")
            return True
        return False
