/**
 * GameStateManager Service
 *
 * Manages the game state lifecycle:
 * - Creating new games
 * - Holding current state in memory
 * - (Future) Save/load functionality
 */

import { ConfigLoader } from './config-loader';
import type {
  GameState,
  GameDate,
  PlayerInfo,
  SeasonData,
  CalendarEntry,
  DriverStanding,
  ConstructorStanding,
  DriverRuntimeState,
  TeamRuntimeState,
  DepartmentMorale,
  DepartmentStaffCounts,
  ActiveSponsorDeal,
  ActiveManufacturerContract,
  Driver,
  Team,
  SeasonRegulations,
} from '../../shared/domain';
import {
  GamePhase,
  Department,
  ManufacturerType,
  ManufacturerDealType,
} from '../../shared/domain';

/** Current save format version */
const SAVE_VERSION = '1.0.0';

/** Default starting week for pre-season */
const PRE_SEASON_START_WEEK = 1;

/** Default contract duration in seasons */
const DEFAULT_CONTRACT_DURATION = 3;

/** Parameters for creating a new game */
export interface NewGameParams {
  playerName: string;
  teamId: string;
  seasonNumber?: number; // Defaults to 1
}

/**
 * Creates initial runtime state for a driver
 */
function createInitialDriverState(): DriverRuntimeState {
  return {
    morale: 70, // Start at good baseline
    fitness: 100, // Fully fit
    fatigue: 0, // Fresh at season start
    injuryWeeksRemaining: 0,
    banRacesRemaining: 0,
    isAngry: false,
    engineUnitsUsed: 0,
    gearboxRaceCount: 0,
  };
}

/**
 * Creates initial morale for all departments
 */
function createInitialDepartmentMorale(): DepartmentMorale {
  return {
    [Department.Commercial]: 70,
    [Department.Design]: 70,
    [Department.Engineering]: 70,
    [Department.Mechanics]: 70,
  };
}

/**
 * Creates initial runtime state for a team
 */
function createInitialTeamState(
  sponsorIds: string[],
  initialStaffCounts: DepartmentStaffCounts
): TeamRuntimeState {
  // Initialize sponsor satisfaction at 60 (neutral-good)
  const sponsorSatisfaction: Record<string, number> = {};
  for (const sponsorId of sponsorIds) {
    sponsorSatisfaction[sponsorId] = 60;
  }

  return {
    morale: createInitialDepartmentMorale(),
    sponsorSatisfaction,
    staffCounts: initialStaffCounts,
    setupPoints: 0,
    developmentTesting: {
      handlingPercentage: 0,
      handlingProblemsFound: [],
    },
  };
}

/**
 * Type guard to check if driver has a team
 */
function hasTeam(driver: Driver): driver is Driver & { teamId: string } {
  return driver.teamId !== null;
}

/**
 * Creates initial driver standings (all zeros, positions assigned by team order)
 */
function createInitialDriverStandings(drivers: Driver[]): DriverStanding[] {
  return drivers.filter(hasTeam).map((driver, index) => ({
    driverId: driver.id,
    teamId: driver.teamId,
    points: 0,
    position: index + 1,
    wins: 0,
    podiums: 0,
    polePositions: 0,
    fastestLaps: 0,
    dnfs: 0,
  }));
}

/**
 * Creates initial constructor standings (all zeros, positions assigned by team order)
 */
function createInitialConstructorStandings(teams: Team[]): ConstructorStanding[] {
  return teams.map((team, index) => ({
    teamId: team.id,
    points: 0,
    position: index + 1,
    wins: 0,
    podiums: 0,
    polePositions: 0,
  }));
}

/**
 * Creates the season calendar from circuits
 * Circuits are used in JSON array order, spread across the season
 */
function createCalendar(circuitIds: string[]): CalendarEntry[] {
  const raceCount = circuitIds.length;
  // Spread races from week 10 to week 48 (typical F1 season span)
  const firstRaceWeek = 10;
  const lastRaceWeek = 48;
  const weekSpan = lastRaceWeek - firstRaceWeek;
  const weeksBetweenRaces = Math.floor(weekSpan / Math.max(raceCount - 1, 1));

  return circuitIds.map((circuitId, index) => ({
    raceNumber: index + 1,
    circuitId,
    weekNumber: firstRaceWeek + index * weeksBetweenRaces,
    completed: false,
    cancelled: false,
  }));
}

/**
 * Creates initial sponsor deals from team's initialSponsorIds
 */
function createInitialSponsorDeals(
  teams: Team[],
  seasonNumber: number
): ActiveSponsorDeal[] {
  const deals: ActiveSponsorDeal[] = [];
  const sponsors = ConfigLoader.getSponsors();

  for (const team of teams) {
    for (const sponsorId of team.initialSponsorIds) {
      const sponsor = sponsors.find((s) => s.id === sponsorId);
      if (!sponsor) continue;

      deals.push({
        sponsorId,
        teamId: team.id,
        tier: sponsor.tier,
        annualPayment: sponsor.payment,
        bonusLevel: 0, // No bonus at start
        guaranteed: false,
        startSeason: seasonNumber,
        endSeason: seasonNumber + DEFAULT_CONTRACT_DURATION - 1,
      });
    }
  }

  return deals;
}

/**
 * Creates initial manufacturer contracts from team's initialEngineManufacturerId
 */
function createInitialManufacturerContracts(
  teams: Team[],
  seasonNumber: number
): ActiveManufacturerContract[] {
  const contracts: ActiveManufacturerContract[] = [];
  const manufacturers = ConfigLoader.getManufacturers();

  for (const team of teams) {
    const manufacturer = manufacturers.find(
      (m) => m.id === team.initialEngineManufacturerId
    );
    if (!manufacturer) continue;

    // Determine deal type based on team/manufacturer relationship
    // Works teams: manufacturer name appears in team name or same HQ country
    // For simplicity, all start as customer deals
    const dealType = ManufacturerDealType.Customer;

    contracts.push({
      manufacturerId: manufacturer.id,
      teamId: team.id,
      type: ManufacturerType.Engine,
      dealType,
      annualCost: manufacturer.annualCost,
      bonusLevel: 0,
      startSeason: seasonNumber,
      endSeason: seasonNumber + DEFAULT_CONTRACT_DURATION - 1,
    });
  }

  return contracts;
}

/**
 * GameStateManager - Singleton service for managing game state
 */
export const GameStateManager = {
  /** Current game state (null if no game loaded) */
  currentState: null as GameState | null,

  /**
   * Creates a new game with the given parameters
   */
  createNewGame(params: NewGameParams): GameState {
    const { playerName, teamId, seasonNumber = 1 } = params;

    // Validate team exists
    const team = ConfigLoader.getTeamById(teamId);
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }

    // Load all entities from config
    const teams = ConfigLoader.getTeams();
    const drivers = ConfigLoader.getDrivers();
    const chiefs = ConfigLoader.getChiefs();
    const sponsors = ConfigLoader.getSponsors();
    const manufacturers = ConfigLoader.getManufacturers();
    const circuits = ConfigLoader.getCircuits();
    const rules = ConfigLoader.getRules();
    const regulations = ConfigLoader.getRegulationsBySeason(seasonNumber);

    if (!rules) {
      throw new Error('Game rules not found');
    }
    if (!regulations) {
      throw new Error(`Regulations not found for season ${seasonNumber}`);
    }

    // Create runtime states
    const driverStates: Record<string, DriverRuntimeState> = {};
    for (const driver of drivers) {
      driverStates[driver.id] = createInitialDriverState();
    }

    const teamStates: Record<string, TeamRuntimeState> = {};
    for (const t of teams) {
      teamStates[t.id] = createInitialTeamState(
        t.initialSponsorIds,
        t.initialStaffCounts
      );
    }

    // Create calendar from circuits
    const calendar = createCalendar(circuits.map((c) => c.id));

    // Create initial standings
    const driverStandings = createInitialDriverStandings(drivers);
    const constructorStandings = createInitialConstructorStandings(teams);

    // Create season data
    const currentSeason: SeasonData = {
      seasonNumber,
      calendar,
      driverStandings,
      constructorStandings,
      regulations: regulations as SeasonRegulations,
    };

    // Create initial contracts
    const sponsorDeals = createInitialSponsorDeals(teams, seasonNumber);
    const manufacturerContracts = createInitialManufacturerContracts(
      teams,
      seasonNumber
    );

    // Create player info
    const player: PlayerInfo = {
      name: playerName,
      teamId,
      careerStartSeason: seasonNumber,
    };

    // Create current date
    const currentDate: GameDate = {
      season: seasonNumber,
      week: PRE_SEASON_START_WEEK,
    };

    // Build complete game state
    const now = new Date().toISOString();
    const gameState: GameState = {
      version: SAVE_VERSION,
      createdAt: now,
      lastSavedAt: now,

      player,
      currentDate,
      phase: GamePhase.PreSeason,

      currentSeason,

      teams,
      drivers,
      chiefs,
      sponsors,
      manufacturers,
      circuits,

      driverStates,
      teamStates,

      sponsorDeals,
      manufacturerContracts,

      pastSeasons: [],
      rules,
    };

    // Store as current state
    this.currentState = gameState;

    return gameState;
  },

  /**
   * Returns the current game state, or null if no game is loaded
   */
  getCurrentState(): GameState | null {
    return this.currentState;
  },

  /**
   * Clears the current game state
   */
  clearState(): void {
    this.currentState = null;
  },
};
