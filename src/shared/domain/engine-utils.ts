/**
 * Engine utilities for the engine supplier contracts system
 */

import type {
  EngineStats,
  EngineCustomisation,
  CarEngineState,
  TeamEngineState,
  Manufacturer,
  ManufacturerSpecState,
  SpecBonus,
  TeamEngineAnalytics,
  EngineAnalyticsDataPoint,
  ActiveManufacturerContract,
  ContractTerms,
  ContractOffer,
  EngineNegotiation,
  GameDate,
} from './types';
import { ManufacturerType, NegotiationStatus } from './types';

/**
 * Engine stat keys for iteration
 */
export const ENGINE_STAT_KEYS: (keyof EngineStats)[] = [
  'power',
  'fuelEfficiency',
  'reliability',
  'heat',
  'predictability',
];

/**
 * Display names for engine stats (for UI and emails)
 */
export const ENGINE_STAT_DISPLAY_NAMES: Record<keyof EngineStats, string> = {
  power: 'Power',
  fuelEfficiency: 'Fuel Efficiency',
  reliability: 'Reliability',
  heat: 'Heat Management',
  predictability: 'Predictability',
};

/**
 * Maximum customisation adjustment per stat (prevents min-maxing)
 */
export const MAX_CUSTOMISATION_PER_STAT = 10;

/**
 * Maximum year-end evolution change per stat
 */
export const MAX_EVOLUTION_CHANGE = 10;

/**
 * Season-start normalization ceiling (best manufacturer for each stat)
 */
export const NORMALIZATION_CEILING = 70;

/** Minimum stat value */
export const MIN_STAT_VALUE = 0;

/** Maximum stat value */
export const MAX_STAT_VALUE = 100;

/**
 * Clamps a value between min and max (inclusive)
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamps a stat value to valid range (0-100)
 */
export function clampStat(value: number): number {
  return clamp(value, MIN_STAT_VALUE, MAX_STAT_VALUE);
}

/**
 * Creates a default (zeroed) engine customisation object
 */
export function createDefaultEngineCustomisation(): EngineCustomisation {
  return {
    power: 0,
    fuelEfficiency: 0,
    reliability: 0,
    heat: 0,
    predictability: 0,
  };
}

/**
 * Creates a default car engine state (spec 1, no customisation)
 */
export function createDefaultCarEngineState(): CarEngineState {
  return {
    specVersion: 1,
    customisation: createDefaultEngineCustomisation(),
  };
}

/**
 * Creates a default team engine state for a new season
 */
export function createDefaultTeamEngineState(): TeamEngineState {
  return {
    car1Engine: createDefaultCarEngineState(),
    car2Engine: createDefaultCarEngineState(),
    customisationPointsOwned: 0,
    optimisationPurchasedForNextSeason: false,
    preNegotiatedUpgrades: 0,
  };
}

/**
 * Normalizes engine stats across all manufacturers so that the best
 * stat for each attribute = NORMALIZATION_CEILING (70).
 * Others are proportionally scaled.
 *
 * This is called at season start to prevent runaway leaders while
 * leaving room for upgrades during the season.
 *
 * @param manufacturers - Array of manufacturers with raw engine stats
 * @returns New array of manufacturers with normalized stats (does not mutate input)
 */
export function normalizeManufacturerEngineStats(
  manufacturers: Manufacturer[]
): Manufacturer[] {
  if (manufacturers.length === 0) return [];

  // Find the max value for each stat across all manufacturers
  const maxStats: Record<keyof EngineStats, number> = {
    power: 0,
    fuelEfficiency: 0,
    reliability: 0,
    heat: 0,
    predictability: 0,
  };

  for (const mfg of manufacturers) {
    for (const key of ENGINE_STAT_KEYS) {
      if (mfg.engineStats[key] > maxStats[key]) {
        maxStats[key] = mfg.engineStats[key];
      }
    }
  }

  // Normalize each manufacturer's stats
  return manufacturers.map((mfg) => {
    const normalizedStats: EngineStats = { ...mfg.engineStats };

    for (const key of ENGINE_STAT_KEYS) {
      const max = maxStats[key];
      if (max > 0) {
        // Scale so best = 70, others proportional
        normalizedStats[key] =
          (mfg.engineStats[key] / max) * NORMALIZATION_CEILING;
      }
    }

    return {
      ...mfg,
      engineStats: normalizedStats,
    };
  });
}

/**
 * Calculates the effective engine stats for a car, combining:
 * - Base manufacturer stats (already normalized at season start)
 * - Spec version bonuses (each spec version adds improvements)
 * - Customisation adjustments (player tuning)
 *
 * @param baseStats - The manufacturer's current engine stats
 * @param specVersion - Current spec version (1 = base, higher = improved)
 * @param specBonuses - Array of bonus stats per spec upgrade (index 0 = spec 2 bonuses, etc.)
 * @param customisation - Player's tuning adjustments
 * @returns Effective engine stats for this car
 */
export function getEffectiveEngineStats(
  baseStats: EngineStats,
  specVersion: number,
  specBonuses: EngineStats[],
  customisation: EngineCustomisation
): EngineStats {
  const effective: EngineStats = { ...baseStats };

  // Apply spec bonuses (spec 1 is base, spec 2+ add bonuses)
  for (let i = 0; i < specVersion - 1 && i < specBonuses.length; i++) {
    for (const key of ENGINE_STAT_KEYS) {
      effective[key] += specBonuses[i][key];
    }
  }

  // Apply customisation (within -10 to +10 range per stat)
  for (const key of ENGINE_STAT_KEYS) {
    effective[key] += customisation[key];
  }

  // Clamp to valid range
  for (const key of ENGINE_STAT_KEYS) {
    effective[key] = clampStat(effective[key]);
  }

  return effective;
}

/**
 * Validates that a customisation change is within the allowed limits:
 * - Each stat adjustment must be between -10 and +10
 * - Total absolute adjustment must not exceed available points
 *
 * @param customisation - Proposed customisation
 * @param availablePoints - Number of customisation points available
 * @returns True if valid, false otherwise
 */
export function isValidCustomisation(
  customisation: EngineCustomisation,
  availablePoints: number
): boolean {
  let totalAdjustment = 0;

  for (const key of ENGINE_STAT_KEYS) {
    const value = customisation[key];

    // Check individual stat limit
    if (value < -MAX_CUSTOMISATION_PER_STAT || value > MAX_CUSTOMISATION_PER_STAT) {
      return false;
    }

    // Sum absolute adjustments
    totalAdjustment += Math.abs(value);
  }

  // Check total points (each point of adjustment costs 1 point)
  // Note: This is a simple model - could be made more complex
  return totalAdjustment <= availablePoints;
}

/**
 * Generates a random normal distribution value using Box-Muller transform
 * Used for year-end engine stat evolution
 *
 * @param mean - Mean of the distribution
 * @param stdDev - Standard deviation
 * @returns Random value from normal distribution
 */
export function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Evolves engine stats at year-end using normal distribution changes
 * Each stat changes by a value drawn from N(0, 5) clamped to [-10, +10]
 *
 * @param stats - Current engine stats
 * @returns New stats with random evolution applied
 */
export function evolveEngineStats(stats: EngineStats): EngineStats {
  const evolved: EngineStats = { ...stats };

  for (const key of ENGINE_STAT_KEYS) {
    // Random change with normal distribution (mean=0, stdDev=5)
    // This gives ~68% of changes in [-5, +5], ~95% in [-10, +10]
    const change = clamp(normalRandom(0, 5), -MAX_EVOLUTION_CHANGE, MAX_EVOLUTION_CHANGE);
    evolved[key] = clampStat(stats[key] + change);
  }

  return evolved;
}

// =============================================================================
// SPEC RELEASE FUNCTIONS
// =============================================================================

/**
 * Base probability per day for any manufacturer to release a new spec
 * Higher quality manufacturers have slightly higher probability
 */
export const BASE_SPEC_RELEASE_PROBABILITY_PER_DAY = 0.005; // ~0.5% per day

/**
 * Maximum stat improvement per spec release (per stat)
 */
export const MAX_SPEC_IMPROVEMENT_PER_STAT = 5;

// Reputation thresholds for spec release mechanics
/** Minimum reputation for 3 stats to improve per spec (vs 2) */
export const REPUTATION_THRESHOLD_THREE_STATS = 70;
/** Minimum reputation for +1 bonus improvement per stat */
export const REPUTATION_THRESHOLD_BONUS_IMPROVEMENT = 80;
/** Minimum reputation for 1.2x spec release probability */
export const REPUTATION_THRESHOLD_MEDIUM_PROBABILITY = 60;
/** Minimum reputation for 1.5x spec release probability */
export const REPUTATION_THRESHOLD_HIGH_PROBABILITY = 80;

/**
 * Creates a default (zeroed) spec bonus object
 */
export function createDefaultSpecBonus(): SpecBonus {
  return {
    power: 0,
    fuelEfficiency: 0,
    reliability: 0,
    heat: 0,
    predictability: 0,
  };
}

/**
 * Creates the initial spec state for a manufacturer
 * Starts at spec version 1 with no bonuses (base stats from manufacturer)
 */
export function createInitialSpecState(manufacturerId: string): ManufacturerSpecState {
  return {
    manufacturerId,
    latestSpecVersion: 1,
    specBonuses: [],
  };
}

/**
 * Generates random spec bonuses for a new spec version
 * Higher reputation manufacturers get slightly better bonuses
 *
 * @param reputation - Manufacturer reputation (0-100)
 * @returns SpecBonus with random improvements for 2-3 stats
 */
export function generateSpecBonus(reputation: number): SpecBonus {
  const bonus = createDefaultSpecBonus();

  // Better manufacturers get more stats improved (2-3)
  const statsToImprove = reputation >= REPUTATION_THRESHOLD_THREE_STATS ? 3 : 2;

  // Shuffle stats to pick random ones
  const shuffledStats = [...ENGINE_STAT_KEYS].sort(() => Math.random() - 0.5);
  const selectedStats = shuffledStats.slice(0, statsToImprove);

  for (const stat of selectedStats) {
    // Base improvement 1-3, higher reputation gets +1
    const baseImprovement = Math.floor(Math.random() * 3) + 1;
    const reputationBonus = reputation >= REPUTATION_THRESHOLD_BONUS_IMPROVEMENT ? 1 : 0;
    bonus[stat] = Math.min(baseImprovement + reputationBonus, MAX_SPEC_IMPROVEMENT_PER_STAT);
  }

  return bonus;
}

/**
 * Checks if a manufacturer should release a new spec today
 * Probability is modified by manufacturer reputation
 *
 * @param reputation - Manufacturer reputation (0-100)
 * @returns True if a spec should be released
 */
export function shouldReleaseSpec(reputation: number): boolean {
  // Reputation modifier: higher reputation gets bonus probability
  const reputationModifier =
    reputation >= REPUTATION_THRESHOLD_HIGH_PROBABILITY ? 1.5 :
    reputation >= REPUTATION_THRESHOLD_MEDIUM_PROBABILITY ? 1.2 :
    1.0;
  const adjustedProbability = BASE_SPEC_RELEASE_PROBABILITY_PER_DAY * reputationModifier;
  return Math.random() < adjustedProbability;
}

/**
 * Gets the spec bonuses array from ManufacturerSpecState as EngineStats[]
 * Used by getEffectiveEngineStats which expects EngineStats[]
 * Note: SpecBonus and EngineStats are structurally identical, so this is just a type cast
 */
export function getSpecBonusesAsEngineStats(specState: ManufacturerSpecState): EngineStats[] {
  return specState.specBonuses;
}

// =============================================================================
// ENGINE ANALYTICS FUNCTIONS
// =============================================================================

/**
 * Analytics error margin (±8%)
 * Creates information asymmetry - early season estimates are unreliable
 */
export const ANALYTICS_ERROR_MARGIN = 0.08;

/**
 * Confidence thresholds for analytics display
 * Based on formula: confidence = min(100, dataPoints * 10 + 20)
 * - Low: 1-2 races (30-40%)
 * - Medium: 3-5 races (50-70%)
 * - High: 6+ races (80-100%)
 */
export const ANALYTICS_CONFIDENCE_LOW_THRESHOLD = 50;
export const ANALYTICS_CONFIDENCE_HIGH_THRESHOLD = 80;

/**
 * Weights for calculating composite engine power
 * Power and reliability are prioritized as they most directly affect race outcomes
 */
export const ENGINE_POWER_WEIGHTS = {
  power: 0.40, // 40% - directly affects lap time
  fuelEfficiency: 0.15, // 15% - affects strategy options
  reliability: 0.25, // 25% - affects DNF probability
  heat: 0.10, // 10% - hot race penalty
  predictability: 0.10, // 10% - driver error modifier
} as const;

/**
 * Calculates the "true" composite power value from engine stats
 * This is a weighted average favoring Power and Reliability
 *
 * @param stats - The effective engine stats (after spec bonuses and customisation)
 * @returns Composite power score (0-100)
 */
export function calculateTruePower(stats: EngineStats): number {
  return (
    stats.power * ENGINE_POWER_WEIGHTS.power +
    stats.fuelEfficiency * ENGINE_POWER_WEIGHTS.fuelEfficiency +
    stats.reliability * ENGINE_POWER_WEIGHTS.reliability +
    stats.heat * ENGINE_POWER_WEIGHTS.heat +
    stats.predictability * ENGINE_POWER_WEIGHTS.predictability
  );
}

/**
 * Generates an estimated power value with ±8% random error
 * Used when collecting analytics data points after each race
 *
 * @param truePower - The actual composite power value
 * @returns Estimated power with error applied
 */
export function generateEstimatedPower(truePower: number): number {
  // Random error in range [-8%, +8%]
  const errorMultiplier = 1 + (Math.random() * 2 - 1) * ANALYTICS_ERROR_MARGIN;
  return truePower * errorMultiplier;
}

/**
 * Calculates the running average of estimated power from data points
 *
 * @param dataPoints - Array of analytics data points for a team
 * @returns Average estimated power, or null if no data
 */
export function calculateAverageEstimatedPower(
  dataPoints: EngineAnalyticsDataPoint[]
): number | null {
  if (dataPoints.length === 0) return null;

  const sum = dataPoints.reduce((acc, dp) => acc + dp.estimatedPower, 0);
  return sum / dataPoints.length;
}

/**
 * Calculates confidence percentage based on number of data points
 * More data = more confidence in the estimate
 *
 * Formula: confidence = min(100, dataPoints * 10 + 20)
 * - 0 points = 0% (no data)
 * - 1 point = 30%
 * - 5 points = 70%
 * - 8+ points = 100%
 *
 * @param dataPointCount - Number of collected data points
 * @returns Confidence percentage (0-100)
 */
export function calculateAnalyticsConfidence(dataPointCount: number): number {
  if (dataPointCount === 0) return 0;
  return Math.min(100, dataPointCount * 10 + 20);
}

/**
 * Creates empty analytics state for all teams
 * Called when initializing a new game
 *
 * @param teamIds - Array of team IDs
 * @returns Array of empty TeamEngineAnalytics
 */
export function createInitialEngineAnalytics(teamIds: string[]): TeamEngineAnalytics[] {
  return teamIds.map((teamId) => ({
    teamId,
    dataPoints: [],
  }));
}

// =============================================================================
// CONTRACT NEGOTIATION FUNCTIONS
// =============================================================================

/**
 * Maximum desperation discount percentage (0.3 = 30% off)
 * Desperate manufacturers can offer up to this discount
 */
export const MAX_DESPERATION_DISCOUNT = 0.3;

/**
 * Late negotiation penalty multiplier
 * Signing during off-season costs this much more
 */
export const LATE_NEGOTIATION_PENALTY = 1.5;

/**
 * Default contract duration in seasons
 */
export const DEFAULT_CONTRACT_DURATION = 2;

/**
 * Days until an offer expires
 */
export const OFFER_EXPIRY_DAYS = 14;

/**
 * Minimum profit margin manufacturers require (0.1 = 10%)
 * Manufacturers won't offer unprofitable deals below this margin
 */
export const MIN_PROFIT_MARGIN = 0.1;

/**
 * Bundle discount for pre-negotiated upgrades (vs ad-hoc)
 * Pre-paid upgrades in contract cost this much less
 */
export const BUNDLE_DISCOUNT = 0.33;

/**
 * Calculates manufacturer desperation level based on market position
 *
 * Desperation kicks in when:
 * - Manufacturer has fewer teams secured for next season than they currently have
 * - AND there aren't enough unsigned teams to make up the difference
 *
 * @param manufacturerId - The manufacturer to calculate desperation for
 * @param currentSeason - Current season number
 * @param contracts - All active manufacturer contracts
 * @param teamCount - Total number of teams in the game
 * @returns Desperation level 0-1 (0 = not desperate, 1 = very desperate)
 */
export function calculateDesperation(
  manufacturerId: string,
  currentSeason: number,
  contracts: ActiveManufacturerContract[]
): number {
  // Count teams currently with this manufacturer (engine contracts only)
  const currentTeams = contracts.filter(
    (c) =>
      c.manufacturerId === manufacturerId &&
      c.type === ManufacturerType.Engine &&
      c.startSeason <= currentSeason &&
      c.endSeason >= currentSeason
  ).length;

  // Count teams secured for next season
  const nextSeason = currentSeason + 1;
  const securedNextYear = contracts.filter(
    (c) =>
      c.manufacturerId === manufacturerId &&
      c.type === ManufacturerType.Engine &&
      c.startSeason <= nextSeason &&
      c.endSeason >= nextSeason
  ).length;

  // How many teams does this manufacturer need to replace?
  const needed = currentTeams - securedNextYear;

  // If already secured enough, not desperate
  if (needed <= 0) return 0;

  // Count all unsigned teams for next season
  const teamsWithContractsNextSeason = new Set(
    contracts
      .filter(
        (c) =>
          c.type === ManufacturerType.Engine &&
          c.startSeason <= nextSeason &&
          c.endSeason >= nextSeason
      )
      .map((c) => c.teamId)
  );

  // Get total unique teams from current contracts
  const allTeams = new Set(
    contracts.filter((c) => c.type === ManufacturerType.Engine).map((c) => c.teamId)
  );

  const unsignedTeamsCount = allTeams.size - teamsWithContractsNextSeason.size;

  // Desperation increases when unsigned teams ≤ what manufacturer needs
  if (unsignedTeamsCount <= 0) {
    // No unsigned teams available - maximum desperation
    return 1;
  }

  if (unsignedTeamsCount <= needed) {
    // Desperate: not enough unsigned teams to fill the gap
    return Math.min(1, needed / unsignedTeamsCount);
  }

  // Some desperation if they need teams but there are options
  return Math.min(0.3, needed / (unsignedTeamsCount * 2));
}

/**
 * Calculates whether a contract offer is profitable for the manufacturer
 *
 * @param manufacturer - The manufacturer making the offer
 * @param terms - The proposed contract terms
 * @returns True if profitable (or acceptable with desperation), false otherwise
 */
export function isOfferProfitable(
  manufacturer: Manufacturer,
  terms: ContractTerms,
  desperation: number
): boolean {
  // Calculate total revenue over contract duration
  const totalRevenue = terms.annualCost * terms.duration;

  // Calculate total costs
  const baseCost = manufacturer.costs.baseEngine * 2 * terms.duration; // 2 engines per year
  const upgradeCost = manufacturer.costs.upgrade * terms.upgradesIncluded * terms.duration;
  const customisationCost =
    manufacturer.costs.customisationPoint * terms.customisationPointsIncluded;
  const optimisationCost = terms.optimisationIncluded ? manufacturer.costs.optimisation : 0;

  const totalCost = baseCost + upgradeCost + customisationCost + optimisationCost;

  // Calculate profit margin
  const margin = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : -1;

  // Minimum acceptable margin reduces with desperation
  const minAcceptableMargin = MIN_PROFIT_MARGIN * (1 - desperation * 0.8);

  return margin >= minAcceptableMargin;
}

/**
 * Generates base contract terms for a manufacturer's standard offer
 *
 * @param manufacturer - The manufacturer making the offer
 * @param desperation - Manufacturer's desperation level (0-1)
 * @param isLateSeason - Whether this is late in the season (penalty applies)
 * @returns Base contract terms
 */
export function generateBaseContractTerms(
  manufacturer: Manufacturer,
  desperation: number,
  isLateSeason: boolean
): ContractTerms {
  // Base annual cost is manufacturer's standard rate
  let annualCost = manufacturer.annualCost;

  // Apply desperation discount (up to 30% off)
  const desperationDiscount = desperation * MAX_DESPERATION_DISCOUNT;
  annualCost = annualCost * (1 - desperationDiscount);

  // Apply late season penalty
  if (isLateSeason) {
    annualCost = annualCost * LATE_NEGOTIATION_PENALTY;
  }

  return {
    annualCost: Math.round(annualCost),
    duration: DEFAULT_CONTRACT_DURATION,
    upgradesIncluded: 0,
    customisationPointsIncluded: 0,
    optimisationIncluded: false,
  };
}

/**
 * Creates a contract offer from a manufacturer
 *
 * @param manufacturerId - ID of the manufacturer
 * @param terms - The contract terms being offered
 * @param currentDate - Current game date
 * @param desperation - Manufacturer's desperation level
 * @param isCounterOffer - Whether this is a counter to player's request
 * @param isProactive - Whether manufacturer initiated this
 * @returns A new ContractOffer
 */
export function createContractOffer(
  manufacturerId: string,
  terms: ContractTerms,
  currentDate: GameDate,
  desperation: number,
  isCounterOffer: boolean,
  isProactive: boolean
): ContractOffer {
  return {
    id: `offer-${manufacturerId}-${Date.now()}`,
    manufacturerId,
    terms,
    offeredDate: { ...currentDate },
    expiresDate: offsetGameDate(currentDate, OFFER_EXPIRY_DAYS),
    desperationAtOffer: desperation,
    isCounterOffer,
    isProactiveOffer: isProactive,
  };
}

/**
 * Creates an empty negotiation state for a team and manufacturer
 */
export function createNegotiation(
  teamId: string,
  manufacturerId: string,
  forSeason: number,
  currentDate: GameDate
): EngineNegotiation {
  return {
    teamId,
    manufacturerId,
    status: NegotiationStatus.AwaitingOffer,
    forSeason,
    offers: [],
    playerCounterTerms: null,
    startedDate: { ...currentDate },
  };
}

/**
 * Checks if a team's contract is expiring at end of current season
 */
export function isContractExpiring(
  teamId: string,
  currentSeason: number,
  contracts: ActiveManufacturerContract[]
): boolean {
  const engineContract = contracts.find(
    (c) => c.teamId === teamId && c.type === ManufacturerType.Engine
  );
  return engineContract?.endSeason === currentSeason;
}

/**
 * Gets the manufacturer ID for a team's current engine contract
 */
export function getCurrentManufacturer(
  teamId: string,
  contracts: ActiveManufacturerContract[]
): string | null {
  const engineContract = contracts.find(
    (c) => c.teamId === teamId && c.type === ManufacturerType.Engine
  );
  return engineContract?.manufacturerId ?? null;
}

/**
 * Offsets a game date by a number of days
 * Simple helper - doesn't handle month/year wraparound perfectly
 */
function offsetGameDate(date: GameDate, days: number): GameDate {
  // Simple implementation - assumes 30-day months for simplicity
  let newDay = date.day + days;
  let newMonth = date.month;
  let newYear = date.year;

  while (newDay > 30) {
    newDay -= 30;
    newMonth++;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
  }

  return { year: newYear, month: newMonth, day: newDay };
}

