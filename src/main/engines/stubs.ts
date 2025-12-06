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
  DesignInput,
  DesignResult,
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
  TeamStateChange,
  ChampionshipStandings,
} from '../../shared/domain/engines';

import {
  Department,
  GamePhase,
  RaceFinishStatus,
  DriverStanding,
  ConstructorStanding,
  DriverRaceResult,
} from '../../shared/domain/types';

export class StubRaceEngine implements IRaceEngine {
  simulateQualifying(_input: QualifyingInput): QualifyingResult {
    return {};
  }

  simulateRace(_input: RaceInput): RaceResult {
    return {};
  }
}

export class StubDesignEngine implements IDesignEngine {
  processDesign(_input: DesignInput): DesignResult {
    return {};
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
 * Phase boundaries for the season
 */
const PRESEASON_END_WEEK = 9;
const POSTSEASON_START_WEEK = 49;

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
  const raceEntry = calendar.find(
    (entry) => entry.weekNumber === week && !entry.completed && !entry.cancelled
  );

  if (raceEntry) {
    return { phase: GamePhase.RaceWeekend, raceWeek: { circuitId: raceEntry.circuitId } };
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
 * Check if a race result counts as a DNF (did not finish normally)
 */
function isDNF(status: RaceFinishStatus): boolean {
  return status !== RaceFinishStatus.Finished && status !== RaceFinishStatus.Lapped;
}

/**
 * Check if a finish position counts as a podium
 */
function isPodium(finishPosition: number | null): boolean {
  return finishPosition !== null && finishPosition <= PODIUM_THRESHOLD;
}

/**
 * Sort standings by points (descending), then wins as tiebreaker
 * Also assigns position numbers based on sorted order
 */
function sortAndAssignPositions<T extends { points: number; wins: number; position: number }>(
  standings: T[]
): T[] {
  const sorted = standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.wins - a.wins;
  });

  sorted.forEach((standing, index) => {
    standing.position = index + 1;
  });

  return sorted;
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

    // Update stats
    if (result.finishPosition === 1) {
      standing.wins += 1;
    }
    if (isPodium(result.finishPosition)) {
      standing.podiums += 1;
    }
    if (result.gridPosition === 1) {
      standing.polePositions += 1;
    }
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

  return sortAndAssignPositions(Array.from(standingsMap.values()));
}

/**
 * Calculate morale change for a driver based on race result
 */
function calculateDriverMoraleChange(result: DriverRaceResult): number {
  if (isDNF(result.status)) {
    return DNF_MORALE_PENALTY;
  }
  if (result.finishPosition === 1) {
    return WIN_MORALE_BONUS;
  }
  if (isPodium(result.finishPosition)) {
    return PODIUM_MORALE_BONUS;
  }
  if (result.points > 0) {
    return POINTS_MORALE_BONUS;
  }
  return 0;
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
    let moraleBoost = 0;
    if (bestFinish === 1) {
      moraleBoost = WIN_MORALE_BONUS;
    } else if (isPodium(bestFinish ?? null)) {
      moraleBoost = PODIUM_MORALE_BONUS;
    } else if (points > 0) {
      moraleBoost = POINTS_MORALE_BONUS;
    }

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

/**
 * StubTurnEngine - Stub implementation of time progression
 *
 * Uses simple random values for all changes. Will be replaced with
 * more sophisticated simulation logic in later phases.
 */
export class StubTurnEngine implements ITurnEngine {
  /**
   * Process a weekly turn - advance time and apply state changes
   */
  processWeek(input: TurnProcessingInput): TurnProcessingResult {
    const { currentDate, phase, calendar, drivers, teams, driverStates, teamStates } = input;

    // Check for post-season block (week 49+)
    if (currentDate.week >= POSTSEASON_START_WEEK) {
      return {
        newDate: currentDate,
        newPhase: GamePhase.PostSeason,
        driverStateChanges: [],
        driverAttributeChanges: [],
        chiefChanges: [],
        teamStateChanges: [],
        raceWeek: null,
        blocked: {
          reason: 'post-season',
          message: 'End of season reached. Complete post-season activities to start the new season.',
        },
      };
    }

    // Calculate next week
    const nextWeek = currentDate.week + 1;
    const newDate = { season: currentDate.season, week: nextWeek };

    // Determine new phase
    const { phase: newPhase, raceWeek } = determinePhaseForWeek(nextWeek, calendar);

    return {
      newDate,
      newPhase,
      driverStateChanges: generateDriverStateChanges(drivers, driverStates, phase),
      driverAttributeChanges: [], // No attribute changes during weekly processing
      chiefChanges: [], // No chief changes during weekly processing
      teamStateChanges: generateTeamStateChanges(teams, teamStates),
      raceWeek,
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
   * Process end of season - stub for PR 4
   */
  processSeasonEnd(_input: SeasonEndInput): SeasonEndResult {
    // Stub: Returns empty changes, will be implemented in PR 4
    return {
      driverAttributeChanges: [],
      chiefChanges: [],
      retiredDriverIds: [],
      retiredChiefIds: [],
      newCalendar: [],
      resetDriverStates: {},
    };
  }
}
