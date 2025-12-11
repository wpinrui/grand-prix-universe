/**
 * Team Evaluator
 *
 * Evaluates drivers from the team's perspective for driver shortlisting.
 * Used when AI teams (and player's team) need to decide which drivers to consider.
 *
 * Key mechanics:
 * - Eligible pool: Drivers from one team above + all teams below + free agents/rookies
 * - Experienced drivers: Attractiveness based on perceived value (same as driver-evaluator)
 * - Rookies: Attractiveness based on attribute sum with seeded +/-10% error per team principal
 * - Age multiplier: Young drivers attractive on long deals, veterans less so
 */

import type { Driver, Team, TeamPrincipal } from '../../../shared/domain/types';
import { calculatePerceivedValue, calculateDriverAbility } from './driver-evaluator';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Age thresholds for attractiveness multiplier */
const YOUNG_AGE_THRESHOLD = 26;
const PRIME_AGE_THRESHOLD = 30;
const VETERAN_AGE_THRESHOLD = 34;

/** Error range for rookie evaluation (±10% of attribute sum) */
const ROOKIE_ERROR_RANGE = 0.1;

/** Minimum seasons of F1 history to be considered "experienced" */
const ROOKIE_HISTORY_THRESHOLD = 2;

/** Contract duration thresholds */
const SHORT_CONTRACT = 1;
const MEDIUM_CONTRACT = 2;

/** Attractiveness comparison thresholds */
const UPGRADE_THRESHOLD = 0.05; // 5% better to be considered an upgrade
const SIMILAR_THRESHOLD = 0.1; // Within 10% to be considered similar (potentially cheaper)

// =============================================================================
// AGE MULTIPLIER TABLE
// =============================================================================

/** Age bracket type for type-safe table lookup */
type AgeBracket = 'young' | 'prime' | 'mature' | 'veteran';

/**
 * Age multiplier matrix: [age bracket][contract duration] -> multiplier
 *
 * Young drivers (< 26): More attractive on long deals (developing talent)
 * Prime drivers (26-29): Neutral across all durations
 * Mature drivers (30-33): Slight penalty on long deals
 * Veteran drivers (34+): Significant penalty on long deals (retirement risk)
 *
 * Duration: 1 year, 2 years, 3+ years
 */
const AGE_MULTIPLIER_TABLE: Record<AgeBracket, [number, number, number]> = {
  young: [0.95, 1.0, 1.1], // Young: slight penalty on short, bonus on long
  prime: [1.0, 1.0, 1.0], // Prime: neutral
  mature: [1.0, 0.95, 0.9], // Mature: slight penalty on longer deals
  veteran: [0.9, 0.8, 0.6], // Veteran: increasing penalty for longer commitments
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Clamp a value to the 0-1 range
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Simple hash function for seeded randomness
 * Returns a deterministic value 0-1 based on the input string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Normalize to 0-1
  return Math.abs(hash % 10000) / 10000;
}

/**
 * Get age bracket for a driver
 */
function getAgeBracket(age: number): AgeBracket {
  if (age < YOUNG_AGE_THRESHOLD) return 'young';
  if (age < PRIME_AGE_THRESHOLD) return 'prime';
  if (age < VETERAN_AGE_THRESHOLD) return 'mature';
  return 'veteran';
}

/**
 * Calculate driver's age from date of birth and game year
 */
function calculateAge(dateOfBirth: string, gameYear: number): number {
  const birthYear = new Date(dateOfBirth).getFullYear();
  return gameYear - birthYear;
}

/**
 * Check if driver is considered a rookie (< 2 seasons of F1 history)
 */
function isRookie(driver: Driver): boolean {
  const historyLength = driver.careerHistory?.length ?? 0;
  return historyLength < ROOKIE_HISTORY_THRESHOLD;
}

// =============================================================================
// AGE MULTIPLIER
// =============================================================================

/**
 * Get age-based attractiveness multiplier for a contract duration.
 *
 * @param age - Driver's current age
 * @param contractYears - Proposed contract duration (1-5)
 * @returns Multiplier (0.6 to 1.1)
 */
export function getAgeMultiplier(age: number, contractYears: number): number {
  const bracket = getAgeBracket(age);
  const multipliers = AGE_MULTIPLIER_TABLE[bracket];

  // Map contract duration to index
  let durationIndex: number;
  if (contractYears <= SHORT_CONTRACT) {
    durationIndex = 0;
  } else if (contractYears <= MEDIUM_CONTRACT) {
    durationIndex = 1;
  } else {
    durationIndex = 2; // LONG_CONTRACT (3+)
  }

  return multipliers[durationIndex];
}

// =============================================================================
// DRIVER ATTRACTIVENESS CALCULATION
// =============================================================================

export interface DriverAttractivenessInput {
  driver: Driver;
  teamPrincipalId: string;
  gameYear: number;
  contractYears: number;
}

export interface RankedDriver {
  driver: Driver;
  attractiveness: number;
  isRookie: boolean;
  age: number;
}

/**
 * Calculate how attractive a driver is to a team.
 *
 * For experienced drivers: Uses perceived value (contribution ratio history)
 * For rookies: Uses attribute sum with seeded error unique to the team principal
 *
 * Result is then adjusted by age multiplier for contract duration.
 *
 * @returns Attractiveness score (0-1 scale)
 */
export function calculateDriverAttractiveness(input: DriverAttractivenessInput): number {
  const { driver, teamPrincipalId, gameYear, contractYears } = input;

  let baseAttractiveness: number;

  if (isRookie(driver)) {
    // Rookie: ability score with seeded error
    const normalizedAbility = calculateDriverAbility(driver);

    // Generate team-principal-specific error for this driver
    // Convert 0-1 seed to symmetric -1 to +1 range, then scale by error range
    const errorSeed = hashString(`${teamPrincipalId}-${driver.id}`);
    const error = (errorSeed * 2 - 1) * ROOKIE_ERROR_RANGE; // -0.1 to +0.1

    // Apply error to normalized ability, clamped to 0-1
    baseAttractiveness = clamp01(normalizedAbility + error);
  } else {
    // Experienced driver: use perceived value
    baseAttractiveness = calculatePerceivedValue(driver.careerHistory);
  }

  // Apply age multiplier based on contract duration
  const age = calculateAge(driver.dateOfBirth, gameYear);
  const ageMultiplier = getAgeMultiplier(age, contractYears);

  // Final attractiveness, clamped to 0-1
  return clamp01(baseAttractiveness * ageMultiplier);
}

// =============================================================================
// ELIGIBLE DRIVER POOL
// =============================================================================

export interface EligiblePoolInput {
  team: Team;
  constructorStandings: Map<string, number>; // teamId → position (1-indexed)
  allTeams: Team[];
  allDrivers: Driver[];
}

/**
 * Get the pool of drivers a team can consider for their shortlist.
 *
 * Rules:
 * - Drivers from the team directly above in standings (poach target)
 * - Drivers from all teams below in standings (available talent)
 * - Free agents (no teamId)
 * - Excludes own current drivers
 *
 * @returns Array of eligible drivers
 */
export function getEligibleDriverPool(input: EligiblePoolInput): Driver[] {
  const { team, constructorStandings, allTeams, allDrivers } = input;

  const teamPosition = constructorStandings.get(team.id) ?? allTeams.length;

  // Build set of eligible team IDs
  const eligibleTeamIds = new Set<string>();

  // One team directly above (if not already first)
  if (teamPosition > 1) {
    for (const [teamId, position] of constructorStandings.entries()) {
      if (position === teamPosition - 1) {
        eligibleTeamIds.add(teamId);
        break;
      }
    }
  }

  // All teams below
  for (const [teamId, position] of constructorStandings.entries()) {
    if (position > teamPosition) {
      eligibleTeamIds.add(teamId);
    }
  }

  // Filter drivers
  return allDrivers.filter((driver) => {
    // Exclude own drivers
    if (driver.teamId === team.id) return false;

    // Include free agents
    if (!driver.teamId) return true;

    // Include drivers from eligible teams
    return eligibleTeamIds.has(driver.teamId);
  });
}

// =============================================================================
// TEAM SHORTLIST
// =============================================================================

export interface TeamShortlistInput {
  team: Team;
  teamPrincipal: TeamPrincipal;
  constructorStandings: Map<string, number>;
  allTeams: Team[];
  allDrivers: Driver[];
  gameYear: number;
  defaultContractDuration: number; // Typical contract offer duration for this team
}

/**
 * Get a team's driver shortlist, ranked by attractiveness.
 *
 * This is the list of drivers a team would consider approaching or responding to.
 * Drivers are ranked by their attractiveness score (perceived value or attributes).
 *
 * @returns Drivers sorted by attractiveness (highest first)
 */
export function getTeamShortlist(input: TeamShortlistInput): RankedDriver[] {
  const {
    team,
    teamPrincipal,
    constructorStandings,
    allTeams,
    allDrivers,
    gameYear,
    defaultContractDuration,
  } = input;

  // Get eligible pool
  const eligibleDrivers = getEligibleDriverPool({
    team,
    constructorStandings,
    allTeams,
    allDrivers,
  });

  // Calculate attractiveness for each
  const rankedDrivers: RankedDriver[] = eligibleDrivers.map((driver) => {
    const attractiveness = calculateDriverAttractiveness({
      driver,
      teamPrincipalId: teamPrincipal.id,
      gameYear,
      contractYears: defaultContractDuration,
    });

    return {
      driver,
      attractiveness,
      isRookie: isRookie(driver),
      age: calculateAge(driver.dateOfBirth, gameYear),
    };
  });

  // Sort by attractiveness descending
  rankedDrivers.sort((a, b) => b.attractiveness - a.attractiveness);

  return rankedDrivers;
}

// =============================================================================
// TEAM EVALUATION OF DRIVER APPROACH
// =============================================================================

export interface TeamEvaluationInput {
  approachingDriver: Driver;
  team: Team;
  teamPrincipal: TeamPrincipal;
  currentDrivers: Driver[]; // Team's current drivers (0-2)
  constructorStandings: Map<string, number>;
  allTeams: Team[];
  allDrivers: Driver[];
  gameYear: number;
  hasVacancy: boolean; // True if a current driver has committed elsewhere
  proposedDuration: number;
}

export interface TeamEvaluationResult {
  interested: boolean;
  reason: 'upgrade' | 'cheaper' | 'vacancy' | 'not_on_shortlist' | 'downgrade';
  approacherAttractiveness: number;
  currentDriversAttractiveness: number[];
}

/**
 * Evaluate whether a team is interested when a driver approaches them.
 *
 * Team is interested if:
 * 1. Driver is on their shortlist AND
 * 2. One of:
 *    a. Driver is an upgrade over a current driver
 *    b. Driver is similar but potentially cheaper
 *    c. Team has a vacancy (current driver committed elsewhere)
 *
 * @returns Evaluation result with interest flag and reason
 */
export function evaluateDriverApproach(input: TeamEvaluationInput): TeamEvaluationResult {
  const {
    approachingDriver,
    team,
    teamPrincipal,
    currentDrivers,
    constructorStandings,
    allTeams,
    allDrivers,
    gameYear,
    hasVacancy,
    proposedDuration,
  } = input;

  // Calculate approaching driver's attractiveness
  const approacherAttractiveness = calculateDriverAttractiveness({
    driver: approachingDriver,
    teamPrincipalId: teamPrincipal.id,
    gameYear,
    contractYears: proposedDuration,
  });

  // Calculate current drivers' attractiveness
  const currentDriversAttractiveness = currentDrivers.map((d) =>
    calculateDriverAttractiveness({
      driver: d,
      teamPrincipalId: teamPrincipal.id,
      gameYear,
      contractYears: proposedDuration,
    })
  );

  // Check if driver is in eligible pool (on shortlist)
  const eligiblePool = getEligibleDriverPool({
    team,
    constructorStandings,
    allTeams,
    allDrivers,
  });

  const isOnShortlist = eligiblePool.some((d) => d.id === approachingDriver.id);

  if (!isOnShortlist) {
    return {
      interested: false,
      reason: 'not_on_shortlist',
      approacherAttractiveness,
      currentDriversAttractiveness,
    };
  }

  // If team has vacancy, accept anyone on shortlist
  if (hasVacancy) {
    return {
      interested: true,
      reason: 'vacancy',
      approacherAttractiveness,
      currentDriversAttractiveness,
    };
  }

  // Check if approaching driver is better than any current driver
  const worstCurrentAttractiveness = Math.min(...currentDriversAttractiveness, Infinity);

  if (approacherAttractiveness > worstCurrentAttractiveness + UPGRADE_THRESHOLD) {
    return {
      interested: true,
      reason: 'upgrade',
      approacherAttractiveness,
      currentDriversAttractiveness,
    };
  }

  // Check if similar but potentially cheaper
  if (approacherAttractiveness >= worstCurrentAttractiveness - SIMILAR_THRESHOLD) {
    return {
      interested: true,
      reason: 'cheaper',
      approacherAttractiveness,
      currentDriversAttractiveness,
    };
  }

  // Driver is a downgrade
  return {
    interested: false,
    reason: 'downgrade',
    approacherAttractiveness,
    currentDriversAttractiveness,
  };
}
