/**
 * Design Utilities - Work unit calculation for design department progress
 *
 * Work units measure daily design progress. The formula:
 *   workUnitsPerDay = staffAbility × allocation × facilityMultiplier × chiefBonus × variance
 *
 * This module provides pure functions for these calculations.
 */

import type { Chief, Facility, StaffCounts } from './types';
import { FacilityType, StaffQuality } from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Ability points per staff quality tier
 * Higher quality staff contribute more to daily work output
 */
export const STAFF_ABILITY_BY_QUALITY: Record<StaffQuality, number> = {
  [StaffQuality.Trainee]: 20,
  [StaffQuality.Average]: 40,
  [StaffQuality.Good]: 60,
  [StaffQuality.VeryGood]: 80,
  [StaffQuality.Excellent]: 100,
};

/**
 * Facility multiplier bonus per quality level (0-5)
 * Only design-relevant facilities are included
 */
export const FACILITY_MULTIPLIER_PER_LEVEL: Partial<Record<FacilityType, number>> = {
  [FacilityType.CAD]: 0.05, // +5% per level
  [FacilityType.CAM]: 0.05, // +5% per level
  [FacilityType.Supercomputer]: 0.03, // +3% per level
  [FacilityType.Workshop]: 0.02, // +2% per level
};

/**
 * Random variance range for daily work output
 * Provides day-to-day variation without being punishing
 */
export const WORK_VARIANCE_MIN = 0.9;
export const WORK_VARIANCE_MAX = 1.1;

/**
 * Minimum work units per day (floor to prevent zero-progress days)
 */
export const MIN_WORK_UNITS_PER_DAY = 1;

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate total ability points from design department staff
 *
 * @param staffCounts - Staff counts by quality tier for design department
 * @returns Total ability points (e.g., 5 excellent = 500)
 */
export function getStaffAbilityTotal(staffCounts: StaffCounts): number {
  let total = 0;
  for (const quality of Object.values(StaffQuality)) {
    const count = staffCounts[quality] ?? 0;
    total += count * STAFF_ABILITY_BY_QUALITY[quality];
  }
  return total;
}

/**
 * Calculate facility multiplier from factory facilities
 *
 * @param facilities - All factory facilities
 * @returns Multiplier (1.0 = no bonus, 1.25 = 25% bonus, etc.)
 */
export function getFacilityMultiplier(facilities: Facility[]): number {
  let bonus = 0;
  for (const facility of facilities) {
    const perLevel = FACILITY_MULTIPLIER_PER_LEVEL[facility.type];
    if (perLevel !== undefined && facility.quality > 0) {
      bonus += perLevel * facility.quality;
    }
  }
  return 1 + bonus;
}

/**
 * Calculate chief designer bonus multiplier
 *
 * @param chiefDesigner - Chief designer (null if position vacant)
 * @returns Multiplier (1.0 = no chief, up to 2.0 for 100-ability chief)
 */
export function getChiefDesignerBonus(chiefDesigner: Chief | null): number {
  if (!chiefDesigner) {
    return 1.0;
  }
  return 1.0 + chiefDesigner.ability / 100;
}

/**
 * Generate random variance for daily work output
 *
 * @param seed - Optional seed for deterministic testing
 * @returns Variance multiplier between WORK_VARIANCE_MIN and WORK_VARIANCE_MAX
 */
export function getRandomVariance(seed?: number): number {
  const random = seed !== undefined ? seededRandom(seed) : Math.random();
  return WORK_VARIANCE_MIN + random * (WORK_VARIANCE_MAX - WORK_VARIANCE_MIN);
}

/**
 * Simple seeded random for deterministic testing
 * Uses a basic linear congruential generator
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// =============================================================================
// MAIN CALCULATION
// =============================================================================

/**
 * Input for daily work unit calculation
 */
export interface WorkUnitsInput {
  /** Design department staff counts by quality */
  staffCounts: StaffCounts;
  /** Factory facilities (for multipliers) */
  facilities: Facility[];
  /** Chief designer (null if position vacant) */
  chiefDesigner: Chief | null;
  /** Percentage of designer capacity allocated to this project (0-100) */
  percentAllocated: number;
  /** Optional seed for deterministic variance (testing) */
  randomSeed?: number;
}

/**
 * Calculate daily work units for a design project
 *
 * Formula:
 *   workUnits = staffAbility × (allocation/100) × facilityMultiplier × chiefBonus × variance
 *
 * Returns at least MIN_WORK_UNITS_PER_DAY to prevent zero-progress days
 * (only if allocation > 0)
 *
 * @param input - Staff, facilities, chief, and allocation percentage
 * @returns Work units produced for this day
 */
export function calculateDailyWorkUnits(input: WorkUnitsInput): number {
  const { staffCounts, facilities, chiefDesigner, percentAllocated, randomSeed } = input;

  // No allocation = no progress
  if (percentAllocated <= 0) {
    return 0;
  }

  const staffAbility = getStaffAbilityTotal(staffCounts);
  const facilityMultiplier = getFacilityMultiplier(facilities);
  const chiefBonus = getChiefDesignerBonus(chiefDesigner);
  const variance = getRandomVariance(randomSeed);

  const rawWorkUnits =
    staffAbility * (percentAllocated / 100) * facilityMultiplier * chiefBonus * variance;

  // Floor to minimum (but only if there's any allocation)
  return Math.max(MIN_WORK_UNITS_PER_DAY, Math.round(rawWorkUnits));
}
