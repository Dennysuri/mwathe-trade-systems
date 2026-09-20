import asyncio
import json
import logging
import math
import random
from collections import deque

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("MwatheBackendEngine")

# Official 7 Trade Types & Sub-Trade Types Architecture
TRADE_TYPES_CONFIG = {
    "Multipliers": ["Multipliers"],
    "Ups & Downs": ["Rise/Fall", "Higher/Lower"],
    "Touch & No Touch": ["Touch/No Touch"],
    "Digits": ["Over/Under", "Matches/Differs", "Even/Odd"],
    "Accumulators": [],
    "Vanillas": ["Call/Put"],
    "Turbos": ["Turbos"]
}

# Quantitative Math Models (Exact Alignment with Frontend Architecture)
class QuantModels:
    @staticmethod
    def calc_entropy(arr):
        if not arr: return 0
        f = {}
        arr.forEach(x => None) # handled via python dict below
        for x in arr: f[x] = f.get(x, 0) + 1
        e = 0
        n = len(arr)
        for c in f.values():
            p = c / n
            e -= p * math.log2(p)
        return e

    @staticmethod
    def calc_markov(digits, target, order=2):
        if len(digits) < order + 1: return 0.1
        seq = digits[-order:]
        match = 0
        total = 0
        for i in range(len(digits) - order):
            is_match = all(digits[i+j] == seq[j] for j in range(order))
            if is_match:
                total += 1
                if digits[i + order] == target: match += 1
        return 0.1 if total == 0 else match / total

    @staticmethod
    def calc_hurst(ticks):
        if len(ticks) < 20: return 0.5
        n = len(ticks)
        mean = sum(ticks) / n
        dev = [t - mean for t in ticks]
        cum = []
        acc = 0
        for d in dev:
            acc += d
            cum.append(acc)
        rng = max(cum) - min(cum)
        std = math.sqrt(sum(d*d for d in dev) / n)
        return math.log(rng / (std or 1)) / math.log(n)
