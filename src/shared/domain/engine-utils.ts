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
} from './types';

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
  const statsToImprove = reputation >= 70 ? 3 : 2;

  // Shuffle stats to pick random ones
  const shuffledStats = [...ENGINE_STAT_KEYS].sort(() => Math.random() - 0.5);
  const selectedStats = shuffledStats.slice(0, statsToImprove);

  for (const stat of selectedStats) {
    // Base improvement 1-3, higher reputation gets +1
    const baseImprovement = Math.floor(Math.random() * 3) + 1;
    const reputationBonus = reputation >= 80 ? 1 : 0;
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
  // Reputation modifier: 80+ reputation gets 50% bonus probability
  const reputationModifier = reputation >= 80 ? 1.5 : reputation >= 60 ? 1.2 : 1.0;
  const adjustedProbability = BASE_SPEC_RELEASE_PROBABILITY_PER_DAY * reputationModifier;
  return Math.random() < adjustedProbability;
}

/**
 * Gets the spec bonuses array from ManufacturerSpecState, converting to EngineStats format
 * Used by getEffectiveEngineStats which expects EngineStats[]
 */
export function getSpecBonusesAsEngineStats(specState: ManufacturerSpecState): EngineStats[] {
  return specState.specBonuses.map((bonus) => ({
    power: bonus.power,
    fuelEfficiency: bonus.fuelEfficiency,
    reliability: bonus.reliability,
    heat: bonus.heat,
    predictability: bonus.predictability,
  }));
}
