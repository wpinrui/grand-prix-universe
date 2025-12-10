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
  TechnologyDesignProject,
  TechnologyLevel,
  HandlingProblemState,
  CurrentYearChassisState,
} from './types';
import {
  ChassisDesignStage,
  FacilityType,
  StaffQuality,
  TechnologyProjectPhase,
  TechnologyComponent,
  HandlingProblem,
} from './types';

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
/**
 * Result of processing a day of chassis work
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

// =============================================================================
// TECHNOLOGY BREAKTHROUGH CONSTANTS
// =============================================================================

/**
 * Base probability of discovering a breakthrough per day (with 100% allocation)
 * A team with average setup (~5% daily chance) discovers a breakthrough every ~20 days
 */
export const BASE_BREAKTHROUGH_PROBABILITY = 0.05;

/**
 * Minimum payoff for a technology breakthrough (stat increase)
 */
export const MIN_BREAKTHROUGH_PAYOFF = 3;

/**
 * Maximum payoff for a technology breakthrough (stat increase)
 */
export const MAX_BREAKTHROUGH_PAYOFF = 12;

/**
 * Base work units required to complete breakthrough development
 * Actual requirement varies based on payoff (higher payoff = more work)
 */
export const BASE_DEVELOPMENT_WORK_UNITS = 2000;

/**
 * Work units per payoff point (higher payoff = more development time)
 */
export const WORK_UNITS_PER_PAYOFF_POINT = 300;

/**
 * Chief designer bonus to breakthrough probability (per point of ability)
 * A 100-ability chief adds 50% to breakthrough chance
 */
export const CHIEF_BREAKTHROUGH_PROBABILITY_BONUS = 0.005;

/**
 * Facility bonus to breakthrough probability (per facility level)
 */
export const FACILITY_BREAKTHROUGH_BONUS: Partial<Record<FacilityType, number>> = {
  [FacilityType.CAD]: 0.01, // +1% per level
  [FacilityType.Supercomputer]: 0.02, // +2% per level
};

/**
 * Chief designer bonus to payoff (ability scaled)
 * A 100-ability chief adds up to 3 extra payoff points
 */
export const CHIEF_MAX_PAYOFF_BONUS = 3;

// =============================================================================
// TECHNOLOGY BREAKTHROUGH FUNCTIONS
// =============================================================================

/**
 * Calculate the daily probability of discovering a breakthrough
 *
 * @param percentAllocated - Designer capacity allocated to this project (0-100)
 * @param chiefDesigner - Chief designer (null if position vacant)
 * @param facilities - Factory facilities
 * @returns Probability (0-1) of discovering a breakthrough today
 */
export function calculateBreakthroughProbability(
  percentAllocated: number,
  chiefDesigner: Chief | null,
  facilities: Facility[]
): number {
  if (percentAllocated <= 0) return 0;

  // Base probability scaled by allocation
  let probability = BASE_BREAKTHROUGH_PROBABILITY * (percentAllocated / 100);

  // Chief designer bonus
  if (chiefDesigner) {
    probability += chiefDesigner.ability * CHIEF_BREAKTHROUGH_PROBABILITY_BONUS;
  }

  // Facility bonuses
  for (const facility of facilities) {
    const bonus = FACILITY_BREAKTHROUGH_BONUS[facility.type];
    if (bonus !== undefined && facility.quality > 0) {
      probability += bonus * facility.quality;
    }
  }

  return Math.min(1, probability); // Cap at 100%
}

/**
 * Generate breakthrough parameters (payoff and work units required)
 *
 * @param chiefDesigner - Chief designer (null if position vacant)
 * @param randomSeed - Optional seed for deterministic testing
 * @returns Payoff amount and work units required
 */
export function generateBreakthroughParams(
  chiefDesigner: Chief | null,
  randomSeed?: number
): { payoff: number; workUnitsRequired: number } {
  const random = randomSeed !== undefined ? seededRandom(randomSeed) : Math.random();

  // Calculate payoff range
  let maxPayoff = MAX_BREAKTHROUGH_PAYOFF;
  if (chiefDesigner) {
    maxPayoff += Math.floor((chiefDesigner.ability / 100) * CHIEF_MAX_PAYOFF_BONUS);
  }

  // Random payoff in range
  const payoff = MIN_BREAKTHROUGH_PAYOFF + Math.floor(random * (maxPayoff - MIN_BREAKTHROUGH_PAYOFF + 1));

  // Work units scale with payoff
  const workUnitsRequired = BASE_DEVELOPMENT_WORK_UNITS + payoff * WORK_UNITS_PER_PAYOFF_POINT;

  return { payoff, workUnitsRequired };
}

/**
 * Result of processing a day of technology project work
 */
export interface TechnologyProjectResult {
  /** Updated project (with new work units, phase transition, etc.) */
  updatedProject: TechnologyDesignProject;
  /** True if breakthrough was discovered this day (Discovery → Development) */
  breakthroughDiscovered: boolean;
  /** True if development was completed this day */
  developmentCompleted: boolean;
  /** Payoff amount (only set if breakthrough discovered or development completed) */
  payoff: number | null;
  /** Work units required (only set if breakthrough discovered) */
  workUnitsRequired: number | null;
}

/**
 * Process a day of work on a technology project
 *
 * Handles both Discovery and Development phases:
 * - Discovery: Daily probability check for breakthrough
 * - Development: Work unit accumulation toward completion
 *
 * @param project - Current project state
 * @param workUnits - Work units produced this day
 * @param chiefDesigner - Chief designer (for breakthrough params)
 * @param facilities - Factory facilities (for breakthrough probability)
 * @param randomSeed - Optional seed for deterministic testing
 * @returns Updated project state and events
 */
export function processTechnologyProjectDay(
  project: TechnologyDesignProject,
  workUnits: number,
  chiefDesigner: Chief | null,
  facilities: Facility[],
  randomSeed?: number
): TechnologyProjectResult {
  const random = randomSeed !== undefined ? seededRandom(randomSeed) : Math.random();

  // Discovery phase: check for breakthrough
  if (project.phase === TechnologyProjectPhase.Discovery) {
    const probability = calculateBreakthroughProbability(
      project.designersAssigned,
      chiefDesigner,
      facilities
    );

    if (random < probability) {
      // Breakthrough discovered! Generate params and transition to Development
      const { payoff, workUnitsRequired } = generateBreakthroughParams(
        chiefDesigner,
        randomSeed !== undefined ? randomSeed + 1 : undefined
      );

      return {
        updatedProject: {
          ...project,
          phase: TechnologyProjectPhase.Development,
          payoff,
          workUnitsRequired,
          workUnitsCompleted: 0,
        },
        breakthroughDiscovered: true,
        developmentCompleted: false,
        payoff,
        workUnitsRequired,
      };
    }

    // No breakthrough yet
    return {
      updatedProject: project,
      breakthroughDiscovered: false,
      developmentCompleted: false,
      payoff: null,
      workUnitsRequired: null,
    };
  }

  // Development phase: accumulate work units
  const newWorkUnitsCompleted = project.workUnitsCompleted + workUnits;
  const isComplete =
    project.workUnitsRequired !== null && newWorkUnitsCompleted >= project.workUnitsRequired;

  return {
    updatedProject: {
      ...project,
      workUnitsCompleted: newWorkUnitsCompleted,
    },
    breakthroughDiscovered: false,
    developmentCompleted: isComplete,
    payoff: isComplete ? project.payoff : null,
    workUnitsRequired: null,
  };
}

// =============================================================================
// CURRENT YEAR CHASSIS (HANDLING PROBLEMS) CONSTANTS
// =============================================================================

/**
 * Work units required to earn 1 point of solution progress (0-10 scale)
 * Same as chassis stage progress for consistency
 */
export const WORK_UNITS_PER_SOLUTION_POINT = 500;

/**
 * Maximum solution progress (10 points = solution designed)
 */
export const MAX_SOLUTION_PROGRESS = 10;

/**
 * Fixed stat improvement when a handling solution is completed
 * Represents general handling improvement from fixing a problem
 */
export const HANDLING_SOLUTION_STAT_INCREASE = 5;

// =============================================================================
// CURRENT YEAR CHASSIS FUNCTIONS
// =============================================================================

/**
 * Result of processing a day of handling problem solution work
 */
export interface HandlingSolutionResult {
  /** Updated handling problem state */
  updatedProblem: HandlingProblemState;
  /** True if solution was completed this day */
  solutionCompleted: boolean;
}

/**
 * Process a day of work on a handling problem solution
 *
 * Unlike technology breakthroughs, handling solution progress is deterministic
 * once a problem is discovered through testing.
 *
 * @param problem - Current problem state
 * @param workUnits - Work units produced this day
 * @param accumulatedWorkUnits - Previous accumulated work (partial progress)
 * @returns Updated problem state and completion flag
 */
export function processHandlingSolutionDay(
  problem: HandlingProblemState,
  workUnits: number,
  accumulatedWorkUnits: number
): { result: HandlingSolutionResult; newAccumulatedWorkUnits: number } {
  // Skip if not discovered or already designed
  if (!problem.discovered || problem.solutionDesigned) {
    return {
      result: {
        updatedProblem: problem,
        solutionCompleted: false,
      },
      newAccumulatedWorkUnits: accumulatedWorkUnits,
    };
  }

  // Accumulate work units
  let accumulated = accumulatedWorkUnits + workUnits;
  let progress = problem.solutionProgress;

  // Convert accumulated work units to progress points
  while (accumulated >= WORK_UNITS_PER_SOLUTION_POINT && progress < MAX_SOLUTION_PROGRESS) {
    accumulated -= WORK_UNITS_PER_SOLUTION_POINT;
    progress += 1;
  }

  // Check if solution just completed
  const solutionCompleted = progress >= MAX_SOLUTION_PROGRESS && !problem.solutionDesigned;

  return {
    result: {
      updatedProblem: {
        ...problem,
        solutionProgress: progress,
        solutionDesigned: solutionCompleted || problem.solutionDesigned,
      },
      solutionCompleted,
    },
    newAccumulatedWorkUnits: accumulated,
  };
}

/**
 * Result of processing a day of current year chassis work
 */
export interface CurrentYearChassisResult {
  /** Updated current year chassis state */
  updatedState: CurrentYearChassisState;
  /** Problem that had its solution completed this day, if any */
  completedSolution: HandlingProblem | null;
  /** Accumulated work units (for partial progress tracking) */
  accumulatedWorkUnits: number;
}

/**
 * Process a day of work on current year chassis improvements
 *
 * Works on the active design problem (if any) to create a solution.
 *
 * @param state - Current year chassis state
 * @param workUnits - Work units produced this day
 * @param accumulatedWorkUnits - Previous accumulated work (partial progress)
 * @returns Updated state and any completion event
 */
export function processCurrentYearChassisDay(
  state: CurrentYearChassisState,
  workUnits: number,
  accumulatedWorkUnits: number
): CurrentYearChassisResult {
  // No active problem being worked on
  if (!state.activeDesignProblem) {
    return {
      updatedState: state,
      completedSolution: null,
      accumulatedWorkUnits,
    };
  }

  // Find the problem being worked on
  const problemIndex = state.problems.findIndex(
    (p: HandlingProblemState) => p.problem === state.activeDesignProblem
  );

  if (problemIndex === -1) {
    return {
      updatedState: state,
      completedSolution: null,
      accumulatedWorkUnits,
    };
  }

  const problem = state.problems[problemIndex];
  const { result, newAccumulatedWorkUnits } = processHandlingSolutionDay(
    problem,
    workUnits,
    accumulatedWorkUnits
  );

  // Update the problems array
  const updatedProblems = [...state.problems];
  updatedProblems[problemIndex] = result.updatedProblem;

  // Clear active problem if solution completed
  const newActiveDesignProblem = result.solutionCompleted ? null : state.activeDesignProblem;

  return {
    updatedState: {
      ...state,
      problems: updatedProblems,
      activeDesignProblem: newActiveDesignProblem,
    },
    completedSolution: result.solutionCompleted ? problem.problem : null,
    accumulatedWorkUnits: result.solutionCompleted ? 0 : newAccumulatedWorkUnits,
  };
}

// =============================================================================
// END-OF-SEASON NORMALIZATION CONSTANTS
// =============================================================================

/**
 * Maximum stat value after normalization (best team on grid)
 */
export const NORMALIZATION_MAX = 60;

/**
 * Minimum stat value after normalization (worst team on grid)
 */
export const NORMALIZATION_MIN = 10;

// =============================================================================
// END-OF-SEASON NORMALIZATION FUNCTIONS
// =============================================================================

/**
 * Normalize a single stat array to the 10-60 range
 *
 * Best value → 60, Worst value → 10, others proportionally distributed
 *
 * @param values - Array of stat values to normalize
 * @returns Array of normalized values in the same order
 */
export function normalizeStats(values: number[]): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) {
    // Single team: give them middle-of-the-road stat
    return [Math.round((NORMALIZATION_MAX + NORMALIZATION_MIN) / 2)];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  // All values equal: everyone gets middle stat
  if (max === min) {
    return values.map(() => Math.round((NORMALIZATION_MAX + NORMALIZATION_MIN) / 2));
  }

  // Normalize each value proportionally
  return values.map((value) => {
    const proportion = (value - min) / (max - min);
    return Math.round(NORMALIZATION_MIN + proportion * (NORMALIZATION_MAX - NORMALIZATION_MIN));
  });
}

/**
 * Input for end-of-season normalization
 */
export interface NormalizationInput {
  /** Team IDs in consistent order */
  teamIds: string[];
  /** Technology levels for each team (keyed by team ID) */
  technologyLevels: Record<string, TechnologyLevel[]>;
  /** Chassis efficiency for each team (keyed by team ID) */
  chassisEfficiency: Record<string, number>;
}

/**
 * Result of end-of-season normalization
 */
export interface NormalizationResult {
  /** Normalized technology levels (keyed by team ID) */
  normalizedTechnologyLevels: Record<string, TechnologyLevel[]>;
  /** Normalized chassis efficiency (keyed by team ID) */
  normalizedChassisEfficiency: Record<string, number>;
}

/**
 * Perform end-of-season normalization on all teams' stats
 *
 * Normalizes:
 * - Each technology component's Performance (independently)
 * - Each technology component's Reliability (independently)
 * - Chassis efficiency rating
 *
 * @param input - All teams' stats to normalize
 * @returns Normalized stats for all teams
 */
export function performSeasonEndNormalization(input: NormalizationInput): NormalizationResult {
  const { teamIds, technologyLevels, chassisEfficiency } = input;

  if (teamIds.length === 0) {
    return {
      normalizedTechnologyLevels: {},
      normalizedChassisEfficiency: {},
    };
  }

  // Get all technology components from first team (assume all teams have same components)
  const firstTeamTech = technologyLevels[teamIds[0]] || [];
  const components = firstTeamTech.map((t) => t.component);

  // Normalize each technology component's performance and reliability independently
  const normalizedTechByComponent: Record<
    TechnologyComponent,
    { performances: number[]; reliabilities: number[] }
  > = {} as Record<TechnologyComponent, { performances: number[]; reliabilities: number[] }>;

  // Collect values for each component
  for (const component of components) {
    const performances: number[] = [];
    const reliabilities: number[] = [];

    for (const teamId of teamIds) {
      const teamTech = technologyLevels[teamId] || [];
      const tech = teamTech.find((t) => t.component === component);
      performances.push(tech?.performance ?? 0);
      reliabilities.push(tech?.reliability ?? 0);
    }

    normalizedTechByComponent[component] = {
      performances: normalizeStats(performances),
      reliabilities: normalizeStats(reliabilities),
    };
  }

  // Normalize chassis efficiency
  const chassisValues = teamIds.map((id) => chassisEfficiency[id] ?? 0);
  const normalizedChassis = normalizeStats(chassisValues);

  // Build result
  const normalizedTechnologyLevels: Record<string, TechnologyLevel[]> = {};
  const normalizedChassisEfficiency: Record<string, number> = {};

  for (let i = 0; i < teamIds.length; i++) {
    const teamId = teamIds[i];

    // Build normalized technology levels for this team
    normalizedTechnologyLevels[teamId] = components.map((component) => ({
      component,
      performance: normalizedTechByComponent[component].performances[i],
      reliability: normalizedTechByComponent[component].reliabilities[i],
    }));

    normalizedChassisEfficiency[teamId] = normalizedChassis[i];
  }

  return {
    normalizedTechnologyLevels,
    normalizedChassisEfficiency,
  };
}
