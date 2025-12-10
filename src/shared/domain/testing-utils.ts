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
import { FacilityType } from './types';
import { offsetDate } from '../utils/date-utils';
import {
  getStaffAbilityTotal,
  getRandomVariance,
  MIN_WORK_UNITS_PER_DAY,
  WORK_VARIANCE_MIN,
  WORK_VARIANCE_MAX,
} from './design-utils';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Facility multiplier bonus for testing
 * Test Rig is the primary facility that affects testing speed
 */
export const TESTING_FACILITY_MULTIPLIER_PER_LEVEL: Partial<Record<FacilityType, number>> = {
  [FacilityType.TestRig]: 0.1, // +10% per level (1-5)
};

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

  const mechanicAbility = getStaffAbilityTotal(staffCounts);
  const facilityMultiplier = getTestingFacilityMultiplier(facilities);
  const variance = getRandomVariance(randomSeed);

  const rawWorkUnits =
    mechanicAbility * (percentAllocated / 100) * facilityMultiplier * variance;

  // Floor to minimum (but only if there's any allocation)
  return Math.max(MIN_WORK_UNITS_PER_DAY, Math.round(rawWorkUnits));
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

  const mechanicAbility = getStaffAbilityTotal(staffCounts);
  const facilityMultiplier = getTestingFacilityMultiplier(facilities);
  const avgVariance = (WORK_VARIANCE_MIN + WORK_VARIANCE_MAX) / 2;

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
