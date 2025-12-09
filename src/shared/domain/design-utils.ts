/**
 * Design Utilities - Work unit calculation for design department progress
 *
 * Work units measure daily design progress. The formula:
 *   workUnitsPerDay = staffAbility × allocation × facilityMultiplier × chiefBonus × variance
 *
 * This module provides pure functions for these calculations.
 */

import type {
  Chief,
  Facility,
  StaffCounts,
  ChassisDesign,
  ChassisStageProgress,
} from './types';
import { ChassisDesignStage, FacilityType, StaffQuality } from './types';

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
// CHASSIS PROGRESSION CONSTANTS
// =============================================================================

/**
 * Work units required to earn 1 point of stage progress (0-10 scale per stage)
 * With a typical team (~300 staff ability, 50% allocation, 1.2x facilities),
 * this means roughly 2-3 days per point, or ~80-120 days per stage.
 */
export const WORK_UNITS_PER_STAGE_POINT = 500;

/**
 * Maximum progress per stage (10 points = stage complete)
 */
export const MAX_STAGE_PROGRESS = 10;

/**
 * Ordered stages for chassis design (Design → CFD → Model → Wind Tunnel)
 */
export const CHASSIS_STAGE_ORDER: readonly ChassisDesignStage[] = [
  ChassisDesignStage.Design,
  ChassisDesignStage.CFD,
  ChassisDesignStage.Model,
  ChassisDesignStage.WindTunnel,
];

/**
 * Facility required for each chassis stage (null = no facility required)
 * - Design: No facility required (basic CAD work)
 * - CFD: Supercomputer required
 * - Model: Workshop required (model shop)
 * - Wind Tunnel: Wind Tunnel facility required
 */
export const STAGE_FACILITY_REQUIREMENTS: Record<ChassisDesignStage, FacilityType | null> = {
  [ChassisDesignStage.Design]: null,
  [ChassisDesignStage.CFD]: FacilityType.Supercomputer,
  [ChassisDesignStage.Model]: FacilityType.Workshop,
  [ChassisDesignStage.WindTunnel]: FacilityType.WindTunnel,
};

/**
 * Maximum efficiency bonus points from chief designer (additive to base efficiency)
 * A 100-ability chief adds up to this many points to the efficiency rating
 */
export const CHIEF_DESIGNER_MAX_EFFICIENCY_BONUS = 20;

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

// =============================================================================
// CHASSIS PROGRESSION FUNCTIONS
// =============================================================================

/**
 * Check if a facility is available (quality > 0)
 */
export function hasFacility(facilities: Facility[], type: FacilityType): boolean {
  const facility = facilities.find((f) => f.type === type);
  return facility !== undefined && facility.quality > 0;
}

/**
 * Check if a chassis stage can progress (required facility available)
 *
 * @param stage - The stage to check
 * @param facilities - Available facilities
 * @returns true if stage can progress, false if blocked by missing facility
 */
export function canProgressStage(stage: ChassisDesignStage, facilities: Facility[]): boolean {
  const requiredFacility = STAGE_FACILITY_REQUIREMENTS[stage];
  if (requiredFacility === null) {
    return true; // No facility required
  }
  return hasFacility(facilities, requiredFacility);
}

/**
 * Find the current (first incomplete) stage in the chassis design
 *
 * @param stages - Array of stage progress
 * @returns The first incomplete stage, or null if all stages are complete
 */
export function getCurrentStage(stages: ChassisStageProgress[]): ChassisStageProgress | null {
  for (const stageType of CHASSIS_STAGE_ORDER) {
    const stage = stages.find((s) => s.stage === stageType);
    if (stage && !stage.completed) {
      return stage;
    }
  }
  return null;
}

/**
 * Calculate chassis efficiency rating from stage progress
 * Efficiency = (total stage points / 40) * 100 + chief bonus
 * Capped at 100
 *
 * @param stages - Array of stage progress
 * @param chiefDesigner - Chief designer (null if vacant)
 * @returns Efficiency rating 0-100
 */
export function calculateChassisEfficiency(
  stages: ChassisStageProgress[],
  chiefDesigner: Chief | null
): number {
  const totalProgress = stages.reduce((sum, stage) => sum + stage.progress, 0);
  const maxProgress = CHASSIS_STAGE_ORDER.length * MAX_STAGE_PROGRESS; // 40
  const baseEfficiency = (totalProgress / maxProgress) * 100;

  // Chief bonus: scaled by ability (100 ability = max bonus)
  const chiefBonus = chiefDesigner
    ? (chiefDesigner.ability / 100) * CHIEF_DESIGNER_MAX_EFFICIENCY_BONUS
    : 0;

  return Math.min(100, Math.round(baseEfficiency + chiefBonus));
}

/**
 * Result of processing a day of chassis work
 */
export interface ChassisProgressionResult {
  /** Updated chassis design state */
  updatedChassis: ChassisDesign;
  /** Stage that was completed this day, if any */
  completedStage: ChassisDesignStage | null;
  /** Whether progress was blocked (missing facility) */
  blocked: boolean;
  /** If blocked, which facility is missing */
  missingFacility: FacilityType | null;
}

/**
 * Process a day of work on next year's chassis
 *
 * This function:
 * 1. Calculates daily work units
 * 2. Adds to accumulated work units
 * 3. Converts accumulated units to stage progress when threshold reached
 * 4. Marks stages complete when they reach 10 points
 * 5. Recalculates efficiency rating
 *
 * @param chassis - Current chassis design state
 * @param workUnits - Work units produced this day
 * @param facilities - Available facilities (for stage unlock checks)
 * @param chiefDesigner - Chief designer (for efficiency calculation)
 * @returns Updated chassis state and any completion event
 */
export function processChassisDay(
  chassis: ChassisDesign,
  workUnits: number,
  facilities: Facility[],
  chiefDesigner: Chief | null
): ChassisProgressionResult {
  // Find current stage
  const currentStage = getCurrentStage(chassis.stages);

  // All stages complete - no more work to do
  if (!currentStage) {
    return {
      updatedChassis: chassis,
      completedStage: null,
      blocked: false,
      missingFacility: null,
    };
  }

  // Check if current stage can progress (facility requirement)
  if (!canProgressStage(currentStage.stage, facilities)) {
    const missingFacility = STAGE_FACILITY_REQUIREMENTS[currentStage.stage];
    return {
      updatedChassis: chassis,
      completedStage: null,
      blocked: true,
      missingFacility,
    };
  }

  // Accumulate work units
  let accumulated = chassis.accumulatedWorkUnits + workUnits;
  let completedStage: ChassisDesignStage | null = null;

  // Create mutable copy of stages
  const updatedStages = chassis.stages.map((s) => ({ ...s }));
  const stageToUpdate = updatedStages.find((s) => s.stage === currentStage.stage);

  if (stageToUpdate) {
    // Convert accumulated work units to progress points
    while (accumulated >= WORK_UNITS_PER_STAGE_POINT && stageToUpdate.progress < MAX_STAGE_PROGRESS) {
      accumulated -= WORK_UNITS_PER_STAGE_POINT;
      stageToUpdate.progress += 1;
    }

    // Check if stage just completed
    if (stageToUpdate.progress >= MAX_STAGE_PROGRESS && !stageToUpdate.completed) {
      stageToUpdate.completed = true;
      completedStage = stageToUpdate.stage;
      // Reset accumulated for next stage
      accumulated = 0;
    }
  }

  // Calculate new efficiency rating
  const newEfficiency = calculateChassisEfficiency(updatedStages, chiefDesigner);

  const updatedChassis: ChassisDesign = {
    ...chassis,
    stages: updatedStages,
    accumulatedWorkUnits: accumulated,
    efficiencyRating: newEfficiency,
  };

  return {
    updatedChassis,
    completedStage,
    blocked: false,
    missingFacility: null,
  };
}
