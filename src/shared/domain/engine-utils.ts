/**
 * Engine utilities for the engine supplier contracts system
 */

import type {
  EngineStats,
  EngineCustomisation,
  CarEngineState,
  TeamEngineState,
  Manufacturer,
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
 * Maximum customisation adjustment per stat (prevents min-maxing)
 */
export const MAX_CUSTOMISATION_PER_STAT = 10;

/**
 * Season-start normalization ceiling (best manufacturer for each stat)
 */
export const NORMALIZATION_CEILING = 70;

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

  // Clamp to valid range (0-100)
  for (const key of ENGINE_STAT_KEYS) {
    effective[key] = Math.max(0, Math.min(100, effective[key]));
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
    const change = Math.max(-10, Math.min(10, normalRandom(0, 5)));
    evolved[key] = Math.max(0, Math.min(100, stats[key] + change));
  }

  return evolved;
}
