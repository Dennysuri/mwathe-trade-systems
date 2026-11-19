import { rankLiveMarketOpportunities } from './liveOpportunityEngine.js';

// Search a duration ladder rather than one arbitrary default per strategy.
// These are discovery profiles; Deriv's contracts_for/proposal response remains
// authoritative for whether a particular market actually supports the contract.
const STRATEGY_DEFINITIONS = [
  ...['Over/Under', 'Matches/Differs', 'Even/Odd'].flatMap(subTradeType =>
    Array.from({ length: 10 }, (_, i) => ({
      tradeType: 'Digits', subTradeType, timeframeUnit: 'Ticks', duration: i + 1
    }))),
  ...['Rise/Fall', 'Higher/Lower'].flatMap(subTradeType => [
    ...[1, 2, 3, 4, 5, 6, 8, 10].map(duration => ({
      tradeType: 'Ups & Downs', subTradeType, timeframeUnit: 'Ticks', duration
    })),
    ...[1, 5, 15, 30, 60].map(duration => ({
      tradeType: 'Ups & Downs', subTradeType, timeframeUnit: 'Minutes', duration
    }))
  ]),
  ...[1, 2, 3, 5, 8, 10].map(duration => ({
    tradeType: 'Touch & No Touch', subTradeType: 'Touch/No Touch', timeframeUnit: 'Ticks', duration
  })),
  ...[1, 5, 15, 30].map(duration => ({
    tradeType: 'Touch & No Touch', subTradeType: 'Touch/No Touch', timeframeUnit: 'Minutes', duration
  })),
  { tradeType: 'Multipliers', subTradeType: 'Multipliers', timeframeUnit: 'Auto', duration: 1 },
  ...[10, 25, 50, 85].map(duration => ({
    tradeType: 'Accumulators', subTradeType: '', timeframeUnit: 'Ticks', duration
  })),
  ...[1, 5, 15, 30, 60].map(duration => ({
    tradeType: 'Vanillas', subTradeType: 'Call/Put', timeframeUnit: 'Minutes', duration
  })),
  ...[1, 4, 24].map(duration => ({
    tradeType: 'Vanillas', subTradeType: 'Call/Put',
    timeframeUnit: duration === 24 ? 'Hours' : 'Hours', duration
  })),
  ...[1, 7].map(duration => ({
    tradeType: 'Vanillas', subTradeType: 'Call/Put', timeframeUnit: 'Days', duration
  })),
  ...[1, 2, 3, 4, 5, 6, 8, 10].map(duration => ({
    tradeType: 'Turbos', subTradeType: 'Turbos', timeframeUnit: 'Ticks', duration
  })),
  ...[1, 5, 15, 30].map(duration => ({
    tradeType: 'Turbos', subTradeType: 'Turbos', timeframeUnit: 'Minutes', duration
  }))
];

export function buildStrategyProfiles(selectedConfig = {}) {
  const profiles = STRATEGY_DEFINITIONS.map(definition => {
    const selected = definition.tradeType === selectedConfig.tradeType
      && definition.subTradeType === (selectedConfig.subTradeType || '');
    return {
      ...definition,
      duration: definition.duration,
      option: selected && selectedConfig.option && selectedConfig.option !== 'Both'
        ? selectedConfig.option : 'Both',
      predictedDigit: Number.isInteger(Number(selectedConfig.predictedDigit))
        ? Number(selectedConfig.predictedDigit) : 5,
      barrier: selected ? selectedConfig.barrier : undefined,
      multiplier: selectedConfig.multiplier,
      growthRate: selectedConfig.growthRate,
      takeProfit: selectedConfig.takeProfit,
      contractStopLoss: selectedConfig.contractStopLoss,
      profileId: [definition.tradeType, definition.subTradeType || 'default',
        definition.timeframeUnit, definition.duration].join('|')
    };
  });
  // Include a user-selected duration even when it is outside the discovery ladder.
  if (selectedConfig.tradeType && selectedConfig.timeframeUnit
      && Number.isFinite(Number(selectedConfig.duration)) && Number(selectedConfig.duration) > 0
      && !profiles.some(p => p.tradeType === selectedConfig.tradeType
        && p.subTradeType === (selectedConfig.subTradeType || '')
        && p.timeframeUnit === selectedConfig.timeframeUnit
        && p.duration === Number(selectedConfig.duration))) {
    profiles.push({
      ...selectedConfig,
      profileId: [selectedConfig.tradeType, selectedConfig.subTradeType || 'default',
        selectedConfig.timeframeUnit, Number(selectedConfig.duration)].join('|')
    });
  }
  return profiles;
}

/**
 * Research every configured strategy/duration profile against every fresh market.
 * A watch candidate is retained even below the old display threshold so Thamira
 * can compare the full opportunity field. Ranking is not trade authorization.
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
  return groups.flat().sort((a, b) =>
    (b.report?.candidate?.score ?? b.score) - (a.report?.candidate?.score ?? a.score));
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
