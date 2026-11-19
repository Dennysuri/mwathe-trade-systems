import { rankLiveMarketOpportunities } from './liveOpportunityEngine.js';

const STRATEGY_DEFINITIONS = [
  { tradeType: 'Digits', subTradeType: 'Over/Under', timeframeUnit: 'Ticks', duration: 1 },
  { tradeType: 'Digits', subTradeType: 'Matches/Differs', timeframeUnit: 'Ticks', duration: 1 },
  { tradeType: 'Digits', subTradeType: 'Even/Odd', timeframeUnit: 'Ticks', duration: 1 },
  { tradeType: 'Ups & Downs', subTradeType: 'Rise/Fall', timeframeUnit: 'Ticks', duration: 1 },
  { tradeType: 'Ups & Downs', subTradeType: 'Higher/Lower', timeframeUnit: 'Ticks', duration: 1 },
  { tradeType: 'Touch & No Touch', subTradeType: 'Touch/No Touch', timeframeUnit: 'Ticks', duration: 1 },
  { tradeType: 'Multipliers', subTradeType: 'Multipliers', timeframeUnit: 'Auto', duration: 1 },
  { tradeType: 'Accumulators', subTradeType: '', timeframeUnit: 'Ticks', duration: 10 },
  { tradeType: 'Vanillas', subTradeType: 'Call/Put', timeframeUnit: 'Minutes', duration: 1 },
  { tradeType: 'Turbos', subTradeType: 'Turbos', timeframeUnit: 'Ticks', duration: 1 }
];

export function buildStrategyProfiles(selectedConfig = {}) {
  return STRATEGY_DEFINITIONS.map(definition => {
    const selected = definition.tradeType === selectedConfig.tradeType
      && definition.subTradeType === (selectedConfig.subTradeType || '');
    return {
      ...definition,
      option: selected && selectedConfig.option && selectedConfig.option !== 'Both'
        ? selectedConfig.option : 'Both',
      predictedDigit: Number.isInteger(Number(selectedConfig.predictedDigit))
        ? Number(selectedConfig.predictedDigit) : 5,
      barrier: selected ? selectedConfig.barrier : undefined,
      multiplier: selectedConfig.multiplier,
      growthRate: selectedConfig.growthRate,
      takeProfit: selectedConfig.takeProfit,
      contractStopLoss: selectedConfig.contractStopLoss,
      profileId: [definition.tradeType, definition.subTradeType || 'default'].join('|')
    };
  });
}

/**
 * Research every supported strategy profile against every fresh market snapshot.
 * Results remain research-only; the selected profile can be filtered separately
 * for the user's configured execution path.
 */
export async function rankLiveStrategyUniverse(markets, selectedConfig = {}, options = {}) {
  const profiles = buildStrategyProfiles(selectedConfig);
  const groups = await Promise.all(profiles.map(async profile => {
    const ranked = await rankLiveMarketOpportunities(markets, profile, options);
    return ranked.map(item => ({
      ...item,
      profile: {
        profileId: profile.profileId,
        tradeType: profile.tradeType,
        subTradeType: profile.subTradeType,
        timeframeUnit: profile.timeframeUnit,
        duration: profile.duration
      }
    }));
  }));
  return groups.flat().sort((a, b) => b.score - a.score);
}

export function findSelectedStrategyOpportunity(ranked, selectedConfig = {}) {
  return (ranked || []).find(item =>
    item.profile?.tradeType === selectedConfig.tradeType
    && item.profile?.subTradeType === (selectedConfig.subTradeType || '')
  ) || null;
}

export function getStrategyUniverseDefinitions() {
  return STRATEGY_DEFINITIONS.map(item => ({ ...item }));
}
