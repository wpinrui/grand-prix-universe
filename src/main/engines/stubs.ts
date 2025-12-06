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
} from '../../shared/domain/engines';

import { Department, GamePhase } from '../../shared/domain/types';

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
const WEEKLY_SALARY_RATE = 0.001; // Weekly salary as percentage of budget (0.1%)

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
      change.fitnessChange = -1;
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

    // Department morale fluctuations
    const moraleChanges: Partial<Record<Department, number>> = {};
    for (const dept of Object.values(Department)) {
      moraleChanges[dept] = randomInt(WEEKLY_FLUCTUATION_MIN, WEEKLY_FLUCTUATION_MAX);
    }

    // Sponsor satisfaction fluctuations
    const sponsorSatisfactionChanges: Record<string, number> = {};
    for (const sponsorId of Object.keys(state.sponsorSatisfaction)) {
      sponsorSatisfactionChanges[sponsorId] = randomInt(WEEKLY_FLUCTUATION_MIN, WEEKLY_FLUCTUATION_MAX);
    }

    changes.push({
      teamId: team.id,
      budgetChange,
      moraleChanges,
      sponsorSatisfactionChanges,
    });
  }

  return changes;
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
   * Process race results - stub for PR 3
   */
  processRace(_input: RaceProcessingInput): RaceProcessingResult {
    // Stub: Returns empty changes, will be implemented in PR 3
    return {
      driverStateChanges: [],
      teamStateChanges: [],
      updatedStandings: _input.currentStandings,
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
