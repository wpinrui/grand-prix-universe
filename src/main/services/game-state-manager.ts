/**
 * GameStateManager Service
 *
 * Manages the game state lifecycle:
 * - Creating new games
 * - Holding current state in memory
 * - Auto-save functionality
 */

import { BrowserWindow } from 'electron';
import { ConfigLoader } from './config-loader';
import { SaveManager } from './save-manager';
import { EngineManager } from '../engines/engine-manager';
import { generateStubRaceResult } from '../engines/stubs';
import {
  IpcEvents,
  type IpcEventPayloads,
  type SaveResult,
  type LoadResult,
  type AdvanceWeekResult,
  type NewSeasonResult,
} from '../../shared/ipc';
import type {
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
} from '../../shared/domain/engines';
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
  Sponsor,
  Manufacturer,
  Circuit,
  Chief,
  GameRules,
  SeasonRegulations,
  NewGameParams,
  RaceWeekendResult,
} from '../../shared/domain';
import {
  GamePhase,
  Department,
  ManufacturerType,
  ManufacturerDealType,
  hasRaceSeat,
} from '../../shared/domain';

/** Current save format version */
const SAVE_VERSION = '1.0.0';

/** Default starting week for pre-season */
const PRE_SEASON_START_WEEK = 1;

/** Default contract duration in seasons */
const DEFAULT_CONTRACT_DURATION = 3;

/** Default starting season for new games */
const DEFAULT_STARTING_SEASON = 1;

/** Initial morale for drivers and departments (0-100 scale) */
const INITIAL_MORALE = 70;

/** Initial fitness for drivers (0-100 scale, 100 = fully fit) */
const INITIAL_FITNESS = 100;

/** Initial fatigue for drivers (0-100 scale, 0 = fresh) */
const INITIAL_FATIGUE = 0;

/** Initial sponsor satisfaction (0-100 scale, 60 = neutral-good) */
const INITIAL_SPONSOR_SATISFACTION = 60;

/** Initial bonus level for new contracts (0 = no bonus) */
const INITIAL_BONUS_LEVEL = 0;

/** First race typically in March (week 11) */
const FIRST_RACE_WEEK = 11;

/** Default gap between races when schedule data unavailable (bi-weekly) */
const DEFAULT_WEEKS_BETWEEN_RACES = 2;

/** Auto-save interval in milliseconds (5 minutes) */
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Asserts that an array is not empty, throwing a descriptive error if it is
 */
function assertNonEmpty<T>(array: T[], entityName: string): void {
  if (array.length === 0) {
    throw new Error(`No ${entityName} found in config data`);
  }
}

/**
 * Deep clones a value to prevent cache corruption.
 * Entities in GameState will evolve during play - we must not mutate ConfigLoader's cache.
 */
function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Maximum value for percentage-based stats (morale, fitness, etc.) */
const MAX_PERCENTAGE = 100;

/**
 * Clamps a value between 0 and MAX_PERCENTAGE (100).
 * Used for all percentage-based stats like morale, fitness, fatigue, etc.
 */
function clampPercentage(value: number): number {
  return Math.max(0, Math.min(MAX_PERCENTAGE, value));
}

/**
 * Creates initial runtime state for a driver
 */
function createInitialDriverState(): DriverRuntimeState {
  return {
    morale: INITIAL_MORALE,
    fitness: INITIAL_FITNESS,
    fatigue: INITIAL_FATIGUE,
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
    [Department.Commercial]: INITIAL_MORALE,
    [Department.Design]: INITIAL_MORALE,
    [Department.Engineering]: INITIAL_MORALE,
    [Department.Mechanics]: INITIAL_MORALE,
  };
}

/**
 * Creates initial runtime state for a team
 */
function createInitialTeamState(
  sponsorIds: string[],
  initialStaffCounts: DepartmentStaffCounts
): TeamRuntimeState {
  const sponsorSatisfaction: Record<string, number> = {};
  for (const sponsorId of sponsorIds) {
    sponsorSatisfaction[sponsorId] = INITIAL_SPONSOR_SATISFACTION;
  }

  return {
    morale: createInitialDepartmentMorale(),
    sponsorSatisfaction,
    staffCounts: cloneDeep(initialStaffCounts),
    setupPoints: 0,
    developmentTesting: {
      handlingPercentage: 0,
      handlingProblemsFound: [],
    },
  };
}

/** All entity arrays loaded from config */
interface LoadedEntities {
  teams: Team[];
  drivers: Driver[];
  chiefs: Chief[];
  sponsors: Sponsor[];
  manufacturers: Manufacturer[];
  circuits: Circuit[];
}

/**
 * Validates input parameters for new game creation.
 * Throws descriptive errors for invalid inputs.
 */
function validateNewGameParams(params: NewGameParams): void {
  const { playerName, teamId, seasonNumber = DEFAULT_STARTING_SEASON } = params;

  if (!playerName.trim()) {
    throw new Error('Player name cannot be empty');
  }
  if (!teamId.trim()) {
    throw new Error('Team ID cannot be empty');
  }
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
    throw new Error('Season number must be a positive integer');
  }

  const team = ConfigLoader.getTeamById(teamId);
  if (!team) {
    throw new Error(`Team not found: ${teamId}`);
  }

  const rules = ConfigLoader.getRules();
  if (!rules) {
    throw new Error('Game rules not found');
  }

  const regulations = ConfigLoader.getRegulationsBySeason(seasonNumber);
  if (!regulations) {
    throw new Error(`Regulations not found for season ${seasonNumber}`);
  }
}

/**
 * Loads all entities from config and clones them for game state.
 * Cloning prevents mutations from corrupting the config cache.
 */
function loadAndCloneEntities(): LoadedEntities {
  const teams = ConfigLoader.getTeams();
  const drivers = ConfigLoader.getDrivers();
  const chiefs = ConfigLoader.getChiefs();
  const sponsors = ConfigLoader.getSponsors();
  const manufacturers = ConfigLoader.getManufacturers();
  const circuits = ConfigLoader.getCircuits();

  assertNonEmpty(teams, 'teams');
  assertNonEmpty(drivers, 'drivers');
  assertNonEmpty(circuits, 'circuits');
  assertNonEmpty(sponsors, 'sponsors');
  assertNonEmpty(manufacturers, 'manufacturers');
  assertNonEmpty(chiefs, 'chiefs');

  return {
    teams: cloneDeep(teams),
    drivers: cloneDeep(drivers),
    chiefs: cloneDeep(chiefs),
    sponsors: cloneDeep(sponsors),
    manufacturers: cloneDeep(manufacturers),
    circuits: cloneDeep(circuits),
  };
}

/**
 * Creates runtime states for all drivers
 */
function createAllDriverStates(drivers: Driver[]): Record<string, DriverRuntimeState> {
  const states: Record<string, DriverRuntimeState> = {};
  for (const driver of drivers) {
    states[driver.id] = createInitialDriverState();
  }
  return states;
}

/**
 * Creates runtime states for all teams
 */
function createAllTeamStates(teams: Team[]): Record<string, TeamRuntimeState> {
  const states: Record<string, TeamRuntimeState> = {};
  for (const team of teams) {
    states[team.id] = createInitialTeamState(
      team.initialSponsorIds,
      team.initialStaffCounts
    );
  }
  return states;
}

/**
 * Creates initial driver standings (all zeros, positions assigned by array order)
 * Only includes drivers with race seats (excludes test drivers and free agents)
 */
function createInitialDriverStandings(drivers: Driver[]): DriverStanding[] {
  return drivers.filter(hasRaceSeat).map((driver, index) => ({
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
 * Creates the season calendar using the race schedule data.
 * Falls back to even spacing if schedule data is unavailable.
 */
function createCalendar(circuitIds: string[]): CalendarEntry[] {
  const schedule = ConfigLoader.getRaceSchedule();
  const scheduleMap = new Map<string, number>(
    schedule.map((entry) => [entry.circuitId, entry.weekNumber])
  );

  return circuitIds.map((circuitId, index) => {
    // Use schedule week if available, otherwise fall back to even spacing
    const weekNumber =
      scheduleMap.get(circuitId) ?? FIRST_RACE_WEEK + index * DEFAULT_WEEKS_BETWEEN_RACES;

    return {
      raceNumber: index + 1,
      circuitId,
      weekNumber,
      completed: false,
      cancelled: false,
    };
  });
}

/**
 * Creates initial sponsor deals from team's initialSponsorIds
 */
function createInitialSponsorDeals(
  teams: Team[],
  sponsors: Sponsor[],
  seasonNumber: number
): ActiveSponsorDeal[] {
  const deals: ActiveSponsorDeal[] = [];

  for (const team of teams) {
    for (const sponsorId of team.initialSponsorIds) {
      const sponsor = sponsors.find((s) => s.id === sponsorId);
      if (!sponsor) {
        throw new Error(
          `Data integrity error: sponsor "${sponsorId}" not found for team "${team.id}"`
        );
      }

      deals.push({
        sponsorId,
        teamId: team.id,
        tier: sponsor.tier,
        annualPayment: sponsor.payment,
        bonusLevel: INITIAL_BONUS_LEVEL,
        guaranteed: false,
        startSeason: seasonNumber,
        endSeason: seasonNumber + DEFAULT_CONTRACT_DURATION - 1,
      });
    }
  }

  return deals;
}

/**
 * Determines the deal type based on manufacturer-team relationship
 */
function getDealType(manufacturer: Manufacturer, teamId: string): ManufacturerDealType {
  if (manufacturer.worksTeamId === teamId) {
    return ManufacturerDealType.Works;
  }
  if (manufacturer.partnerTeamIds.includes(teamId)) {
    return ManufacturerDealType.Partner;
  }
  return ManufacturerDealType.Customer;
}

/**
 * Creates initial manufacturer contracts from team's initialEngineManufacturerId
 */
function createInitialManufacturerContracts(
  teams: Team[],
  manufacturers: Manufacturer[],
  seasonNumber: number
): ActiveManufacturerContract[] {
  const contracts: ActiveManufacturerContract[] = [];

  for (const team of teams) {
    const manufacturer = manufacturers.find(
      (m) => m.id === team.initialEngineManufacturerId
    );
    if (!manufacturer) {
      throw new Error(
        `Data integrity error: manufacturer "${team.initialEngineManufacturerId}" not found for team "${team.id}"`
      );
    }

    const dealType = getDealType(manufacturer, team.id);

    contracts.push({
      manufacturerId: manufacturer.id,
      teamId: team.id,
      type: ManufacturerType.Engine,
      dealType,
      annualCost: manufacturer.annualCost,
      bonusLevel: INITIAL_BONUS_LEVEL,
      startSeason: seasonNumber,
      endSeason: seasonNumber + DEFAULT_CONTRACT_DURATION - 1,
    });
  }

  return contracts;
}

/** Parameters for building the complete game state */
interface BuildGameStateParams {
  playerName: string;
  teamId: string;
  seasonNumber: number;
  entities: LoadedEntities;
  rules: GameRules;
  regulations: SeasonRegulations;
}

/**
 * Assembles all components into a complete GameState object
 */
function buildGameState(params: BuildGameStateParams): GameState {
  const { playerName, teamId, seasonNumber, entities, rules, regulations } = params;
  const { teams, drivers, chiefs, sponsors, manufacturers, circuits } = entities;

  // Create runtime states
  const driverStates = createAllDriverStates(drivers);
  const teamStates = createAllTeamStates(teams);

  // Create season data
  const currentSeason: SeasonData = {
    seasonNumber,
    calendar: createCalendar(circuits.map((c) => c.id)),
    driverStandings: createInitialDriverStandings(drivers),
    constructorStandings: createInitialConstructorStandings(teams),
    regulations,
  };

  // Create initial contracts
  const sponsorDeals = createInitialSponsorDeals(teams, sponsors, seasonNumber);
  const manufacturerContracts = createInitialManufacturerContracts(
    teams,
    manufacturers,
    seasonNumber
  );

  // Create player info and date
  const player: PlayerInfo = {
    name: playerName,
    teamId,
    careerStartSeason: seasonNumber,
  };

  const currentDate: GameDate = {
    season: seasonNumber,
    week: PRE_SEASON_START_WEEK,
  };

  // Assemble complete game state
  const now = new Date().toISOString();
  return {
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
}

/** Auto-save timer handle */
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

/** Shared engine manager instance */
const engineManager = new EngineManager();

/**
 * Sends a typed event to all renderer windows
 */
function sendToRenderer<K extends keyof IpcEventPayloads>(
  channel: K,
  payload: IpcEventPayloads[K]
): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(channel, payload);
  }
}

/**
 * Starts the auto-save timer
 */
function startAutoSave(): void {
  stopAutoSave(); // Clear any existing timer
  autoSaveTimer = setInterval(async () => {
    if (GameStateManager.currentState) {
      const result = await GameStateManager.saveGame();
      if (result.success && result.filename) {
        console.log(`[AutoSave] Saved to ${result.filename}`);
        sendToRenderer(IpcEvents.AUTO_SAVE_COMPLETE, { filename: result.filename });
      } else {
        console.error(`[AutoSave] Failed: ${result.error}`);
      }
    }
  }, AUTO_SAVE_INTERVAL_MS);
}

/**
 * Stops the auto-save timer
 */
function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// =============================================================================
// STATE CHANGE APPLICATION HELPERS
// =============================================================================

/**
 * Apply driver state changes to game state (mutates state)
 */
function applyDriverStateChanges(
  state: GameState,
  changes: DriverStateChange[]
): void {
  for (const change of changes) {
    const driverState = state.driverStates[change.driverId];
    if (!driverState) continue;

    if (change.fatigueChange !== undefined) {
      driverState.fatigue = clampPercentage(driverState.fatigue + change.fatigueChange);
    }
    if (change.fitnessChange !== undefined) {
      driverState.fitness = clampPercentage(driverState.fitness + change.fitnessChange);
    }
    if (change.moraleChange !== undefined) {
      driverState.morale = clampPercentage(driverState.morale + change.moraleChange);
    }
    if (change.setInjuryWeeks !== undefined) {
      driverState.injuryWeeksRemaining = change.setInjuryWeeks;
    }
    if (change.setBanRaces !== undefined) {
      driverState.banRacesRemaining = change.setBanRaces;
    }
    if (change.engineUnitsUsedChange !== undefined) {
      driverState.engineUnitsUsed += change.engineUnitsUsedChange;
    }
    if (change.gearboxRaceCountChange !== undefined) {
      driverState.gearboxRaceCount += change.gearboxRaceCountChange;
    }

    // Reputation changes apply to the driver entity, not runtime state
    if (change.reputationChange !== undefined) {
      const driver = state.drivers.find((d) => d.id === change.driverId);
      if (driver) {
        driver.reputation = clampPercentage(driver.reputation + change.reputationChange);
      }
    }
  }
}

/**
 * Apply team state changes to game state (mutates state)
 */
function applyTeamStateChanges(
  state: GameState,
  changes: TeamStateChange[]
): void {
  for (const change of changes) {
    const teamState = state.teamStates[change.teamId];
    const team = state.teams.find((t) => t.id === change.teamId);
    if (!teamState || !team) continue;

    if (change.budgetChange !== undefined) {
      team.budget += change.budgetChange;
    }

    if (change.moraleChanges) {
      for (const [dept, delta] of Object.entries(change.moraleChanges)) {
        const department = dept as Department;
        if (teamState.morale[department] !== undefined && delta !== undefined) {
          teamState.morale[department] = clampPercentage(teamState.morale[department] + delta);
        }
      }
    }

    if (change.sponsorSatisfactionChanges) {
      for (const [sponsorId, delta] of Object.entries(change.sponsorSatisfactionChanges)) {
        if (teamState.sponsorSatisfaction[sponsorId] !== undefined) {
          teamState.sponsorSatisfaction[sponsorId] = clampPercentage(
            teamState.sponsorSatisfaction[sponsorId] + delta
          );
        }
      }
    }
  }
}

/**
 * Update championship standings in game state (mutates state)
 */
function updateChampionshipStandings(
  state: GameState,
  standings: ChampionshipStandings
): void {
  state.currentSeason.driverStandings = standings.drivers;
  state.currentSeason.constructorStandings = standings.constructors;
}

// =============================================================================
// SEASON END APPLICATION HELPERS
// =============================================================================

/**
 * Apply driver attribute changes to game state (mutates state)
 * Used for aging effects (improvement for young, decline for old)
 */
function applyDriverAttributeChanges(
  state: GameState,
  changes: DriverAttributeChange[]
): void {
  for (const change of changes) {
    const driver = state.drivers.find((d) => d.id === change.driverId);
    if (!driver) continue;

    const currentValue = driver.attributes[change.attribute];
    driver.attributes[change.attribute] = clampPercentage(currentValue + change.change);
  }
}

/**
 * Apply chief changes to game state (mutates state)
 * Handles ability adjustments
 */
function applyChiefChanges(state: GameState, changes: ChiefChange[]): void {
  for (const change of changes) {
    const chief = state.chiefs.find((c) => c.id === change.chiefId);
    if (!chief) continue;

    if (change.abilityChange !== undefined) {
      chief.ability = clampPercentage(chief.ability + change.abilityChange);
    }
  }
}

/**
 * Mark retired entities by clearing their teamId (makes them free agents)
 * Works for any entity with id and teamId properties (Driver, Chief)
 * In future, could remove from roster entirely or add to "retired" list
 */
function applyRetirements<T extends { id: string; teamId: string | null }>(
  entities: T[],
  retiredIds: string[]
): void {
  for (const id of retiredIds) {
    const entity = entities.find((e) => e.id === id);
    if (entity) {
      entity.teamId = null;
    }
  }
}

/**
 * Reset driver runtime states for new season
 * Applies partial state overrides (fatigue, fitness, etc.)
 */
function applyResetDriverStates(
  state: GameState,
  resets: Record<string, Partial<DriverRuntimeState>>
): void {
  for (const [driverId, resetValues] of Object.entries(resets)) {
    const driverState = state.driverStates[driverId];
    if (driverState) {
      Object.assign(driverState, resetValues);
    }
  }
}

/**
 * Build SeasonEndInput from current game state
 */
function buildSeasonEndInput(state: GameState): SeasonEndInput {
  return {
    drivers: state.drivers,
    teams: state.teams,
    chiefs: state.chiefs,
    driverStates: state.driverStates,
    teamStates: state.teamStates,
    currentSeason: state.currentDate.season,
    circuits: state.circuits,
  };
}

/**
 * Apply all season end results to game state (mutates state)
 * Note: Does NOT update calendar - that's handled by transitionToNewSeason
 * to avoid polluting the archive with the new calendar
 */
function applySeasonEndResult(state: GameState, result: SeasonEndResult): void {
  applyDriverAttributeChanges(state, result.driverAttributeChanges);
  applyChiefChanges(state, result.chiefChanges);
  applyRetirements(state.drivers, result.retiredDriverIds);
  applyRetirements(state.chiefs, result.retiredChiefIds);
  applyResetDriverStates(state, result.resetDriverStates);
}

/**
 * Archive current season to pastSeasons and prepare for new season
 */
function transitionToNewSeason(state: GameState, newCalendar: CalendarEntry[]): void {
  // Archive the completed season
  state.pastSeasons.push({
    seasonNumber: state.currentSeason.seasonNumber,
    calendar: state.currentSeason.calendar,
    driverStandings: state.currentSeason.driverStandings,
    constructorStandings: state.currentSeason.constructorStandings,
    regulations: state.currentSeason.regulations,
  });

  // Increment season number
  const newSeasonNumber = state.currentDate.season + 1;

  // Get regulations for new season (fall back to current if not found)
  const newRegulations =
    ConfigLoader.getRegulationsBySeason(newSeasonNumber) ?? state.currentSeason.regulations;

  // Reset current season data
  state.currentSeason = {
    seasonNumber: newSeasonNumber,
    calendar: newCalendar,
    driverStandings: createInitialDriverStandings(state.drivers),
    constructorStandings: createInitialConstructorStandings(state.teams),
    regulations: newRegulations,
  };

  // Update date to week 1 of new season
  state.currentDate = {
    season: newSeasonNumber,
    week: PRE_SEASON_START_WEEK,
  };

  // Set phase to PreSeason
  state.phase = GamePhase.PreSeason;
}

// =============================================================================
// TURN PROCESSING HELPERS
// =============================================================================

/**
 * Build TurnProcessingInput from current game state
 */
function buildTurnInput(state: GameState): TurnProcessingInput {
  return {
    currentDate: state.currentDate,
    phase: state.phase,
    calendar: state.currentSeason.calendar,
    drivers: state.drivers,
    teams: state.teams,
    chiefs: state.chiefs,
    driverStates: state.driverStates,
    teamStates: state.teamStates,
    sponsorDeals: state.sponsorDeals,
    manufacturerContracts: state.manufacturerContracts,
  };
}

/**
 * Build RaceProcessingInput from current game state and race result
 */
function buildRaceInput(state: GameState, raceResult: RaceWeekendResult): RaceProcessingInput {
  return {
    drivers: state.drivers,
    teams: state.teams,
    driverStates: state.driverStates,
    teamStates: state.teamStates,
    raceResult,
    currentStandings: {
      drivers: state.currentSeason.driverStandings,
      constructors: state.currentSeason.constructorStandings,
    },
  };
}

/**
 * Apply turn processing result to game state (mutates state)
 */
function applyTurnResult(state: GameState, result: TurnProcessingResult): void {
  state.currentDate = result.newDate;
  state.phase = result.newPhase;
  applyDriverStateChanges(state, result.driverStateChanges);
  applyTeamStateChanges(state, result.teamStateChanges);
}

/**
 * Mark calendar entry as completed with race result
 */
function markRaceComplete(state: GameState, circuitId: string, result: RaceWeekendResult): void {
  const entry = state.currentSeason.calendar.find((e) => e.circuitId === circuitId);
  if (entry) {
    entry.completed = true;
    entry.result = result;
  }
}

/**
 * Apply race processing result to game state (mutates state)
 */
function applyRaceResult(
  state: GameState,
  raceResult: RaceProcessingResult
): void {
  applyDriverStateChanges(state, raceResult.driverStateChanges);
  applyTeamStateChanges(state, raceResult.teamStateChanges);
  updateChampionshipStandings(state, raceResult.updatedStandings);
}

/**
 * Apply blocked turn result to state and return blocked AdvanceWeekResult.
 * Used when advancement is blocked (e.g., post-season reached).
 */
function applyBlockedResult(state: GameState, turnResult: TurnProcessingResult): AdvanceWeekResult {
  state.currentDate = turnResult.newDate;
  state.phase = turnResult.newPhase;
  return {
    success: true,
    state,
    blocked: turnResult.blocked,
  };
}

/**
 * Process a turn and apply results to state.
 * Handles both blocked and normal turn outcomes.
 */
function processTurn(state: GameState): AdvanceWeekResult {
  const turnInput = buildTurnInput(state);
  const turnResult = engineManager.turn.processWeek(turnInput);

  if (turnResult.blocked) {
    return applyBlockedResult(state, turnResult);
  }

  applyTurnResult(state, turnResult);
  return { success: true, state };
}

/**
 * Find the current race entry for a race weekend.
 * Returns the calendar entry if found, or an error result if not.
 */
function findCurrentRace(
  state: GameState
): { race: CalendarEntry } | { error: AdvanceWeekResult } {
  const race = state.currentSeason.calendar.find(
    (entry) =>
      entry.weekNumber === state.currentDate.week &&
      !entry.completed &&
      !entry.cancelled
  );

  if (!race) {
    return { error: { success: false, error: 'No race found for current week' } };
  }

  return { race };
}

/**
 * Process a race weekend: generate result, apply changes, mark complete.
 * Called when the game is in RaceWeekend phase.
 */
function processRaceWeekend(state: GameState, currentRace: CalendarEntry): void {
  // Generate stub race result
  const raceResult = generateStubRaceResult(
    state,
    currentRace.circuitId,
    currentRace.raceNumber
  );

  // Process race through engine
  const raceInput = buildRaceInput(state, raceResult);
  const raceProcessingResult = engineManager.turn.processRace(raceInput);

  // Apply race results to state
  applyRaceResult(state, raceProcessingResult);

  // Mark race as complete
  markRaceComplete(state, currentRace.circuitId, raceResult);
}

/**
 * GameStateManager - Singleton service for managing game state
 */
export const GameStateManager = {
  /** Current game state (null if no game loaded) */
  currentState: null as GameState | null,

  /** Start auto-save (call after loading a game) */
  startAutoSave,

  /** Stop auto-save (call when clearing state) */
  stopAutoSave,

  /**
   * Creates a new game with the given parameters
   */
  createNewGame(params: NewGameParams): GameState {
    const { playerName, teamId, seasonNumber = DEFAULT_STARTING_SEASON } = params;

    // Validate all inputs and dependencies (fail-fast)
    validateNewGameParams(params);

    // Load required single-instance config (validated above, but TypeScript needs explicit checks)
    const rules = ConfigLoader.getRules();
    const regulations = ConfigLoader.getRegulationsBySeason(seasonNumber);
    if (!rules || !regulations) {
      throw new Error('Internal error: config validation passed but data is missing');
    }

    // Load and clone all entities (prevents cache corruption during gameplay)
    const entities = loadAndCloneEntities();

    // Build the game state
    const gameState = buildGameState({
      playerName,
      teamId,
      seasonNumber,
      entities,
      rules: cloneDeep(rules),
      regulations: cloneDeep(regulations),
    });

    // Store as current state
    GameStateManager.currentState = gameState;

    // Start auto-save timer
    startAutoSave();

    return gameState;
  },

  /**
   * Returns the current game state, or null if no game is loaded
   */
  getCurrentState(): GameState | null {
    return GameStateManager.currentState;
  },

  /**
   * Clears the current game state and stops auto-save
   */
  clearState(): void {
    stopAutoSave();
    GameStateManager.currentState = null;
  },

  /**
   * Advances the game by one week.
   * Does NOT run races - use runRace for that.
   */
  advanceWeek(): AdvanceWeekResult {
    const state = GameStateManager.currentState;
    if (!state) {
      return { success: false, error: 'No active game' };
    }

    // Cannot advance during race weekend - must run race first
    if (state.phase === GamePhase.RaceWeekend) {
      return { success: false, error: 'Cannot advance during race weekend' };
    }

    // Advance to next week (handles blocked state and phase transitions)
    return processTurn(state);
  },

  /**
   * Transitions to RaceWeekend phase without advancing the week.
   * Used when the current week has a race but we haven't entered the weekend yet.
   */
  goToCircuit(): AdvanceWeekResult {
    const state = GameStateManager.currentState;
    if (!state) {
      return { success: false, error: 'No active game' };
    }

    // Already in RaceWeekend - nothing to do
    if (state.phase === GamePhase.RaceWeekend) {
      return { success: false, error: 'Already at circuit' };
    }

    // Verify current week has an uncompleted, non-cancelled race
    const race = state.currentSeason.calendar.find(
      (entry) =>
        entry.weekNumber === state.currentDate.week &&
        !entry.completed &&
        !entry.cancelled
    );

    if (!race) {
      return { success: false, error: 'No race scheduled for current week' };
    }

    // Just change phase - no week advancement
    state.phase = GamePhase.RaceWeekend;
    return { success: true, state };
  },

  /**
   * Runs the race and returns to BetweenRaces phase.
   * Does NOT advance the week - use advanceWeek for that.
   */
  runRace(): AdvanceWeekResult {
    const state = GameStateManager.currentState;
    if (!state) {
      return { success: false, error: 'No active game' };
    }

    // Must be in RaceWeekend phase
    if (state.phase !== GamePhase.RaceWeekend) {
      return { success: false, error: 'Not at circuit' };
    }

    // Find and process the race
    const result = findCurrentRace(state);
    if ('error' in result) {
      return result.error;
    }
    processRaceWeekend(state, result.race);

    // Return to BetweenRaces - week stays the same
    state.phase = GamePhase.BetweenRaces;
    return { success: true, state };
  },

  /**
   * Saves the current game state to a new file.
   * Handles timestamp syncing automatically.
   */
  async saveGame(): Promise<SaveResult> {
    const state = GameStateManager.currentState;
    if (!state) {
      return { success: false, error: 'No active game to save' };
    }
    const result = await SaveManager.save(state);
    if (result.success && result.savedAt) {
      state.lastSavedAt = result.savedAt;
    }
    return result;
  },

  /**
   * Loads a game state from a save file.
   * Sets it as the current state and starts auto-save.
   */
  async loadGame(filename: string): Promise<LoadResult> {
    const result = await SaveManager.load(filename);
    if (result.success && result.state) {
      GameStateManager.currentState = result.state;
      startAutoSave();
    }
    return result;
  },

  /**
   * Starts a new season after post-season is complete.
   *
   * Logic flow:
   * 1. Verify we're in PostSeason phase
   * 2. Process season end (aging, retirements, attribute changes)
   * 3. Archive current season to pastSeasons
   * 4. Initialize new season (standings, calendar, date, phase)
   */
  startNewSeason(): NewSeasonResult {
    const state = GameStateManager.currentState;
    if (!state) {
      return { success: false, error: 'No active game' };
    }

    // Only allowed from PostSeason phase
    if (state.phase !== GamePhase.PostSeason) {
      return {
        success: false,
        error: 'Can only start a new season from the PostSeason phase',
      };
    }

    // Process season end through engine
    const seasonEndInput = buildSeasonEndInput(state);
    const seasonEndResult = engineManager.turn.processSeasonEnd(seasonEndInput);

    // Apply aging, retirements, and state resets
    applySeasonEndResult(state, seasonEndResult);

    // Transition to new season (archive old, create new)
    transitionToNewSeason(state, seasonEndResult.newCalendar);

    return { success: true, state };
  },
};
