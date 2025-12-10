/**
 * Stub Engine Implementations
 *
 * Simple/random implementations of all engine interfaces for MVP.
 * These return placeholder results and will be replaced with full
 * simulation logic in later phases.
 */

import type {
  IRaceEngine,
  IDesignEngine,
  IConstructionEngine,
  IDevelopmentEngine,
  IStaffEngine,
  IFinancialEngine,
  IMarketEngine,
  IWeatherEngine,
  ICarPerformanceEngine,
  IDriverPerformanceEngine,
  IRegulationEngine,
  ITurnEngine,
  QualifyingInput,
  QualifyingResult,
  RaceInput,
  RaceResult,
  DesignProcessingInput,
  DesignProcessingResult,
  ConstructionInput,
  ConstructionResult,
  DevelopmentInput,
  DevelopmentResult,
  StaffInput,
  StaffResult,
  FinancialInput,
  FinancialResult,
  MarketInput,
  MarketResult,
  WeatherInput,
  WeatherResult,
  CarPerformanceInput,
  CarPerformanceResult,
  DriverPerformanceInput,
  DriverPerformanceResult,
  RegulationInput,
  RegulationResult,
  TurnProcessingInput,
  TurnProcessingResult,
  RaceProcessingInput,
  RaceProcessingResult,
  SeasonEndInput,
  SeasonEndResult,
  DriverStateChange,
  DriverAttributeChange,
  ChiefChange,
  TeamStateChange,
  ChampionshipStandings,
  ChassisStageCompletion,
  TechnologyBreakthrough,
  DesignCompletion,
  DesignUpdate,
} from '../../shared/domain/engines';

import type {
  CalendarEntry,
  Driver,
  Chief,
  Circuit,
  DriverRuntimeState,
  DriverAttributes,
  GameState,
  RaceWeekendResult,
  DriverQualifyingResult,
  DriverRaceResult,
} from '../../shared/domain/types';

import {
  Department,
  GamePhase,
  RaceFinishStatus,
  WeatherCondition,
  DriverStanding,
  ConstructorStanding,
  hasRaceSeat,
  ChiefRole,
} from '../../shared/domain';
import {
  getWeekNumber,
  advanceDay,
  yearToSeason,
  seasonToYear,
  isFriday,
} from '../../shared/utils/date-utils';
import {
  calculateDailyWorkUnits,
  processChassisDay,
  processTechnologyProjectDay,
  processCurrentYearChassisDay,
  applyTechnologyPayoff,
  HANDLING_SOLUTION_STAT_INCREASE,
} from '../../shared/domain/design-utils';

export class StubRaceEngine implements IRaceEngine {
  simulateQualifying(_input: QualifyingInput): QualifyingResult {
    return {};
  }

  simulateRace(_input: RaceInput): RaceResult {
    return {};
  }
}

export class StubDesignEngine implements IDesignEngine {
  processDay(input: DesignProcessingInput): DesignProcessingResult {
    const { designState, staffCounts, chiefDesigner, facilities } = input;

    // Start with unchanged state
    let updatedDesignState = { ...designState };
    const chassisStageCompletions: ChassisStageCompletion[] = [];
    const breakthroughs: TechnologyBreakthrough[] = [];
    const completions: DesignCompletion[] = [];

    // Process next year chassis if exists and has designers assigned
    if (designState.nextYearChassis && designState.nextYearChassis.designersAssigned > 0) {
      const workUnits = calculateDailyWorkUnits({
        staffCounts: staffCounts.design,
        facilities,
        chiefDesigner,
        percentAllocated: designState.nextYearChassis.designersAssigned,
      });

      const chassisResult = processChassisDay(
        designState.nextYearChassis,
        workUnits,
        facilities,
        chiefDesigner
      );

      updatedDesignState = {
        ...updatedDesignState,
        nextYearChassis: chassisResult.updatedChassis,
      };

      // Record stage completion if one occurred
      if (chassisResult.completedStage) {
        chassisStageCompletions.push({
          stage: chassisResult.completedStage,
          newEfficiencyRating: chassisResult.updatedChassis.efficiencyRating,
        });
      }
    }

    // Process technology projects
    const updatedTechnologyProjects = [...designState.activeTechnologyProjects];
    const projectsToRemove: number[] = [];

    for (let i = 0; i < updatedTechnologyProjects.length; i++) {
      const project = updatedTechnologyProjects[i];

      // Calculate work units for this project
      const workUnits = calculateDailyWorkUnits({
        staffCounts: staffCounts.design,
        facilities,
        chiefDesigner,
        percentAllocated: project.designersAssigned,
      });

      const result = processTechnologyProjectDay(
        project,
        workUnits,
        chiefDesigner,
        facilities
      );

      updatedTechnologyProjects[i] = result.updatedProject;

      // Record breakthrough if discovered
      if (result.breakthroughDiscovered && result.payoff !== null && result.workUnitsRequired !== null) {
        breakthroughs.push({
          component: project.component,
          attribute: project.attribute,
          statIncrease: result.payoff,
          workUnitsRequired: result.workUnitsRequired,
          estimatedCompletionDate: input.currentDate, // Simplified - real impl would calculate
        });
      }

      // Record completion and mark for removal
      if (result.developmentCompleted && result.payoff !== null) {
        completions.push({
          type: 'technology',
          component: project.component,
          attribute: project.attribute,
          statIncrease: result.payoff,
        });
        projectsToRemove.push(i);

        // Apply stat increase to technology levels
        updatedDesignState = {
          ...updatedDesignState,
          technologyLevels: applyTechnologyPayoff(
            updatedDesignState.technologyLevels,
            project.component,
            project.attribute,
            result.payoff
          ),
        };
      }
    }

    // Remove completed projects (iterate backwards to preserve indices)
    for (let i = projectsToRemove.length - 1; i >= 0; i--) {
      updatedTechnologyProjects.splice(projectsToRemove[i], 1);
    }

    updatedDesignState = {
      ...updatedDesignState,
      activeTechnologyProjects: updatedTechnologyProjects,
    };

    // Process current year chassis if has designers assigned
    if (designState.currentYearChassis.designersAssigned > 0) {
      const workUnits = calculateDailyWorkUnits({
        staffCounts: staffCounts.design,
        facilities,
        chiefDesigner,
        percentAllocated: designState.currentYearChassis.designersAssigned,
      });

      const currentYearResult = processCurrentYearChassisDay(
        designState.currentYearChassis,
        workUnits,
        designState.currentYearChassis.accumulatedSolutionWorkUnits
      );

      // Persist accumulated work units to avoid losing partial progress
      updatedDesignState = {
        ...updatedDesignState,
        currentYearChassis: {
          ...currentYearResult.updatedState,
          accumulatedSolutionWorkUnits: currentYearResult.accumulatedWorkUnits,
        },
      };

      // Record handling solution completion
      if (currentYearResult.completedSolution) {
        completions.push({
          type: 'handling-solution',
          problem: currentYearResult.completedSolution,
          statIncrease: HANDLING_SOLUTION_STAT_INCREASE,
        });
      }
    }

    return {
      updatedDesignState,
      breakthroughs,
      completions,
      chassisStageCompletions,
    };
  }
}

export class StubConstructionEngine implements IConstructionEngine {
  processConstruction(_input: ConstructionInput): ConstructionResult {
    return {};
  }
}

export class StubDevelopmentEngine implements IDevelopmentEngine {
  processDevelopment(_input: DevelopmentInput): DevelopmentResult {
    return {};
  }
}

export class StubStaffEngine implements IStaffEngine {
  processStaff(_input: StaffInput): StaffResult {
    return {};
  }
}

export class StubFinancialEngine implements IFinancialEngine {
  processFinancials(_input: FinancialInput): FinancialResult {
    return {};
  }
}

export class StubMarketEngine implements IMarketEngine {
  processMarket(_input: MarketInput): MarketResult {
    return {};
  }
}

export class StubWeatherEngine implements IWeatherEngine {
  generateWeather(_input: WeatherInput): WeatherResult {
    return {};
  }
}

export class StubCarPerformanceEngine implements ICarPerformanceEngine {
  calculatePerformance(_input: CarPerformanceInput): CarPerformanceResult {
    return {};
  }
}

export class StubDriverPerformanceEngine implements IDriverPerformanceEngine {
  calculatePerformance(_input: DriverPerformanceInput): DriverPerformanceResult {
    return {};
  }
}

export class StubRegulationEngine implements IRegulationEngine {
  processRegulations(_input: RegulationInput): RegulationResult {
    return {};
  }
}

// =============================================================================
// TURN ENGINE
// =============================================================================

/**
 * Helper: Generate random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Helper: Shuffle an array in place using Fisher-Yates algorithm
 * Returns the same array (mutated) for convenience
 */
function shuffleInPlace<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Shuffle array using Fisher-Yates algorithm (returns new array, does not mutate)
 */
function shuffleArray<T>(array: T[]): T[] {
  return shuffleInPlace([...array]);
}

/**
 * Phase boundaries for the season
 */
const PRESEASON_END_WEEK = 9;
const POSTSEASON_START_WEEK = 50;
const FIRST_RACE_WEEK = 11;
const LAST_RACE_WEEK = 49;

/**
 * Gameplay constants
 */
const FATIGUE_THRESHOLD = 80; // Fatigue level above which fitness drops
const FITNESS_DROP_PER_WEEK = 1; // Fitness decrease when fatigued
const WEEKLY_SALARY_RATE = 0.001; // Weekly salary as percentage of budget (0.1%)

/**
 * Race result constants
 */
const POINTS_BONUS_PER_POINT = 10000; // Budget bonus per championship point earned
const WIN_MORALE_BONUS = 10; // Morale boost for winning
const PODIUM_MORALE_BONUS = 5; // Morale boost for podium (non-win)
const POINTS_MORALE_BONUS = 2; // Morale boost for scoring points (non-podium)
const DNF_MORALE_PENALTY = -5; // Morale penalty for DNF
const WIN_REPUTATION_BONUS = 3; // Reputation boost for winning
const PODIUM_REPUTATION_BONUS = 1; // Reputation boost for podium (non-win)
const DNF_REPUTATION_PENALTY = -1; // Reputation penalty for DNF

/**
 * Weekly change ranges for stub randomization
 * These are placeholder values - real implementation will use
 * more sophisticated calculations based on events, results, etc.
 */
const WEEKLY_FATIGUE_MIN = 1;
const WEEKLY_FATIGUE_MAX = 3;
const WEEKLY_MORALE_MIN = -2;
const WEEKLY_MORALE_MAX = 2;
const WEEKLY_FLUCTUATION_MIN = -1;
const WEEKLY_FLUCTUATION_MAX = 1;

/**
 * Helper: Generate random fluctuations for a set of keys
 * Used for department morale and sponsor satisfaction changes
 */
function generateFluctuations<K extends string>(keys: K[]): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key of keys) {
    result[key] = randomInt(WEEKLY_FLUCTUATION_MIN, WEEKLY_FLUCTUATION_MAX);
  }
  return result;
}

/**
 * Determine the game phase for a given week
 */
function determinePhaseForWeek(
  week: number,
  calendar: TurnProcessingInput['calendar']
): { phase: GamePhase; raceWeek: TurnProcessingResult['raceWeek'] } {
  if (week <= PRESEASON_END_WEEK) {
    return { phase: GamePhase.PreSeason, raceWeek: null };
  }

  if (week >= POSTSEASON_START_WEEK) {
    return { phase: GamePhase.PostSeason, raceWeek: null };
  }

  // Check if this week has a race
  // Note: We return BetweenRaces even for race weeks - the player must explicitly
  // "go to circuit" to enter RaceWeekend phase. This gives them a chance to see
  // the race week before committing to it.
  const raceEntry = calendar.find(
    (entry) => entry.weekNumber === week && !entry.completed && !entry.cancelled
  );

  if (raceEntry) {
    return { phase: GamePhase.BetweenRaces, raceWeek: { circuitId: raceEntry.circuitId } };
  }

  return { phase: GamePhase.BetweenRaces, raceWeek: null };
}

/**
 * Generate driver state changes for a weekly turn
 */
function generateDriverStateChanges(
  drivers: TurnProcessingInput['drivers'],
  driverStates: TurnProcessingInput['driverStates'],
  currentPhase: GamePhase
): DriverStateChange[] {
  const changes: DriverStateChange[] = [];

  for (const driver of drivers) {
    if (!driver.teamId) continue; // Skip free agents

    const state = driverStates[driver.id];
    if (!state) continue;

    const change: DriverStateChange = {
      driverId: driver.id,
      fatigueChange: randomInt(WEEKLY_FATIGUE_MIN, WEEKLY_FATIGUE_MAX),
      moraleChange: randomInt(WEEKLY_MORALE_MIN, WEEKLY_MORALE_MAX),
    };

    // Fitness drops if fatigued
    if (state.fatigue > FATIGUE_THRESHOLD) {
      change.fitnessChange = -FITNESS_DROP_PER_WEEK;
    }

    // Injury recovery
    if (state.injuryWeeksRemaining > 0) {
      change.setInjuryWeeks = Math.max(0, state.injuryWeeksRemaining - 1);
    }

    // Ban countdown (only if this was a race week that we're leaving)
    if (currentPhase === GamePhase.RaceWeekend && state.banRacesRemaining > 0) {
      change.setBanRaces = Math.max(0, state.banRacesRemaining - 1);
    }

    changes.push(change);
  }

  return changes;
}

/**
 * Generate team state changes for a weekly turn
 */
function generateTeamStateChanges(
  teams: TurnProcessingInput['teams'],
  teamStates: TurnProcessingInput['teamStates']
): TeamStateChange[] {
  const changes: TeamStateChange[] = [];

  for (const team of teams) {
    const state = teamStates[team.id];
    if (!state) continue;

    // Weekly salary costs
    const budgetChange = -Math.round(team.budget * WEEKLY_SALARY_RATE);

    changes.push({
      teamId: team.id,
      budgetChange,
      moraleChanges: generateFluctuations(Object.values(Department)),
      sponsorSatisfactionChanges: generateFluctuations(Object.keys(state.sponsorSatisfaction)),
    });
  }

  return changes;
}

// =============================================================================
// RACE PROCESSING HELPERS
// =============================================================================

const PODIUM_THRESHOLD = 3; // Positions 1-3 count as podium

/**
 * Season end constants
 */
const DRIVER_PEAK_AGE = 28; // Age at which drivers are at their peak
const DRIVER_DECLINE_START_AGE = 32; // Age at which decline begins
const DRIVER_RETIREMENT_MIN_AGE = 35; // Minimum age for retirement consideration
const DRIVER_RETIREMENT_MAX_AGE = 42; // Very likely to retire at this age
const CHIEF_RETIREMENT_MIN_AGE = 55; // Minimum age for chief retirement
const CHIEF_RETIREMENT_MAX_AGE = 70; // Very likely to retire at this age
const ATTRIBUTE_IMPROVEMENT_AMOUNT = 2; // Max improvement value per attribute for young drivers
const ATTRIBUTE_DECLINE_AMOUNT = 3; // Max decline value per attribute for aging drivers
const CHIEF_ABILITY_CHANGE_RANGE = 2; // +/- ability change per season
const ATTRIBUTE_IMPROVEMENT_CHANCE = 0.3; // 30% chance per attribute to improve
const DECLINE_BASE_CHANCE = 0.2; // Base chance for attribute decline
const DECLINE_CHANCE_PER_YEAR = 0.1; // Additional decline chance per year over decline age
const DECLINE_MAX_CHANCE = 0.6; // Maximum decline chance cap
const CHIEF_ABILITY_CHANGE_CHANCE = 0.5; // 50% chance of ability change per season
const CHIEF_BASE_AGE = 40; // Base age for chief age estimation
const CHIEF_AGE_ABILITY_DIVISOR = 4; // Divisor for ability-to-age conversion
const SEASON_START_MORALE = 70; // Neutral-positive morale at season start
const SEASON_START_FITNESS = 100; // Full fitness at season start

/**
 * Initial driver runtime state for start of new season
 */
const INITIAL_DRIVER_RUNTIME_STATE: Partial<DriverRuntimeState> = {
  fatigue: 0,
  fitness: SEASON_START_FITNESS,
  morale: SEASON_START_MORALE,
  engineUnitsUsed: 0,
  gearboxRaceCount: 0,
  injuryWeeksRemaining: 0,
  banRacesRemaining: 0,
  isAngry: false,
};

/**
 * Check if a race result counts as a DNF (did not finish normally)
 */
function isDNF(status: RaceFinishStatus): boolean {
  return status !== RaceFinishStatus.Finished && status !== RaceFinishStatus.Lapped;
}

/**
 * Check if a finish position counts as a podium
 */
function isPodium(finishPosition: number | null | undefined): boolean {
  return finishPosition != null && finishPosition <= PODIUM_THRESHOLD;
}

/**
 * Calculate morale change based on finish position and points earned
 * Used by both driver and team morale calculations
 */
function calculateFinishMorale(
  finishPosition: number | null | undefined,
  scoredPoints: boolean
): number {
  if (finishPosition === 1) {
    return WIN_MORALE_BONUS;
  }
  if (isPodium(finishPosition)) {
    return PODIUM_MORALE_BONUS;
  }
  if (scoredPoints) {
    return POINTS_MORALE_BONUS;
  }
  return 0;
}

/**
 * Shared stats present in both driver and constructor standings
 */
interface CommonStandingStats {
  wins: number;
  podiums: number;
  polePositions: number;
}

/**
 * Update common standing stats (wins, podiums, pole positions) based on race result
 * Used by both driver and constructor standings updates
 */
function updateCommonStats(standing: CommonStandingStats, result: DriverRaceResult): void {
  if (result.finishPosition === 1) {
    standing.wins += 1;
  }
  if (isPodium(result.finishPosition)) {
    standing.podiums += 1;
  }
  if (result.gridPosition === 1) {
    standing.polePositions += 1;
  }
}

/**
 * Sort standings by points (descending), then wins as tiebreaker
 * Also assigns position numbers based on sorted order
 * Returns a new array with new objects (pure function, no mutation)
 */
function sortAndAssignPositions<T extends { points: number; wins: number; position: number }>(
  standings: T[]
): T[] {
  return [...standings]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins;
    })
    .map((standing, index) => ({
      ...standing,
      position: index + 1,
    }));
}

/**
 * Update driver standings with race results
 * Returns new sorted standings array (does not mutate input)
 */
function updateDriverStandings(
  currentStandings: DriverStanding[],
  raceResults: DriverRaceResult[]
): DriverStanding[] {
  // Create a map of current standings by driverId
  const standingsMap = new Map<string, DriverStanding>();
  for (const standing of currentStandings) {
    standingsMap.set(standing.driverId, { ...standing });
  }

  // Update standings with race results
  for (const result of raceResults) {
    let standing = standingsMap.get(result.driverId);

    // If driver not in standings yet, create entry
    if (!standing) {
      standing = {
        driverId: result.driverId,
        teamId: result.teamId,
        points: 0,
        position: 0, // Will be set after sorting
        wins: 0,
        podiums: 0,
        polePositions: 0,
        fastestLaps: 0,
        dnfs: 0,
      };
      standingsMap.set(result.driverId, standing);
    }

    // Add points
    standing.points += result.points;

    // Update common stats (wins, podiums, poles)
    updateCommonStats(standing, result);

    // Update driver-specific stats
    if (result.fastestLap) {
      standing.fastestLaps += 1;
    }
    if (isDNF(result.status)) {
      standing.dnfs += 1;
    }
  }

  return sortAndAssignPositions(Array.from(standingsMap.values()));
}

/**
 * Update constructor standings with race results
 * Returns new sorted standings array (does not mutate input)
 */
function updateConstructorStandings(
  currentStandings: ConstructorStanding[],
  raceResults: DriverRaceResult[]
): ConstructorStanding[] {
  // Create a map of current standings by teamId
  const standingsMap = new Map<string, ConstructorStanding>();
  for (const standing of currentStandings) {
    standingsMap.set(standing.teamId, { ...standing });
  }

  // Aggregate race results by team
  for (const result of raceResults) {
    let standing = standingsMap.get(result.teamId);

    // If team not in standings yet, create entry
    if (!standing) {
      standing = {
        teamId: result.teamId,
        points: 0,
        position: 0, // Will be set after sorting
        wins: 0,
        podiums: 0,
        polePositions: 0,
      };
      standingsMap.set(result.teamId, standing);
    }

    // Add points
    standing.points += result.points;

    // Update stats (any driver achieving these counts for team)
    updateCommonStats(standing, result);
  }

  return sortAndAssignPositions(Array.from(standingsMap.values()));
}

/**
 * Calculate morale change for a driver based on race result
 */
function calculateDriverMoraleChange(result: DriverRaceResult): number {
  if (isDNF(result.status)) {
    return DNF_MORALE_PENALTY;
  }
  return calculateFinishMorale(result.finishPosition, result.points > 0);
}

/**
 * Calculate reputation change for a driver based on race result
 */
function calculateDriverReputationChange(result: DriverRaceResult): number {
  if (isDNF(result.status)) {
    return DNF_REPUTATION_PENALTY;
  }
  if (result.finishPosition === 1) {
    return WIN_REPUTATION_BONUS;
  }
  if (isPodium(result.finishPosition)) {
    return PODIUM_REPUTATION_BONUS;
  }
  return 0;
}

/**
 * Generate driver state changes from race results
 */
function generateRaceDriverStateChanges(
  raceResults: DriverRaceResult[]
): DriverStateChange[] {
  return raceResults.map((result) => ({
    driverId: result.driverId,
    moraleChange: calculateDriverMoraleChange(result),
    reputationChange: calculateDriverReputationChange(result),
  }));
}

/**
 * Generate team state changes from race results
 * Budget bonus based on points scored, morale boost from good results
 */
function generateRaceTeamStateChanges(
  raceResults: DriverRaceResult[],
  teamStates: RaceProcessingInput['teamStates']
): TeamStateChange[] {
  // Aggregate points by team
  const teamPoints = new Map<string, number>();
  const teamBestFinish = new Map<string, number>();

  for (const result of raceResults) {
    const currentPoints = teamPoints.get(result.teamId) ?? 0;
    teamPoints.set(result.teamId, currentPoints + result.points);

    // Track best finish for morale calculation
    if (result.finishPosition !== null) {
      const currentBest = teamBestFinish.get(result.teamId) ?? Infinity;
      teamBestFinish.set(result.teamId, Math.min(currentBest, result.finishPosition));
    }
  }

  const changes: TeamStateChange[] = [];

  for (const [teamId, points] of teamPoints) {
    const state = teamStates[teamId];
    if (!state) continue;

    const bestFinish = teamBestFinish.get(teamId);

    // Budget bonus for points
    const budgetChange = points * POINTS_BONUS_PER_POINT;

    // Morale boost for engineering/mechanics based on results
    const moraleBoost = calculateFinishMorale(bestFinish, points > 0);

    changes.push({
      teamId,
      budgetChange,
      moraleChanges: {
        [Department.Engineering]: moraleBoost,
        [Department.Mechanics]: moraleBoost,
      },
      sponsorSatisfactionChanges: generateFluctuations(Object.keys(state.sponsorSatisfaction)),
    });
  }

  return changes;
}

/**
 * Update championship standings with race results
 */
function updateStandings(
  currentStandings: ChampionshipStandings,
  raceResults: DriverRaceResult[]
): ChampionshipStandings {
  return {
    drivers: updateDriverStandings(currentStandings.drivers, raceResults),
    constructors: updateConstructorStandings(currentStandings.constructors, raceResults),
  };
}

// =============================================================================
// SEASON END PROCESSING HELPERS
// =============================================================================

/**
 * Calculate a person's age given their date of birth and current season
 * Assumes season number roughly maps to a year (e.g., season 1 = 2025)
 */
function calculateAge(dateOfBirth: string, currentSeason: number): number {
  const birthYear = new Date(dateOfBirth).getFullYear();
  const currentYear = seasonToYear(currentSeason);
  return currentYear - birthYear;
}

/**
 * Determine if someone should retire based on age and probability
 * Uses linear probability scaling between min and max retirement ages
 */
function shouldRetire(age: number, minAge: number, maxAge: number): boolean {
  if (age < minAge) return false;
  if (age >= maxAge) return true;

  // Linear probability: 0% at minAge, 100% at maxAge
  const probability = (age - minAge) / (maxAge - minAge);
  return Math.random() < probability;
}

/**
 * All driver attributes that can change over time
 */
const DRIVER_ATTRIBUTES: (keyof DriverAttributes)[] = [
  'pace',
  'consistency',
  'focus',
  'overtaking',
  'wetWeather',
  'smoothness',
  'defending',
];

/**
 * Maximum number of attributes a young driver can improve per season
 */
const MAX_IMPROVING_ATTRIBUTES = 2;

/**
 * Select random attributes for improvement (young drivers)
 * Shuffles to avoid bias toward attributes earlier in the list
 */
function selectAttributesForImprovement(): (keyof DriverAttributes)[] {
  const candidates = DRIVER_ATTRIBUTES.filter(
    () => Math.random() < ATTRIBUTE_IMPROVEMENT_CHANCE
  );
  shuffleInPlace(candidates); // filter() already returns new array, no copy needed
  return candidates.slice(0, MAX_IMPROVING_ATTRIBUTES);
}

/**
 * Calculate decline chance based on years over decline age
 */
function calculateDeclineChance(yearsOverDeclineAge: number): number {
  return Math.min(
    DECLINE_MAX_CHANCE,
    DECLINE_BASE_CHANCE + yearsOverDeclineAge * DECLINE_CHANCE_PER_YEAR
  );
}

/**
 * Select random attributes for decline (aging drivers)
 */
function selectAttributesForDecline(
  yearsOverDeclineAge: number
): (keyof DriverAttributes)[] {
  const declineChance = calculateDeclineChance(yearsOverDeclineAge);
  return DRIVER_ATTRIBUTES.filter(() => Math.random() < declineChance);
}

/**
 * Generate improvement changes for a young driver
 */
function generateYoungDriverChanges(driverId: string): DriverAttributeChange[] {
  return selectAttributesForImprovement().map((attribute) => ({
    driverId,
    attribute,
    change: randomInt(1, ATTRIBUTE_IMPROVEMENT_AMOUNT),
  }));
}

/**
 * Generate decline changes for an aging driver
 */
function generateAgingDriverChanges(
  driverId: string,
  yearsOverDeclineAge: number
): DriverAttributeChange[] {
  return selectAttributesForDecline(yearsOverDeclineAge).map((attribute) => ({
    driverId,
    attribute,
    change: -randomInt(1, ATTRIBUTE_DECLINE_AMOUNT),
  }));
}

/**
 * Generate attribute changes for a single driver based on age
 * Young drivers improve, older drivers decline, peak age drivers unchanged
 */
function generateSingleDriverAttributeChanges(
  driver: Driver,
  currentSeason: number
): DriverAttributeChange[] {
  const age = calculateAge(driver.dateOfBirth, currentSeason);

  if (age < DRIVER_PEAK_AGE) {
    return generateYoungDriverChanges(driver.id);
  }
  if (age >= DRIVER_DECLINE_START_AGE) {
    const yearsOverDeclineAge = age - DRIVER_DECLINE_START_AGE;
    return generateAgingDriverChanges(driver.id, yearsOverDeclineAge);
  }
  // Peak age drivers (28-31): no changes
  return [];
}

/**
 * Generate attribute changes for all drivers based on age
 * Young drivers improve, older drivers decline
 */
function generateDriverAttributeChanges(
  drivers: Driver[],
  currentSeason: number
): DriverAttributeChange[] {
  return drivers.flatMap((driver) =>
    generateSingleDriverAttributeChanges(driver, currentSeason)
  );
}

/**
 * Generate chief ability changes for end of season
 * Small random fluctuations in ability (excludes zero changes)
 */
function generateChiefChanges(chiefs: Chief[]): ChiefChange[] {
  return chiefs
    .filter(() => Math.random() < CHIEF_ABILITY_CHANGE_CHANCE)
    .map((chief) => ({
      chiefId: chief.id,
      abilityChange: randomInt(-CHIEF_ABILITY_CHANGE_RANGE, CHIEF_ABILITY_CHANGE_RANGE),
    }))
    .filter((change) => change.abilityChange !== 0);
}

/**
 * Determine which drivers should retire at end of season
 */
function determineDriverRetirements(drivers: Driver[], currentSeason: number): string[] {
  return drivers
    .filter((driver) => {
      const age = calculateAge(driver.dateOfBirth, currentSeason);
      return shouldRetire(age, DRIVER_RETIREMENT_MIN_AGE, DRIVER_RETIREMENT_MAX_AGE);
    })
    .map((driver) => driver.id);
}

/**
 * Estimate a chief's age based on ability
 * Higher ability suggests more experience/age
 * Ability 50 -> ~52 years old, Ability 90 -> ~62 years old
 */
function estimateChiefAge(ability: number): number {
  return CHIEF_BASE_AGE + Math.floor(ability / CHIEF_AGE_ABILITY_DIVISOR);
}

/**
 * Determine which chiefs should retire at end of season
 * Note: Chiefs don't have dateOfBirth, so we estimate age from ability
 */
function determineChiefRetirements(chiefs: Chief[]): string[] {
  return chiefs
    .filter((chief) => {
      const estimatedAge = estimateChiefAge(chief.ability);
      return shouldRetire(estimatedAge, CHIEF_RETIREMENT_MIN_AGE, CHIEF_RETIREMENT_MAX_AGE);
    })
    .map((chief) => chief.id);
}

/**
 * Distribute gap weeks with variation.
 * Creates some 0-gaps (headers) and some larger gaps for breaks.
 */
function generateGapsWithVariation(totalGapWeeks: number, numGaps: number): number[] {
  if (numGaps === 0) return [];

  const gaps: number[] = Array(numGaps).fill(0);
  let remaining = totalGapWeeks;

  // First pass: assign gaps with weighted randomness
  for (let i = 0; i < numGaps && remaining > 0; i++) {
    const roll = Math.random();
    let gap: number;

    if (roll < 0.30) {
      gap = 0; // ~30% headers (consecutive races)
    } else if (roll < 0.65) {
      gap = 1; // ~35% normal 1-week gap
    } else if (roll < 0.85) {
      gap = 2; // ~20% 2-week gap
    } else {
      gap = Math.min(3, remaining); // ~15% occasional 3-week gap
    }

    gap = Math.min(gap, remaining);
    gaps[i] = gap;
    remaining -= gap;
  }

  // Second pass: distribute any remaining weeks randomly
  while (remaining > 0) {
    const index = Math.floor(Math.random() * numGaps);
    gaps[index]++;
    remaining--;
  }

  // Shuffle gaps to randomize header positions throughout season
  shuffleInPlace(gaps);

  return gaps;
}

/**
 * Generate race week numbers with semi-random distribution.
 * Creates double/triple headers (consecutive race weeks) with varied gaps between.
 */
function generateRaceWeeks(raceCount: number, firstWeek: number, lastWeek: number): number[] {
  if (raceCount === 0) return [];
  if (raceCount === 1) return [firstWeek];

  const totalWeeks = lastWeek - firstWeek + 1;
  const actualRaceCount = Math.min(raceCount, totalWeeks);

  // Total gap weeks to distribute between races
  const totalGapWeeks = totalWeeks - actualRaceCount;
  const numGaps = actualRaceCount - 1;

  if (numGaps === 0) return [firstWeek];

  // Generate varied gaps
  const gaps = generateGapsWithVariation(totalGapWeeks, numGaps);

  // Build week numbers starting from firstWeek
  const weeks: number[] = [firstWeek];
  let currentWeek = firstWeek;

  for (const gap of gaps) {
    currentWeek += 1 + gap; // Move to next race week
    weeks.push(currentWeek);
  }

  return weeks;
}

/**
 * Generate a new season calendar from circuits.
 * Creates a semi-random distribution with some double/triple headers
 * and varied gaps between race blocks.
 */
function generateNewCalendar(circuits: Circuit[]): CalendarEntry[] {
  if (circuits.length === 0) return [];

  // Available weeks for races (weeks 11-49 inclusive)
  const availableWeeks = LAST_RACE_WEEK - FIRST_RACE_WEEK + 1;

  // Shuffle circuits first, then take only as many as fit in available weeks
  const shuffledCircuits = shuffleArray(circuits).slice(0, availableWeeks);
  const raceCount = shuffledCircuits.length;

  // Generate week numbers with variation
  const weekNumbers = generateRaceWeeks(raceCount, FIRST_RACE_WEEK, LAST_RACE_WEEK);

  return shuffledCircuits.map((circuit, index) => ({
    raceNumber: index + 1,
    circuitId: circuit.id,
    weekNumber: weekNumbers[index],
    completed: false,
    cancelled: false,
  }));
}

/**
 * Generate reset state for all drivers at season start
 * Resets fatigue, restores fitness, resets component usage
 */
function generateResetDriverStates(
  drivers: Driver[]
): Record<string, Partial<DriverRuntimeState>> {
  return Object.fromEntries(
    drivers.map((driver) => [driver.id, { ...INITIAL_DRIVER_RUNTIME_STATE }])
  );
}

// =============================================================================
// STUB RACE RESULT GENERATOR
// =============================================================================

/** Points awarded per finishing position (1st through 10th) */
const POINTS_BY_POSITION = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/** DNF probability per driver */
const DNF_PROBABILITY = 0.1;

/** Base lap time for stub results (in ms) */
const BASE_LAP_TIME_MS = 90000;

/** Lap time variation range (in ms) */
const LAP_TIME_VARIATION_MS = 5000;

/** Number of laps for stub race */
const STUB_RACE_LAPS = 50;

/** Maximum gap to pole position in qualifying (in ms) */
const MAX_GAP_TO_POLE_MS = 2000;

/** Maximum gap to winner / total time variation in race (in ms) */
const MAX_GAP_TO_WINNER_MS = 60000;

/** Minimum and maximum pit stops for stub race */
const STUB_PIT_STOPS_MIN = 1;
const STUB_PIT_STOPS_MAX = 3;

/**
 * Generate a random lap time around the base time
 */
function generateRandomLapTime(): number {
  return BASE_LAP_TIME_MS + Math.random() * LAP_TIME_VARIATION_MS;
}

/**
 * Generate qualifying results for all drivers in grid order
 */
function generateQualifyingResults(
  gridOrder: Array<Driver & { teamId: string }>
): DriverQualifyingResult[] {
  return gridOrder.map((driver, index) => ({
    driverId: driver.id,
    teamId: driver.teamId,
    gridPosition: index + 1,
    bestLapTime: generateRandomLapTime(),
    gapToPole: index === 0 ? 0 : Math.random() * MAX_GAP_TO_POLE_MS,
  }));
}

/** Mutable context for tracking fastest lap during race result generation */
interface FastestLapTracker {
  time: number;
  driverId: string;
}

/**
 * Generate a single driver's race result
 */
function generateSingleRaceResult(
  driver: Driver & { teamId: string },
  finishIndex: number,
  gridPositionMap: Map<string, number>,
  fastestLap: FastestLapTracker
): DriverRaceResult {
  const gridPosition = gridPositionMap.get(driver.id) ?? 0;
  const didNotFinish = Math.random() < DNF_PROBABILITY;
  const finishPosition = didNotFinish ? null : finishIndex + 1;
  const points =
    finishPosition !== null && finishPosition <= POINTS_BY_POSITION.length
      ? POINTS_BY_POSITION[finishPosition - 1]
      : 0;

  const lapTime = generateRandomLapTime();
  const isFastestLap = lapTime < fastestLap.time && !didNotFinish;
  if (isFastestLap) {
    fastestLap.time = lapTime;
    fastestLap.driverId = driver.id;
  }

  return {
    driverId: driver.id,
    teamId: driver.teamId,
    finishPosition,
    gridPosition,
    lapsCompleted: didNotFinish ? Math.floor(Math.random() * STUB_RACE_LAPS) : STUB_RACE_LAPS,
    totalTime: didNotFinish ? undefined : BASE_LAP_TIME_MS * STUB_RACE_LAPS + Math.random() * MAX_GAP_TO_WINNER_MS,
    gapToWinner: finishPosition === 1 ? 0 : Math.random() * MAX_GAP_TO_WINNER_MS,
    points,
    fastestLap: isFastestLap,
    fastestLapTime: lapTime,
    status: didNotFinish ? RaceFinishStatus.Retired : RaceFinishStatus.Finished,
    pitStops: Math.floor(Math.random() * STUB_PIT_STOPS_MAX) + STUB_PIT_STOPS_MIN,
  };
}

/**
 * Build a map from driver ID to grid position for O(1) lookups
 */
function buildGridPositionMap(
  gridOrder: Array<Driver & { teamId: string }>
): Map<string, number> {
  return new Map(gridOrder.map((driver, index) => [driver.id, index + 1]));
}

/**
 * Generate race results for all drivers
 * Returns both the results array and fastest lap info
 */
function generateRaceResults(
  finishOrder: Array<Driver & { teamId: string }>,
  gridOrder: Array<Driver & { teamId: string }>
): { race: DriverRaceResult[]; fastestLapDriverId: string; fastestLapTime: number } {
  const fastestLap: FastestLapTracker = {
    time: Infinity,
    driverId: finishOrder[0]?.id ?? '',
  };

  // Precompute grid positions for O(1) lookups instead of O(n) per driver
  const gridPositionMap = buildGridPositionMap(gridOrder);

  const race = finishOrder.map((driver, index) =>
    generateSingleRaceResult(driver, index, gridPositionMap, fastestLap)
  );

  return {
    race,
    fastestLapDriverId: fastestLap.driverId,
    fastestLapTime: fastestLap.time,
  };
}

/**
 * Generate a stub race weekend result
 * Uses simple random logic - will be replaced with full simulation later
 */
export function generateStubRaceResult(
  state: GameState,
  circuitId: string,
  raceNumber: number
): RaceWeekendResult {
  // Get all drivers with race seats
  const raceDrivers = state.drivers.filter(hasRaceSeat);

  // Generate grid order and qualifying
  const gridOrder = shuffleArray(raceDrivers);
  const qualifying = generateQualifyingResults(gridOrder);

  // Generate race finish order and results
  const finishOrder = shuffleArray(raceDrivers);
  const { race, fastestLapDriverId, fastestLapTime } = generateRaceResults(finishOrder, gridOrder);

  return {
    raceNumber,
    circuitId,
    seasonNumber: yearToSeason(state.currentDate.year),
    qualifying,
    race,
    weather: WeatherCondition.Dry,
    fastestLapDriverId,
    fastestLapTime,
  };
}

/**
 * StubTurnEngine - Stub implementation of time progression
 *
 * Uses simple random values for all changes. Will be replaced with
 * more sophisticated simulation logic in later phases.
 */
export class StubTurnEngine implements ITurnEngine {
  private designEngine = new StubDesignEngine();

  /**
   * Process a daily turn - advance time by one day and apply state changes
   */
  processDay(input: TurnProcessingInput): TurnProcessingResult {
    const { currentDate, phase, calendar, drivers, teams, chiefs, driverStates, teamStates } =
      input;

    // Get current week number for phase/race determination
    const currentWeek = getWeekNumber(currentDate);

    // Check for post-season block (week 50+)
    if (currentWeek >= POSTSEASON_START_WEEK) {
      return {
        newDate: currentDate,
        newPhase: GamePhase.PostSeason,
        driverStateChanges: [],
        driverAttributeChanges: [],
        chiefChanges: [],
        teamStateChanges: [],
        designUpdates: [],
        raceWeek: null,
        blocked: {
          reason: 'post-season',
          message: 'End of season reached. Complete post-season activities to start the new season.',
        },
      };
    }

    // Advance to next day
    const newDate = advanceDay(currentDate);
    const newWeek = getWeekNumber(newDate);

    // Determine new phase based on week
    const { phase: newPhase, raceWeek } = determinePhaseForWeek(newWeek, calendar);

    // Process design for all teams
    const designUpdates: DesignUpdate[] = teams.map((team) => {
      const teamState = teamStates[team.id];
      const chiefDesigner =
        chiefs.find((c) => c.teamId === team.id && c.role === ChiefRole.Designer) ?? null;

      const designInput: DesignProcessingInput = {
        teamId: team.id,
        designState: teamState.designState,
        staffCounts: teamState.staffCounts,
        chiefDesigner,
        facilities: team.factory.facilities,
        currentDate: newDate,
      };

      const designResult = this.designEngine.processDay(designInput);

      return {
        teamId: team.id,
        ...designResult,
      };
    });

    // Check if we should stop simulation (Friday of race weekend)
    const shouldStop = raceWeek !== null && isFriday(newDate);

    return {
      newDate,
      newPhase,
      driverStateChanges: generateDriverStateChanges(drivers, driverStates, phase),
      driverAttributeChanges: [], // No attribute changes during daily processing
      chiefChanges: [], // No chief changes during daily processing
      teamStateChanges: generateTeamStateChanges(teams, teamStates),
      designUpdates,
      raceWeek,
      shouldStopSimulation: shouldStop,
      stopReason: shouldStop ? 'race-weekend-friday' : undefined,
    };
  }

  /**
   * Process race results - update standings and apply state changes
   * Called after a race weekend completes
   */
  processRace(input: RaceProcessingInput): RaceProcessingResult {
    const { raceResult, currentStandings, teamStates } = input;

    return {
      driverStateChanges: generateRaceDriverStateChanges(raceResult.race),
      teamStateChanges: generateRaceTeamStateChanges(raceResult.race, teamStates),
      updatedStandings: updateStandings(currentStandings, raceResult.race),
    };
  }

  /**
   * Process end of season - apply aging, retirements, and reset for new season
   */
  processSeasonEnd(input: SeasonEndInput): SeasonEndResult {
    const { drivers, chiefs, currentSeason, circuits } = input;

    return {
      driverAttributeChanges: generateDriverAttributeChanges(drivers, currentSeason),
      chiefChanges: generateChiefChanges(chiefs),
      retiredDriverIds: determineDriverRetirements(drivers, currentSeason),
      retiredChiefIds: determineChiefRetirements(chiefs),
      newCalendar: generateNewCalendar(circuits),
      resetDriverStates: generateResetDriverStates(drivers),
    };
  }
}
