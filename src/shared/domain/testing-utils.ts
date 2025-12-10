/**
 * Testing Utilities - Work unit calculation for development testing
 *
 * Development testing uses mechanics to discover handling problems.
 * Work units measure daily testing progress. The formula:
 *   workUnitsPerDay = mechanicAbility × (allocation/100) × facilityMultiplier × variance
 *
 * This module provides pure functions for these calculations.
 */

import type { StaffCounts, Facility, TestSession, GameDate } from './types';
import { FacilityType, StaffQuality } from './types';
import { offsetDate } from '../utils/date-utils';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Ability points per mechanic staff quality tier
 * Same scale as design staff for consistency
 */
export const MECHANIC_ABILITY_BY_QUALITY: Record<StaffQuality, number> = {
  [StaffQuality.Trainee]: 20,
  [StaffQuality.Average]: 40,
  [StaffQuality.Good]: 60,
  [StaffQuality.VeryGood]: 80,
  [StaffQuality.Excellent]: 100,
};

/**
 * Facility multiplier bonus for testing
 * Test Rig is the primary facility that affects testing speed
 */
export const TESTING_FACILITY_MULTIPLIER_PER_LEVEL: Partial<Record<FacilityType, number>> = {
  [FacilityType.TestRig]: 0.1, // +10% per level (1-5)
};

/**
 * Random variance range for daily testing output
 */
export const TESTING_VARIANCE_MIN = 0.9;
export const TESTING_VARIANCE_MAX = 1.1;

/**
 * Minimum work units per day for testing (floor to prevent zero-progress days)
 */
export const MIN_TESTING_WORK_UNITS_PER_DAY = 1;

/**
 * Work units required to earn 1 point of test progress (0-10 scale)
 * With a typical team (~300 mechanic ability, 50% allocation, 1.3x facility),
 * this means roughly 2-3 days per point, or ~25-30 days per test.
 */
export const WORK_UNITS_PER_TEST_POINT = 500;

/**
 * Maximum test progress (10 points = test complete)
 */
export const MAX_TEST_PROGRESS = 10;

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate total ability points from mechanic department staff
 *
 * @param staffCounts - Staff counts by quality tier for mechanic department
 * @returns Total ability points (e.g., 5 excellent = 500)
 */
export function getMechanicAbilityTotal(staffCounts: StaffCounts): number {
  let total = 0;
  for (const quality of Object.values(StaffQuality)) {
    const count = staffCounts[quality] ?? 0;
    total += count * MECHANIC_ABILITY_BY_QUALITY[quality];
  }
  return total;
}

/**
 * Calculate facility multiplier for testing
 *
 * @param facilities - All factory facilities
 * @returns Multiplier (1.0 = no bonus, 1.5 = 50% bonus with level 5 test rig)
 */
export function getTestingFacilityMultiplier(facilities: Facility[]): number {
  let bonus = 0;
  for (const facility of facilities) {
    const perLevel = TESTING_FACILITY_MULTIPLIER_PER_LEVEL[facility.type];
    if (perLevel !== undefined && facility.quality > 0) {
      bonus += perLevel * facility.quality;
    }
  }
  return 1 + bonus;
}

/**
 * Generate random variance for daily testing output
 *
 * @param seed - Optional seed for deterministic testing
 * @returns Variance multiplier between TESTING_VARIANCE_MIN and TESTING_VARIANCE_MAX
 */
export function getTestingVariance(seed?: number): number {
  const random = seed !== undefined ? seededRandom(seed) : Math.random();
  return TESTING_VARIANCE_MIN + random * (TESTING_VARIANCE_MAX - TESTING_VARIANCE_MIN);
}

/**
 * Simple seeded random for deterministic testing
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// =============================================================================
// MAIN CALCULATION
// =============================================================================

/**
 * Input for daily testing work unit calculation
 */
export interface TestingWorkUnitsInput {
  /** Mechanic department staff counts by quality */
  staffCounts: StaffCounts;
  /** Factory facilities (for test rig multiplier) */
  facilities: Facility[];
  /** Percentage of mechanic capacity allocated to testing (0-100) */
  percentAllocated: number;
  /** Optional seed for deterministic variance (unit tests) */
  randomSeed?: number;
}

/**
 * Calculate daily work units for development testing
 *
 * Formula:
 *   workUnits = mechanicAbility × (allocation/100) × facilityMultiplier × variance
 *
 * Returns at least MIN_TESTING_WORK_UNITS_PER_DAY to prevent zero-progress days
 * (only if allocation > 0)
 *
 * @param input - Staff, facilities, and allocation percentage
 * @returns Work units produced for this day
 */
export function calculateTestingWorkUnits(input: TestingWorkUnitsInput): number {
  const { staffCounts, facilities, percentAllocated, randomSeed } = input;

  // No allocation = no progress
  if (percentAllocated <= 0) {
    return 0;
  }

  const mechanicAbility = getMechanicAbilityTotal(staffCounts);
  const facilityMultiplier = getTestingFacilityMultiplier(facilities);
  const variance = getTestingVariance(randomSeed);

  const rawWorkUnits =
    mechanicAbility * (percentAllocated / 100) * facilityMultiplier * variance;

  // Floor to minimum (but only if there's any allocation)
  return Math.max(MIN_TESTING_WORK_UNITS_PER_DAY, Math.round(rawWorkUnits));
}

// =============================================================================
// ESTIMATION FUNCTIONS
// =============================================================================

/**
 * Calculate average daily testing work units (without random variance)
 * Uses the midpoint of variance range for estimation
 */
export function calculateAverageTestingWorkUnits(
  staffCounts: StaffCounts,
  facilities: Facility[],
  percentAllocated: number
): number {
  if (percentAllocated <= 0) return 0;

  const mechanicAbility = getMechanicAbilityTotal(staffCounts);
  const facilityMultiplier = getTestingFacilityMultiplier(facilities);
  const avgVariance = (TESTING_VARIANCE_MIN + TESTING_VARIANCE_MAX) / 2;

  return mechanicAbility * (percentAllocated / 100) * facilityMultiplier * avgVariance;
}

/**
 * Estimate days remaining to complete current test
 *
 * @param testSession - Current test session state
 * @param staffCounts - Mechanic department staff
 * @param facilities - Factory facilities
 * @returns Estimated days remaining, or null if no test is active
 */
export function estimateTestCompletionDays(
  testSession: TestSession,
  staffCounts: StaffCounts,
  facilities: Facility[]
): number | null {
  if (!testSession.active) return null;

  const progressRemaining = MAX_TEST_PROGRESS - testSession.progress;
  if (progressRemaining <= 0) return 0;

  // Work units needed for remaining progress
  const workUnitsRemaining =
    progressRemaining * WORK_UNITS_PER_TEST_POINT - testSession.accumulatedWorkUnits;

  if (workUnitsRemaining <= 0) return 0;

  const dailyWorkUnits = calculateAverageTestingWorkUnits(
    staffCounts,
    facilities,
    testSession.mechanicsAllocated
  );

  if (dailyWorkUnits <= 0) return null; // No progress possible

  return Math.ceil(workUnitsRemaining / dailyWorkUnits);
}

/**
 * Estimate test completion date
 *
 * @param testSession - Current test session state
 * @param staffCounts - Mechanic department staff
 * @param facilities - Factory facilities
 * @param currentDate - Current game date
 * @returns Estimated completion date, or null if no test is active
 */
export function estimateTestCompletionDate(
  testSession: TestSession,
  staffCounts: StaffCounts,
  facilities: Facility[],
  currentDate: GameDate
): GameDate | null {
  const daysRemaining = estimateTestCompletionDays(testSession, staffCounts, facilities);
  if (daysRemaining === null) return null;
  return offsetDate(currentDate, daysRemaining);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a default (inactive) test session
 */
export function createDefaultTestSession(): TestSession {
  return {
    active: false,
    driverId: null,
    mechanicsAllocated: 0,
    progress: 0,
    accumulatedWorkUnits: 0,
    testsCompleted: 0,
  };
}
