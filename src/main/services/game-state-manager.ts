/**
 * GameStateManager Service
 *
 * Manages the game state lifecycle:
 * - Creating new games
 * - Holding current state in memory
 * - Auto-save functionality
 */

import { randomUUID } from 'crypto';
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
  type SimulationResult,
  type SimulationTickPayload,
  type PartInstallationChoice,
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
  DesignUpdate,
  TestingUpdate,
} from '../../shared/domain/engines';
import type {
  GameState,
  GameDate,
  PlayerInfo,
  SeasonData,
  CalendarEntry,
  CalendarEvent,
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
  TeamPrincipal,
  Car,
  GameRules,
  SeasonRegulations,
  NewGameParams,
  RaceWeekendResult,
  DesignState,
  TechnologyLevel,
  CurrentYearChassisState,
  HandlingProblemState,
  TechnologyDesignProject,
  EngineCustomisation,
} from '../../shared/domain';
import {
  GamePhase,
  Department,
  ManufacturerType,
  ManufacturerDealType,
  TechnologyComponent,
  TechnologyAttribute,
  TechnologyProjectPhase,
  HandlingProblem,
  ChassisDesignStage,
  CalendarEventType,
  EmailCategory,
  hasRaceSeat,
  createEvent,
  managerRef,
  teamRef,
  TECH_COMPONENT_DISPLAY_NAMES,
  CHASSIS_STAGE_DISPLAY_NAMES,
  TECH_ATTRIBUTE_SHORT_NAMES,
  TECH_ATTRIBUTE_DISPLAY_NAMES,
  HANDLING_PROBLEM_DISPLAY_NAMES,
  getProjectedMilestones,
  ChiefRole,
  CHASSIS_STAGE_ORDER,
  TYPICAL_WORK_UNITS_PER_DAY,
  createDefaultTestSession,
} from '../../shared/domain';
import {
  PendingPartSource,
  DriverRole,
  RaceFinishStatus,
  PartsLogEntryType,
  NegotiationStatus,
  type EmailData,
  type ChassisStageCompleteData,
  type TechBreakthroughData,
  type TechDevelopmentCompleteData,
  type HandlingSolutionCompleteData,
  type TestCompleteData,
  type PartReadyData,
  type PostRaceRepairData,
  type CarRepairCost,
  type PendingPart,
  type DriverRaceResult,
  type SpecReleaseData,
  type SpecReleaseStatChange,
  type ContractTerms,
} from '../../shared/domain/types';
import {
  getPreSeasonStartDate,
  getWeekNumber,
  yearToSeason,
  DEFAULT_SIMULATION_STATE,
  offsetDate,
  isSameDay,
} from '../../shared/utils/date-utils';
import {
  createDefaultTeamEngineState,
  isValidCustomisation,
  MAX_CUSTOMISATION_PER_STAT,
  createInitialSpecState,
  shouldReleaseSpec,
  generateSpecBonus,
  ENGINE_STAT_KEYS,
  ENGINE_STAT_DISPLAY_NAMES,
  createInitialEngineAnalytics,
  calculateTruePower,
  generateEstimatedPower,
  getEffectiveEngineStats,
  getSpecBonusesAsEngineStats,
  createNegotiation,
} from '../../shared/domain/engine-utils';

/** Current save format version */
const SAVE_VERSION = '1.0.0';

/** Default contract duration in seasons */
const DEFAULT_CONTRACT_DURATION = 3;

/** Default starting season for new games */
const DEFAULT_STARTING_SEASON = 1;

/** Days to build a part after design completes */
const PART_BUILD_TIME_DAYS = 7;

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

/** Initial car condition for new cars (0-100, 100 = perfect) */
const INITIAL_CAR_CONDITION = 100;

/** Number of cars per team (modern F1) */
const CARS_PER_TEAM = 2;

/** First race typically in March (week 11) */
const FIRST_RACE_WEEK = 11;

/** Default gap between races when schedule data unavailable (bi-weekly) */
const DEFAULT_WEEKS_BETWEEN_RACES = 2;

/** Post-Race Repair Costs - values per proposal.md, simplified for MVP */
const REPAIR_COST_BASE = 50000; // Routine maintenance after every race
const REPAIR_COST_DNF = 400000; // Additional cost when driver retires from race

/** Auto-save interval in milliseconds (5 minutes) */
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

/** Base simulation tick interval in milliseconds (1 day per second) */
const BASE_SIMULATION_TICK_MS = 1000;

/** Simulation acceleration config */
const SIM_WARMUP_DAYS = 7;      // Days at 1x speed before acceleration starts
const SIM_ACCEL_DAYS = 15;      // Days over which we accelerate from 1x to 3x (day 8 to day 22)
const SIM_MAX_SPEED = 3.0;      // Maximum speed multiplier (333ms per tick)

/** Initial technology attribute level (0-100 scale, 35 = midpoint of 10-60 normalized range) */
const INITIAL_TECH_LEVEL = 35;

/**
 * Creates initial technology levels for all 7 components
 * All components start at midpoint (35) for both performance and reliability
 */
function createInitialTechnologyLevels(): TechnologyLevel[] {
  return Object.values(TechnologyComponent).map((component) => ({
    component,
    performance: INITIAL_TECH_LEVEL,
    reliability: INITIAL_TECH_LEVEL,
  }));
}

/**
 * Creates initial handling problem state for all 8 problems
 * All problems start undiscovered (revealed through testing)
 */
function createInitialHandlingProblems(): HandlingProblemState[] {
  return Object.values(HandlingProblem).map((problem) => ({
    problem,
    discovered: false,
    solutionProgress: 0,
    solutionDesigned: false,
    solutionInstalled: false,
  }));
}

/**
 * Creates initial design state for a team
 * No active design projects, average technology, no handling info revealed
 */
function createInitialDesignState(): DesignState {
  const currentYearChassis: CurrentYearChassisState = {
    handlingRevealed: null,
    problems: createInitialHandlingProblems(),
    activeDesignProblem: null,
    designersAssigned: 0,
    accumulatedSolutionWorkUnits: 0,
  };

  return {
    nextYearChassis: null,
    technologyLevels: createInitialTechnologyLevels(),
    activeTechnologyProjects: [],
    currentYearChassis,
  };
}

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
 * Gets the player's design state, throwing if no game is active.
 * Used by design-related GameStateManager methods to reduce boilerplate.
 */
function getPlayerDesignState(): { state: GameState; designState: DesignState } {
  const state = GameStateManager.currentState;
  if (!state) {
    throw new Error('No active game');
  }
  const playerTeamId = state.player.teamId;
  const teamState = state.teamStates[playerTeamId];
  return { state, designState: teamState.designState };
}

/**
 * Gets the player's engine contract context with all related entities.
 * Used by engine purchase operations.
 */
function getPlayerEngineContext(): {
  state: GameState;
  playerTeam: Team;
  teamState: TeamRuntimeState;
  engineContract: ActiveManufacturerContract;
  manufacturer: Manufacturer;
} {
  const state = GameStateManager.currentState;
  if (!state) {
    throw new Error('No active game');
  }

  const playerTeamId = state.player.teamId;
  const playerTeam = state.teams.find((t) => t.id === playerTeamId);
  const teamState = state.teamStates[playerTeamId];
  if (!playerTeam || !teamState) {
    throw new Error('Player team not found');
  }

  const engineContract = state.manufacturerContracts.find(
    (c) => c.teamId === playerTeamId && c.type === 'engine'
  );
  if (!engineContract) {
    throw new Error('No engine contract found');
  }

  const manufacturer = state.manufacturers.find((m) => m.id === engineContract.manufacturerId);
  if (!manufacturer) {
    throw new Error('Engine manufacturer not found');
  }

  return { state, playerTeam, teamState, engineContract, manufacturer };
}

/**
 * Creates a predicate for finding technology projects by component and attribute.
 */
function matchesTechProject(component: TechnologyComponent, attribute: TechnologyAttribute) {
  return (p: TechnologyDesignProject): boolean =>
    p.component === component && p.attribute === attribute;
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
    testSession: createDefaultTestSession(),
    designState: createInitialDesignState(),
    pendingParts: [],
    engineState: createDefaultTeamEngineState(),
  };
}

/** All entity arrays loaded from config */
interface LoadedEntities {
  teams: Team[];
  drivers: Driver[];
  chiefs: Chief[];
  principals: TeamPrincipal[];
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
  const principals = ConfigLoader.getPrincipals();
  const sponsors = ConfigLoader.getSponsors();
  const manufacturers = ConfigLoader.getManufacturers();
  const circuits = ConfigLoader.getCircuits();

  assertNonEmpty(teams, 'teams');
  assertNonEmpty(drivers, 'drivers');
  assertNonEmpty(circuits, 'circuits');
  assertNonEmpty(sponsors, 'sponsors');
  assertNonEmpty(manufacturers, 'manufacturers');
  assertNonEmpty(chiefs, 'chiefs');
  assertNonEmpty(principals, 'principals');

  return {
    teams: cloneDeep(teams),
    drivers: cloneDeep(drivers),
    chiefs: cloneDeep(chiefs),
    principals: cloneDeep(principals),
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
 * Creates initial cars for all teams (2 race cars per team)
 * Uses team's engine manufacturer from initialEngineManufacturerId
 */
function createInitialCars(teams: Team[]): Car[] {
  const cars: Car[] = [];

  for (const team of teams) {
    for (let i = 1; i <= CARS_PER_TEAM; i++) {
      cars.push({
        id: `${team.id}-car-${i}`,
        teamId: team.id,
        chassisId: `${team.id}-chassis-s1`, // Season 1 chassis placeholder
        condition: INITIAL_CAR_CONDITION,
        mileage: 0,
        isRaceCar: true,
      });
    }
  }

  return cars;
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
  const { teams, drivers, chiefs, principals, sponsors, manufacturers, circuits } = entities;

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

  // Create initial manufacturer spec states (all start at spec 1 with no bonuses)
  const manufacturerSpecs = manufacturers
    .filter((m) => m.type === ManufacturerType.Engine)
    .map((m) => createInitialSpecState(m.id));

  // Create initial engine analytics (empty - data collected after each race)
  const engineAnalytics = createInitialEngineAnalytics(teams.map((t) => t.id));

  // Create initial cars (2 per team)
  const cars = createInitialCars(teams);

  // Create player info and date
  const player: PlayerInfo = {
    name: playerName,
    teamId,
    careerStartSeason: seasonNumber,
  };

  // Start at pre-season (January 1st of the season's year)
  const currentDate: GameDate = getPreSeasonStartDate(seasonNumber);

  // Assemble complete game state
  const now = new Date().toISOString();
  return {
    version: SAVE_VERSION,
    gameId: randomUUID(),
    createdAt: now,
    lastSavedAt: now,

    player,
    currentDate,
    phase: GamePhase.PreSeason,
    simulation: { ...DEFAULT_SIMULATION_STATE },
    calendarEvents: [],

    currentSeason,

    teams,
    drivers,
    chiefs,
    principals,
    sponsors,
    manufacturers,
    circuits,
    cars,

    driverStates,
    teamStates,

    sponsorDeals,
    manufacturerContracts,
    manufacturerSpecs,
    engineAnalytics,
    engineNegotiations: [],

    pastSeasons: [],
    events: [],
    partsLog: [],
    rules,
  };
}

/** Auto-save timer handle */
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

/** Simulation timer handle (using setTimeout for dynamic intervals) */
let simulationTimer: ReturnType<typeof setTimeout> | null = null;

/** Days simulated in current session (for acceleration calculation) */
let simulationDaysCount = 0;

/**
 * Calculate the current simulation speed multiplier based on days simulated.
 * - Days 1-7: 1x speed
 * - Days 8-22: linear increase from 1x to 3x
 * - Days 23+: 3x speed (capped)
 */
function getSimulationSpeed(daysSimulated: number): number {
  const daysAccelerating = Math.max(0, daysSimulated - SIM_WARMUP_DAYS + 1);
  return Math.min(SIM_MAX_SPEED, 1 + (daysAccelerating * (SIM_MAX_SPEED - 1)) / SIM_ACCEL_DAYS);
}

/**
 * Get the tick interval in ms for the current simulation state
 */
function getSimulationTickInterval(daysSimulated: number): number {
  const speed = getSimulationSpeed(daysSimulated);
  return Math.round(BASE_SIMULATION_TICK_MS / speed);
}

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
      const result = await SaveManager.autoSave(GameStateManager.currentState);
      if (result.skipped) {
        console.log('[AutoSave] Skipped - no changes since last autosave');
      } else if (result.success && result.filename) {
        // Update the state's lastSavedAt timestamp
        if (result.savedAt) {
          GameStateManager.currentState.lastSavedAt = result.savedAt;
        }
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

/**
 * Processes a single simulation tick (one day).
 * Returns the tick payload to send to renderer.
 * Updates the game state's simulation.isSimulating flag if stopped.
 */
function processSimulationTick(state: GameState): SimulationTickPayload {
  const turnInput = buildTurnInput(state);
  const turnResult = engineManager.turn.processDay(turnInput);

  // Apply turn result (works for both blocked and normal cases -
  // blocked returns empty change arrays so this is safe)
  const playerHadMilestone = applyTurnResult(state, turnResult);

  // Determine if we should stop (blocked, explicit stop flag, or design milestone)
  const shouldStop =
    turnResult.blocked !== undefined ||
    turnResult.shouldStopSimulation ||
    playerHadMilestone;

  // Determine stop reason
  let stopReason = turnResult.stopReason;
  if (!stopReason && playerHadMilestone) {
    stopReason = 'design-milestone';
  }

  if (shouldStop) {
    state.simulation.isSimulating = false;
  }

  return {
    state,
    stopped: shouldStop,
    stopReason,
  };
}

/**
 * Schedules the next simulation tick with dynamic interval based on acceleration
 */
function scheduleNextTick(): void {
  const currentState = GameStateManager.currentState;
  if (!currentState || !currentState.simulation.isSimulating) {
    return;
  }

  const interval = getSimulationTickInterval(simulationDaysCount);

  simulationTimer = setTimeout(() => {
    const state = GameStateManager.currentState;
    if (!state) {
      stopSimulation();
      return;
    }

    try {
      // Update speed in state for UI display
      state.simulation.speed = getSimulationSpeed(simulationDaysCount);

      const tickPayload = processSimulationTick(state);
      sendToRenderer(IpcEvents.SIMULATION_TICK, tickPayload);

      // Increment days counter after successful tick
      simulationDaysCount++;

      // If simulation stopped, don't schedule next tick
      if (tickPayload.stopped) {
        stopSimulation();
      } else {
        scheduleNextTick();
      }
    } catch (error) {
      console.error('[Simulation] Tick failed:', error);
      stopSimulation();
    }
  }, interval);
}

/**
 * Starts the simulation loop.
 * Returns immediately - ticks are processed via setTimeout with dynamic intervals.
 */
function startSimulation(): SimulationResult {
  const state = GameStateManager.currentState;
  if (!state) {
    return { success: false, error: 'No active game' };
  }

  // Already simulating
  if (simulationTimer !== null) {
    return { success: false, error: 'Simulation already running' };
  }

  // Cannot simulate during race weekend
  if (state.phase === GamePhase.RaceWeekend) {
    return { success: false, error: 'Cannot simulate during race weekend' };
  }

  // Cannot simulate during post-season
  if (state.phase === GamePhase.PostSeason) {
    return { success: false, error: 'Cannot simulate during post-season' };
  }

  // Reset days counter and mark as simulating
  simulationDaysCount = 0;
  state.simulation.isSimulating = true;
  state.simulation.speed = 1; // Start at 1x

  // Start the simulation loop
  scheduleNextTick();

  return { success: true };
}

/**
 * Stops the simulation loop
 */
function stopSimulation(): SimulationResult {
  if (simulationTimer) {
    clearTimeout(simulationTimer);
    simulationTimer = null;
  }

  // Reset days counter
  simulationDaysCount = 0;

  const state = GameStateManager.currentState;
  if (state) {
    state.simulation.isSimulating = false;
    state.simulation.speed = 1; // Reset speed display
  }

  return { success: true };
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
 * Check if a design update has any milestones (events that should be shown on calendar)
 */
function hasMilestones(update: DesignUpdate): boolean {
  return (
    update.breakthroughs.length > 0 ||
    update.completions.length > 0 ||
    update.chassisStageCompletions.length > 0
  );
}

/**
 * Create an email calendar event for design notifications
 */
function createDesignEmail(
  date: GameDate,
  subject: string,
  body: string,
  sender: string,
  senderId: string | undefined,
  emailCategory: EmailCategory,
  critical: boolean,
  data?: EmailData
): CalendarEvent {
  return {
    id: randomUUID(),
    date,
    type: CalendarEventType.Email,
    subject,
    critical,
    emailCategory,
    sender,
    senderId,
    body,
    data,
  };
}

/**
 * Format a chief's name with their role for email sender
 */
function formatChiefSender(chief: Chief | null): string {
  if (!chief) return 'Design Department';
  return `${chief.firstName} ${chief.lastName} (Chief Designer)`;
}

/**
 * Create a news headline for design events from AI teams
 */
function createDesignNewsHeadline(
  date: GameDate,
  subject: string,
  body: string
): CalendarEvent {
  return {
    id: randomUUID(),
    date,
    type: CalendarEventType.Headline,
    subject,
    body,
    critical: false,
  };
}

/**
 * Generate news headlines for a team's design milestones
 */
function generateDesignNewsForTeam(
  state: GameState,
  update: DesignUpdate,
  currentDate: GameDate,
  teamName: string
): void {
  // Chassis stage completions
  for (const completion of update.chassisStageCompletions) {
    const stageName = CHASSIS_STAGE_DISPLAY_NAMES[completion.stage];
    const subject = `${teamName} complete ${stageName} stage`;
    const body = `${teamName} have completed the ${stageName} stage of their next year's chassis development. ` +
      `The team continues to make progress on their car design for the upcoming season.`;
    state.calendarEvents.push(createDesignNewsHeadline(currentDate, subject, body));
  }

  // Technology breakthroughs
  for (const breakthrough of update.breakthroughs) {
    const techName = TECH_COMPONENT_DISPLAY_NAMES[breakthrough.component];
    const attrShortName = TECH_ATTRIBUTE_SHORT_NAMES[breakthrough.attribute];
    const subject = `${teamName} achieve ${techName} breakthrough`;
    const body = `${teamName} have made a breakthrough in ${techName} ${attrShortName}. ` +
      `The team's engineering department is now working to implement this improvement into their car.`;
    state.calendarEvents.push(createDesignNewsHeadline(currentDate, subject, body));
  }

  // Technology completions
  for (const completion of update.completions) {
    if (completion.type === 'technology') {
      const techName = TECH_COMPONENT_DISPLAY_NAMES[completion.component];
      const attrShortName = TECH_ATTRIBUTE_SHORT_NAMES[completion.attribute];
      const subject = `${teamName} upgrade ${techName}`;
      const body = `${teamName} have completed development of an upgraded ${techName} component. ` +
        `The improvement to ${attrShortName} is now available for use in their cars.`;
      state.calendarEvents.push(createDesignNewsHeadline(currentDate, subject, body));
    } else {
      // Handling solution completion
      const problemName = HANDLING_PROBLEM_DISPLAY_NAMES[completion.problem];
      const subject = `${teamName} resolve handling issue`;
      const body = `${teamName} have successfully addressed the ${problemName} handling problem with their current chassis. ` +
        `Drivers should notice improved performance in affected conditions.`;
      state.calendarEvents.push(createDesignNewsHeadline(currentDate, subject, body));
    }
  }
}

/**
 * Apply design updates to game state and create calendar events for milestones
 * Returns true if player team had any milestones (for auto-stop)
 */
function applyDesignUpdates(
  state: GameState,
  updates: DesignUpdate[],
  currentDate: GameDate
): boolean {
  let playerHadMilestone = false;
  const playerTeamId = state.player.teamId;

  for (const update of updates) {
    // Update the team's design state
    const teamState = state.teamStates[update.teamId];
    if (teamState) {
      teamState.designState = update.updatedDesignState;
    }

    // Check if this is the player's team and has milestones
    const isPlayerTeam = update.teamId === playerTeamId;
    if (isPlayerTeam && hasMilestones(update)) {
      playerHadMilestone = true;
    }

    // For non-player teams: generate news headlines if they have milestones, then skip
    if (!isPlayerTeam) {
      if (hasMilestones(update)) {
        const team = state.teams.find((t) => t.id === update.teamId);
        if (team) {
          generateDesignNewsForTeam(state, update, currentDate, team.name);
        }
      }
      continue;
    }

    // Get the Chief Designer for sender
    const chiefDesigner = state.chiefs.find(
      (c) => c.teamId === update.teamId && c.role === ChiefRole.Designer
    ) ?? null;
    const sender = formatChiefSender(chiefDesigner);

    // Chassis stage completions
    for (const completion of update.chassisStageCompletions) {
      const stageName = CHASSIS_STAGE_DISPLAY_NAMES[completion.stage];
      const stageIndex = CHASSIS_STAGE_ORDER.indexOf(completion.stage);
      const chassisYear = update.updatedDesignState.nextYearChassis?.targetYear ?? 0;
      const body = `The ${stageName} stage of next year's chassis design is now complete. ` +
        `The new efficiency rating is ${completion.newEfficiencyRating.toFixed(1)}. ` +
        `We can now proceed to the next phase of development.`;
      const data: ChassisStageCompleteData = {
        category: EmailCategory.ChassisStageComplete,
        chassisYear,
        completedStageIndex: stageIndex,
        stageName,
        efficiency: completion.newEfficiencyRating,
        chiefId: chiefDesigner?.id,
      };
      state.calendarEvents.push(
        createDesignEmail(
          currentDate,
          `${stageName} stage complete`,
          body,
          sender,
          chiefDesigner?.id,
          EmailCategory.ChassisStageComplete,
          true,
          data
        )
      );
    }

    // Technology breakthroughs
    for (const breakthrough of update.breakthroughs) {
      const techName = TECH_COMPONENT_DISPLAY_NAMES[breakthrough.component];
      const attrShortName = TECH_ATTRIBUTE_SHORT_NAMES[breakthrough.attribute];
      const attrFullName = TECH_ATTRIBUTE_DISPLAY_NAMES[breakthrough.attribute];
      const subject = `${techName} ${attrShortName} breakthrough (+${breakthrough.statIncrease})`;
      const body = `Excellent news! Our research into ${techName} ${attrShortName} has yielded a breakthrough. ` +
        `We've discovered an improvement worth +${breakthrough.statIncrease} points. ` +
        `The development team is now working to implement this into a production-ready component.`;
      const estimatedDays = Math.ceil(breakthrough.workUnitsRequired / TYPICAL_WORK_UNITS_PER_DAY);
      const data: TechBreakthroughData = {
        category: EmailCategory.TechBreakthrough,
        component: breakthrough.component,
        attribute: breakthrough.attribute,
        componentName: techName,
        attributeName: attrFullName,
        statIncrease: breakthrough.statIncrease,
        estimatedDays,
        chiefId: chiefDesigner?.id,
      };
      state.calendarEvents.push(
        createDesignEmail(
          currentDate,
          subject,
          body,
          sender,
          chiefDesigner?.id,
          EmailCategory.TechBreakthrough,
          true,
          data
        )
      );
    }

    // Technology completions
    for (const completion of update.completions) {
      if (completion.type === 'technology') {
        const techName = TECH_COMPONENT_DISPLAY_NAMES[completion.component];
        const attrShortName = TECH_ATTRIBUTE_SHORT_NAMES[completion.attribute];
        const attrFullName = TECH_ATTRIBUTE_DISPLAY_NAMES[completion.attribute];
        const subject = `${techName} ${attrShortName} development complete`;
        const body = `The ${techName} ${attrShortName} development project is now complete. ` +
          `Our ${attrShortName} rating has improved by +${completion.statIncrease} points. ` +
          `The part is now being built and will be ready for installation in ${PART_BUILD_TIME_DAYS} days.`;
        // Get the new value from updated technology levels
        const techLevel = update.updatedDesignState.technologyLevels.find(
          (t) => t.component === completion.component
        );
        const newValue = completion.attribute === TechnologyAttribute.Performance
          ? techLevel?.performance ?? 0
          : techLevel?.reliability ?? 0;
        const data: TechDevelopmentCompleteData = {
          category: EmailCategory.TechDevelopmentComplete,
          component: completion.component,
          attribute: completion.attribute,
          componentName: techName,
          attributeName: attrFullName,
          statIncrease: completion.statIncrease,
          newValue,
          chiefId: chiefDesigner?.id,
        };
        state.calendarEvents.push(
          createDesignEmail(
            currentDate,
            subject,
            body,
            sender,
            chiefDesigner?.id,
            EmailCategory.TechDevelopmentComplete,
            true,
            data
          )
        );

        // Create pending part for player team
        if (isPlayerTeam) {
          const itemName = `${techName} ${attrShortName} +${completion.statIncrease}`;
          const pendingPart: PendingPart = {
            id: randomUUID(),
            source: PendingPartSource.Technology,
            item: itemName,
            payoff: completion.statIncrease,
            baseCost: 50000, // TODO: Calculate based on component/improvement
            buildStartDate: currentDate,
            readyDate: offsetDate(currentDate, PART_BUILD_TIME_DAYS),
            installedOnCars: [],
            component: completion.component,
            attribute: completion.attribute,
          };
          teamState.pendingParts.push(pendingPart);
        }
      } else {
        // Handling solution completion
        const problemName = HANDLING_PROBLEM_DISPLAY_NAMES[completion.problem];
        const subject = `Handling solution complete: ${problemName}`;
        const body = `We have successfully resolved the ${problemName} handling issue. ` +
          `The chassis handling has improved by +${completion.statIncrease} points. ` +
          `The part is now being built and will be ready for installation in ${PART_BUILD_TIME_DAYS} days.`;
        const data: HandlingSolutionCompleteData = {
          category: EmailCategory.HandlingSolutionComplete,
          problem: completion.problem,
          problemName,
          handlingImprovement: completion.statIncrease,
          chiefId: chiefDesigner?.id,
        };
        state.calendarEvents.push(
          createDesignEmail(
            currentDate,
            subject,
            body,
            sender,
            chiefDesigner?.id,
            EmailCategory.HandlingSolutionComplete,
            true,
            data
          )
        );

        // Create pending part for player team
        if (isPlayerTeam) {
          const itemName = `${problemName} Fix`;
          const pendingPart: PendingPart = {
            id: randomUUID(),
            source: PendingPartSource.HandlingSolution,
            item: itemName,
            payoff: completion.statIncrease,
            baseCost: 75000, // TODO: Calculate based on problem
            buildStartDate: currentDate,
            readyDate: offsetDate(currentDate, PART_BUILD_TIME_DAYS),
            installedOnCars: [],
            handlingProblem: completion.problem,
          };
          teamState.pendingParts.push(pendingPart);
        }
      }
    }
  }

  return playerHadMilestone;
}

/**
 * Apply testing updates to game state and create emails for completions
 * Returns true if player team had a test completion (for potential auto-stop)
 */
function applyTestingUpdates(
  state: GameState,
  updates: TestingUpdate[],
  currentDate: GameDate
): boolean {
  let playerHadCompletion = false;
  const playerTeamId = state.player.teamId;

  for (const update of updates) {
    const teamState = state.teamStates[update.teamId];
    if (!teamState) continue;

    // Update the team's test session
    teamState.testSession = update.updatedTestSession;

    // Handle test completion
    if (update.completion) {
      const isPlayerTeam = update.teamId === playerTeamId;

      if (isPlayerTeam) {
        playerHadCompletion = true;

        // Update testsCompleted count (already in updatedTestSession)
        // But we need to apply handling/problem discovery to currentYearChassis

        if (update.completion.handlingRevealed !== null) {
          // First test: reveal handling percentage
          teamState.designState.currentYearChassis.handlingRevealed =
            update.completion.handlingRevealed;
        }

        if (update.completion.problemDiscovered !== null) {
          // Subsequent test: mark problem as discovered
          const problemState = teamState.designState.currentYearChassis.problems.find(
            (p) => p.problem === update.completion!.problemDiscovered
          );
          if (problemState) {
            problemState.discovered = true;
          }
        }

        // Generate test completion email for player
        const chiefMechanic = state.chiefs.find(
          (c) => c.teamId === update.teamId && c.role === ChiefRole.Mechanic
        ) ?? null;
        const sender = formatChiefSender(chiefMechanic);

        let subject: string;
        let body: string;

        if (update.completion.handlingRevealed !== null) {
          // First test - handling revealed
          subject = `Development Test Complete - Handling: ${update.completion.handlingRevealed}%`;
          body = `Our first development test has concluded. We've measured the chassis handling at ${update.completion.handlingRevealed}%. ` +
            `Run additional tests to discover specific handling problems that can be solved to improve performance.`;
        } else if (update.completion.problemDiscovered !== null) {
          // Subsequent test - problem discovered
          const problemName = HANDLING_PROBLEM_DISPLAY_NAMES[update.completion.problemDiscovered];
          subject = `Development Test Complete - Problem Discovered: ${problemName}`;
          body = `Our development test has identified a handling issue: ${problemName}. ` +
            `This problem can now be assigned to the Design department for a solution to be developed.`;
        } else {
          // No more problems to discover
          subject = 'Development Test Complete - No New Problems Found';
          body = 'Our development test has concluded. All handling problems have already been discovered. ' +
            'Focus on solving the known problems in the Design department.';
        }

        const problemName = update.completion.problemDiscovered
          ? HANDLING_PROBLEM_DISPLAY_NAMES[update.completion.problemDiscovered]
          : null;

        const data: TestCompleteData = {
          category: EmailCategory.TestComplete,
          testsCompleted: update.completion.testsCompleted,
          handlingRevealed: update.completion.handlingRevealed,
          problemDiscovered: update.completion.problemDiscovered,
          problemName,
          chiefMechanicId: chiefMechanic?.id,
        };

        state.calendarEvents.push({
          id: randomUUID(),
          date: currentDate,
          type: CalendarEventType.Email,
          subject,
          body,
          sender,
          critical: true,
          data,
        });
      }
    }
  }

  return playerHadCompletion;
}

/**
 * Update projected milestone events on the calendar
 * Clears old projections and adds new ones based on current allocations
 */
function updateProjectedMilestones(state: GameState): void {
  // Remove old projection events
  state.calendarEvents = state.calendarEvents.filter(
    (e) => e.type !== CalendarEventType.Projection
  );

  // Get player team data
  const playerTeamId = state.player.teamId;
  const playerTeam = state.teams.find((t) => t.id === playerTeamId);
  const playerTeamState = state.teamStates[playerTeamId];
  if (!playerTeam || !playerTeamState) return;

  const chiefDesigner = state.chiefs.find(
    (c) => c.teamId === playerTeamId && c.role === ChiefRole.Designer
  ) ?? null;

  // Compute projected milestones
  const projections = getProjectedMilestones(
    playerTeamState.designState,
    {
      staffCounts: playerTeamState.staffCounts.design,
      facilities: playerTeam.factory.facilities,
      chiefDesigner,
    },
    state.currentDate
  );

  // Add projection events to calendar
  for (const projection of projections) {
    state.calendarEvents.push({
      id: randomUUID(),
      date: projection.estimatedDate,
      type: CalendarEventType.Projection,
      subject: projection.description,
      critical: false,
    });
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
    currentSeason: yearToSeason(state.currentDate.year),
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
  const currentSeasonNumber = yearToSeason(state.currentDate.year);
  const newSeasonNumber = currentSeasonNumber + 1;

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

  // Update date to start of new season (January 1st)
  state.currentDate = getPreSeasonStartDate(newSeasonNumber);

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
 * Check for pending parts that are ready and emit Part Ready emails
 * Returns true if any part became ready (for auto-stop)
 */
function checkPendingParts(state: GameState, currentDate: GameDate): boolean {
  const playerTeamId = state.player.teamId;
  const teamState = state.teamStates[playerTeamId];
  const playerTeam = state.teams.find((t) => t.id === playerTeamId);
  if (!teamState || !playerTeam) return false;

  // Find team drivers for recommendation
  const teamDrivers = state.drivers.filter(
    (d) => d.teamId === playerTeamId && d.role !== DriverRole.Test
  );
  if (teamDrivers.length < 2) return false; // Need 2 drivers for recommendation

  // Sort by car number to get car 1 and car 2 drivers
  const sortedDrivers = [...teamDrivers].sort(
    (a, b) => (a.raceNumber ?? 99) - (b.raceNumber ?? 99)
  );
  const driver1 = sortedDrivers[0];
  const driver2 = sortedDrivers[1];

  // Determine recommendation based on driver roles
  // Driver 1 / Driver 2 roles: always recommend Driver 1
  // Equal / Equal roles: use a simple rotation (first ready part goes to car 1)
  const equalRoles = driver1.role === DriverRole.Equal && driver2.role === DriverRole.Equal;

  // Get chief designer for sender
  const chiefDesigner = state.chiefs.find(
    (c) => c.teamId === playerTeamId && c.role === ChiefRole.Designer
  );
  const sender = formatChiefSender(chiefDesigner);

  let hadReadyPart = false;
  let partIndex = 0;

  for (const pendingPart of teamState.pendingParts) {
    // Only process parts that are ready and not yet installed
    if (pendingPart.installedOnCars.length > 0) continue;
    if (!isSameDay(pendingPart.readyDate, currentDate)) continue;

    hadReadyPart = true;

    // Determine recommendation for this part
    let recommendedCar: 1 | 2;
    let recommendedDriver: typeof driver1;
    let otherDriver: typeof driver1;

    if (equalRoles) {
      // Rotate recommendation based on part index
      recommendedCar = partIndex % 2 === 0 ? 1 : 2;
      recommendedDriver = recommendedCar === 1 ? driver1 : driver2;
      otherDriver = recommendedCar === 1 ? driver2 : driver1;
    } else {
      // Driver 1 role gets priority
      if (driver1.role === DriverRole.First) {
        recommendedCar = 1;
        recommendedDriver = driver1;
        otherDriver = driver2;
      } else {
        recommendedCar = 2;
        recommendedDriver = driver2;
        otherDriver = driver1;
      }
    }

    const data: PartReadyData = {
      category: EmailCategory.PartReady,
      pendingPartId: pendingPart.id,
      item: pendingPart.item,
      payoff: pendingPart.payoff,
      baseCost: pendingPart.baseCost,
      recommendedCar,
      recommendedDriverId: recommendedDriver.id,
      recommendedDriverName: `${recommendedDriver.firstName} ${recommendedDriver.lastName}`,
      otherDriverId: otherDriver.id,
      otherDriverName: `${otherDriver.firstName} ${otherDriver.lastName}`,
      chiefId: chiefDesigner?.id,
    };

    const subject = `Part ready: ${pendingPart.item}`;
    const body = `The ${pendingPart.item} is now ready for installation. ` +
      `We recommend installing on ${recommendedDriver.firstName} ${recommendedDriver.lastName}'s car first. ` +
      `Installation cost: $${pendingPart.baseCost.toLocaleString()} per car, ` +
      `or $${(pendingPart.baseCost * 3).toLocaleString()} for both cars (rush).`;

    state.calendarEvents.push(
      createDesignEmail(
        currentDate,
        subject,
        body,
        sender,
        chiefDesigner?.id,
        EmailCategory.PartReady,
        true, // Critical - auto-stop for player to make installation choice
        data
      )
    );

    partIndex++;
  }

  return hadReadyPart;
}

/**
 * Process spec releases for all engine manufacturers
 * Each manufacturer has a daily probability of releasing a new spec
 */
function processSpecReleases(state: GameState, currentDate: GameDate): void {
  // Only process during racing season (not pre-season or post-season)
  if (state.phase === GamePhase.PreSeason || state.phase === GamePhase.PostSeason) {
    return;
  }

  const playerTeamId = state.player.teamId;
  const playerEngineContract = state.manufacturerContracts.find(
    (c) => c.teamId === playerTeamId && c.type === ManufacturerType.Engine
  );

  for (const specState of state.manufacturerSpecs) {
    const manufacturer = state.manufacturers.find((m) => m.id === specState.manufacturerId);
    if (!manufacturer) continue;

    // Check if this manufacturer releases a spec today
    if (!shouldReleaseSpec(manufacturer.reputation)) continue;

    // Generate the new spec bonuses
    const newBonus = generateSpecBonus(manufacturer.reputation);
    specState.latestSpecVersion += 1;
    specState.specBonuses.push(newBonus);

    // Build stat changes for the email
    const statChanges: SpecReleaseStatChange[] = [];
    for (const key of ENGINE_STAT_KEYS) {
      if (newBonus[key] > 0) {
        statChanges.push({
          stat: key,
          statName: ENGINE_STAT_DISPLAY_NAMES[key],
          improvement: newBonus[key],
        });
      }
    }

    // Build common fields for the event
    const statSummary = statChanges.map((s) => `${s.statName} +${s.improvement}`).join(', ');
    const subject = `${manufacturer.name} releases Spec ${specState.latestSpecVersion}.0`;

    // Check if this affects the player's team
    const affectsPlayer = playerEngineContract?.manufacturerId === manufacturer.id;

    // Create email for player if it affects them, news headline otherwise
    if (affectsPlayer) {
      const data: SpecReleaseData = {
        category: EmailCategory.SpecRelease,
        manufacturerId: manufacturer.id,
        manufacturerName: manufacturer.name,
        newSpecVersion: specState.latestSpecVersion,
        statChanges,
        affectsPlayer: true,
      };

      const body = `${manufacturer.name} has released a new engine specification! ` +
        `Spec ${specState.latestSpecVersion}.0 brings improvements to: ${statSummary}. ` +
        `This upgrade is now available for purchase for your cars.`;

      state.calendarEvents.push({
        id: randomUUID(),
        date: currentDate,
        type: CalendarEventType.Email,
        subject,
        body,
        critical: false, // Not critical - player can continue simulation
        emailCategory: EmailCategory.SpecRelease,
        sender: `${manufacturer.name} Technical Department`,
        data,
      });
    } else {
      // News headline for other manufacturers' spec releases
      const body = `${manufacturer.name} has released a new engine specification. ` +
        `The update brings improvements to: ${statSummary}.`;

      state.calendarEvents.push({
        id: randomUUID(),
        date: currentDate,
        type: CalendarEventType.Headline,
        subject,
        body,
        critical: false,
      });
    }
  }
}

/**
 * Apply turn processing result to game state (mutates state)
 * Returns true if player team had a design milestone or test completion (for auto-stop)
 */
function applyTurnResult(state: GameState, result: TurnProcessingResult): boolean {
  state.currentDate = result.newDate;
  state.phase = result.newPhase;
  applyDriverStateChanges(state, result.driverStateChanges);
  applyTeamStateChanges(state, result.teamStateChanges);

  // Apply design updates and check for player milestones
  const playerHadDesignMilestone = applyDesignUpdates(state, result.designUpdates, result.newDate);

  // Apply testing updates and check for player completions
  const playerHadTestCompletion = applyTestingUpdates(state, result.testingUpdates, result.newDate);

  // Check for pending parts that are ready
  const playerHadReadyPart = checkPendingParts(state, result.newDate);

  // Process manufacturer spec releases
  processSpecReleases(state, result.newDate);

  // Update projected milestone dates based on current progress
  updateProjectedMilestones(state);

  return playerHadDesignMilestone || playerHadTestCompletion || playerHadReadyPart;
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
  const turnResult = engineManager.turn.processDay(turnInput);

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
  const currentWeek = getWeekNumber(state.currentDate);
  const race = state.currentSeason.calendar.find(
    (entry) =>
      entry.weekNumber === currentWeek &&
      !entry.completed &&
      !entry.cancelled
  );

  if (!race) {
    return { error: { success: false, error: 'No race found for current week' } };
  }

  return { race };
}

/**
 * Calculate repair cost for a single driver's race result
 */
function calculateCarRepairCost(
  result: DriverRaceResult,
  driver: Driver,
  carNumber: 1 | 2
): CarRepairCost {
  const wasRetired = result.status === RaceFinishStatus.Retired;
  const incidentCost = wasRetired ? REPAIR_COST_DNF : 0;

  return {
    carNumber,
    driverId: driver.id,
    driverName: `${driver.firstName} ${driver.lastName}`,
    baseCost: REPAIR_COST_BASE,
    incidentCost,
    totalCost: REPAIR_COST_BASE + incidentCost,
    wasRetired,
  };
}

/**
 * Process post-race repairs for all teams after a race.
 * Deducts repair costs and sends email notification to player team.
 */
function processPostRaceRepairs(
  state: GameState,
  raceResult: RaceWeekendResult,
  circuitId: string
): void {
  const circuit = state.circuits.find((c) => c.id === circuitId);
  const circuitName = circuit?.name ?? 'Unknown Circuit';
  const playerTeamId = state.player.teamId;

  // Process each team
  for (const team of state.teams) {
    const teamState = state.teamStates[team.id];
    if (!teamState) continue;

    // Find drivers for this team (car 1 = first driver role, car 2 = second)
    const teamDrivers = state.drivers.filter((d) => d.teamId === team.id && hasRaceSeat(d));
    const car1Driver = teamDrivers.find((d) => d.role === DriverRole.First);
    const car2Driver = teamDrivers.find((d) => d.role === DriverRole.Second);

    if (!car1Driver || !car2Driver) continue;

    // Find race results for each driver
    const car1Result = raceResult.race.find((r) => r.driverId === car1Driver.id);
    const car2Result = raceResult.race.find((r) => r.driverId === car2Driver.id);

    if (!car1Result || !car2Result) continue;

    // Calculate repair costs
    const car1Repair = calculateCarRepairCost(car1Result, car1Driver, 1);
    const car2Repair = calculateCarRepairCost(car2Result, car2Driver, 2);
    const totalCost = car1Repair.totalCost + car2Repair.totalCost;

    // Deduct from team budget
    team.budget -= totalCost;

    // Add to partsLog for both cars
    const repairs = [
      { repair: car1Repair, driver: car1Driver },
      { repair: car2Repair, driver: car2Driver },
    ];

    for (const { repair, driver } of repairs) {
      state.partsLog.push({
        id: randomUUID(),
        date: { ...state.currentDate },
        seasonNumber: state.currentSeason.seasonNumber,
        type: PartsLogEntryType.Repair,
        item: 'Post-Race Repair',
        cost: repair.totalCost,
        driverId: driver.id,
        carNumber: repair.carNumber,
        repairDetails: repair.wasRetired ? 'Race retirement' : 'Routine maintenance',
      });
    }

    // Send email only for player team
    if (team.id === playerTeamId) {
      const emailData: PostRaceRepairData = {
        category: EmailCategory.PostRaceRepair,
        raceNumber: raceResult.raceNumber,
        circuitName,
        car1: car1Repair,
        car2: car2Repair,
        totalCost,
      };

      state.mail.push({
        id: randomUUID(),
        from: 'Finance Department',
        subject: `Post-Race Repair Report - ${circuitName}`,
        body:
          `Race repairs have been completed for both cars after the ${circuitName} Grand Prix.\n\n` +
          `Total cost: $${totalCost.toLocaleString()}`,
        date: { ...state.currentDate },
        read: false,
        category: EmailCategory.PostRaceRepair,
        data: emailData,
      });
    }
  }
}

/**
 * Generate engine analytics data for all teams after a race.
 * Each team gets an estimated power value with ±8% error.
 */
function generateEngineAnalyticsData(state: GameState, raceNumber: number): void {
  for (const team of state.teams) {
    // Get the team's engine contract
    const contract = state.manufacturerContracts.find(
      (c) => c.teamId === team.id && c.type === ManufacturerType.Engine
    );
    if (!contract) continue;

    // Get manufacturer base stats
    const manufacturer = state.manufacturers.find((m) => m.id === contract.manufacturerId);
    if (!manufacturer) continue;

    // Get manufacturer spec state
    const specState = state.manufacturerSpecs.find((s) => s.manufacturerId === manufacturer.id);
    if (!specState) continue;

    // Get team engine state (use car1 as representative - or average both?)
    const teamState = state.teamStates[team.id];
    if (!teamState) continue;

    // Calculate effective stats for car1 (representative)
    const effectiveStats = getEffectiveEngineStats(
      manufacturer.engineStats,
      teamState.engineState.car1Engine.specVersion,
      getSpecBonusesAsEngineStats(specState),
      teamState.engineState.car1Engine.customisation
    );

    // Calculate true power and generate estimated value with error
    const truePower = calculateTruePower(effectiveStats);
    const estimatedPower = generateEstimatedPower(truePower);

    // Find or create analytics entry for this team
    const analyticsIndex = state.engineAnalytics.findIndex((a) => a.teamId === team.id);
    if (analyticsIndex === -1) {
      // Create new entry if not found
      state.engineAnalytics.push({
        teamId: team.id,
        dataPoints: [{ raceNumber, estimatedPower }],
      });
    } else {
      // Add data point to existing entry
      state.engineAnalytics[analyticsIndex].dataPoints.push({
        raceNumber,
        estimatedPower,
      });
    }
  }
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

  // Process post-race repairs for all teams
  processPostRaceRepairs(state, raceResult, currentRace.circuitId);

  // Generate engine analytics data for all teams
  generateEngineAnalyticsData(state, currentRace.raceNumber);
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

  /** Start simulation loop */
  startSimulation,

  /** Stop simulation loop */
  stopSimulation,

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

    // Emit CAREER_STARTED event
    const careerStartedEvent = createEvent({
      type: 'CAREER_STARTED',
      date: gameState.currentDate,
      involvedEntities: [managerRef(), teamRef(teamId)],
      data: { playerName, teamId, seasonNumber },
      importance: 'high',
    });
    gameState.events.push(careerStartedEvent);

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
   * Clears the current game state and stops auto-save/simulation
   */
  clearState(): void {
    stopAutoSave();
    stopSimulation();
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
    const result = findCurrentRace(state);
    if ('error' in result) {
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

  /**
   * Starts work on next year's chassis design.
   * Creates a new ChassisDesign if none exists.
   */
  startNextYearChassis(): GameState {
    const { state, designState } = getPlayerDesignState();

    // Already started
    if (designState.nextYearChassis !== null) {
      return state;
    }

    // Create new chassis design for next season
    const nextSeason = state.currentDate.year + 1;
    designState.nextYearChassis = {
      targetSeason: nextSeason,
      stages: [
        { stage: ChassisDesignStage.Design, progress: 0, completed: false },
        { stage: ChassisDesignStage.CFD, progress: 0, completed: false },
        { stage: ChassisDesignStage.Model, progress: 0, completed: false },
        { stage: ChassisDesignStage.WindTunnel, progress: 0, completed: false },
      ],
      designersAssigned: 0,
      efficiencyRating: 0,
      isLegal: true,
      startedAt: { ...state.currentDate },
      accumulatedWorkUnits: 0,
    };

    return state;
  },

  /**
   * Sets the designer allocation for next year's chassis.
   * @param allocation - Percentage of designers (0-100)
   */
  setNextYearChassisAllocation(allocation: number): GameState {
    const { state, designState } = getPlayerDesignState();

    if (!designState.nextYearChassis) {
      throw new Error('No next year chassis design in progress');
    }

    // Clamp allocation to valid range
    designState.nextYearChassis.designersAssigned = clampPercentage(allocation);

    return state;
  },

  /**
   * Starts a technology design project in Discovery phase.
   * @param component - Which technology component (brakes, gearbox, etc.)
   * @param attribute - Which attribute (performance or reliability)
   */
  startTechProject(component: TechnologyComponent, attribute: TechnologyAttribute): GameState {
    const { state, designState } = getPlayerDesignState();

    // Check if project already exists for this component/attribute
    const existingProject = designState.activeTechnologyProjects.find(
      matchesTechProject(component, attribute)
    );
    if (existingProject) {
      throw new Error(`Project already exists for ${component} ${attribute}`);
    }

    // Create new project in Discovery phase
    const newProject: TechnologyDesignProject = {
      component,
      attribute,
      phase: TechnologyProjectPhase.Discovery,
      designersAssigned: 0,
      startedAt: { ...state.currentDate },
      payoff: null,
      workUnitsRequired: null,
      workUnitsCompleted: 0,
    };

    designState.activeTechnologyProjects.push(newProject);

    return state;
  },

  /**
   * Cancels a technology design project.
   * @param component - Which technology component
   * @param attribute - Which attribute
   */
  cancelTechProject(component: TechnologyComponent, attribute: TechnologyAttribute): GameState {
    const { state, designState } = getPlayerDesignState();

    const projectIndex = designState.activeTechnologyProjects.findIndex(
      matchesTechProject(component, attribute)
    );

    if (projectIndex === -1) {
      throw new Error(`No project found for ${component} ${attribute}`);
    }

    // Remove the project (sunk cost)
    designState.activeTechnologyProjects.splice(projectIndex, 1);

    return state;
  },

  /**
   * Sets the designer allocation for a technology project.
   * @param component - Which technology component
   * @param attribute - Which attribute
   * @param allocation - Percentage of designers (0-100)
   */
  setTechAllocation(
    component: TechnologyComponent,
    attribute: TechnologyAttribute,
    allocation: number
  ): GameState {
    const { state, designState } = getPlayerDesignState();

    const project = designState.activeTechnologyProjects.find(
      matchesTechProject(component, attribute)
    );

    if (!project) {
      throw new Error(`No project found for ${component} ${attribute}`);
    }

    // Clamp allocation to valid range
    project.designersAssigned = clampPercentage(allocation);

    return state;
  },

  /**
   * Sets which handling problem to work on for current year chassis.
   * @param problem - Which handling problem to work on, or null to stop
   */
  setCurrentYearProblem(problem: HandlingProblem | null): GameState {
    const { state, designState } = getPlayerDesignState();

    // If setting a problem, verify it's discovered
    if (problem !== null) {
      const problemState = designState.currentYearChassis.problems.find(
        (p) => p.problem === problem
      );
      if (!problemState) {
        throw new Error(`Unknown handling problem: ${problem}`);
      }
      if (!problemState.discovered) {
        throw new Error(`Handling problem ${problem} has not been discovered yet`);
      }
      if (problemState.solutionDesigned) {
        throw new Error(`Solution for ${problem} has already been designed`);
      }
    }

    designState.currentYearChassis.activeDesignProblem = problem;

    return state;
  },

  /**
   * Sets the designer allocation for current year chassis work.
   * @param allocation - Percentage of designers (0-100)
   */
  setCurrentYearAllocation(allocation: number): GameState {
    const { state, designState } = getPlayerDesignState();

    // Clamp allocation to valid range
    designState.currentYearChassis.designersAssigned = clampPercentage(allocation);

    return state;
  },

  // ==========================================================================
  // TESTING METHODS
  // ==========================================================================

  /**
   * Starts a new development test session.
   * @param driverId - ID of the driver performing the test
   * @param mechanicsAllocated - Percentage of mechanics allocated (0-100)
   */
  startTestSession(driverId: string, mechanicsAllocated: number): GameState {
    const state = GameStateManager.currentState;
    if (!state) {
      throw new Error('No active game');
    }
    const playerTeamId = state.player.teamId;
    const teamState = state.teamStates[playerTeamId];

    teamState.testSession = {
      active: true,
      driverId,
      mechanicsAllocated: clampPercentage(mechanicsAllocated),
      progress: 0,
      accumulatedWorkUnits: 0,
      testsCompleted: teamState.testSession.testsCompleted,
    };

    return state;
  },

  /**
   * Stops the current test session and resets to inactive state.
   * Any progress is lost.
   */
  stopTestSession(): GameState {
    const state = GameStateManager.currentState;
    if (!state) {
      throw new Error('No active game');
    }
    const playerTeamId = state.player.teamId;
    const teamState = state.teamStates[playerTeamId];

    // Preserve testsCompleted count, reset everything else
    const testsCompleted = teamState.testSession.testsCompleted;
    teamState.testSession = {
      active: false,
      driverId: null,
      mechanicsAllocated: 0,
      progress: 0,
      accumulatedWorkUnits: 0,
      testsCompleted,
    };

    return state;
  },

  /**
   * Updates the mechanic allocation for an active test session.
   * @param allocation - New percentage of mechanics allocated (0-100)
   */
  setTestingAllocation(allocation: number): GameState {
    const state = GameStateManager.currentState;
    if (!state) {
      throw new Error('No active game');
    }
    const playerTeamId = state.player.teamId;
    const teamState = state.teamStates[playerTeamId];

    if (teamState.testSession.active) {
      teamState.testSession.mechanicsAllocated = clampPercentage(allocation);
    }

    return state;
  },

  // ===========================================================================
  // PARTS INSTALLATION
  // ===========================================================================

  /**
   * Installs a pending part on the specified car(s).
   * @param pendingPartId - ID of the pending part to install
   * @param choice - Which car(s) to install on: 'car1', 'car2', or 'both'
   */
  installPart(pendingPartId: string, choice: PartInstallationChoice): GameState {
    const state = GameStateManager.currentState;
    if (!state) {
      throw new Error('No active game');
    }

    const playerTeamId = state.player.teamId;
    const teamState = state.teamStates[playerTeamId];
    const pendingPart = teamState.pendingParts.find((p) => p.id === pendingPartId);

    if (!pendingPart) {
      throw new Error(`Pending part not found: ${pendingPartId}`);
    }

    // TODO: In future PRs, this will:
    // 1. Deduct cost from team budget (based on choice)
    // 2. Add PartsLogEntry to partsLog
    // 3. Mark installedOnCars
    // 4. Apply stat improvements to cars
    // 5. Generate DRIVER_UNHAPPY event if override detected

    // For now, just mark which cars got the part (prevent duplicates)
    const carsToInstall: (1 | 2)[] = choice === 'car1' ? [1] : choice === 'car2' ? [2] : [1, 2];
    for (const car of carsToInstall) {
      if (!pendingPart.installedOnCars.includes(car)) {
        pendingPart.installedOnCars.push(car);
      }
    }

    return state;
  },

  // ===========================================================================
  // ENGINE CONTRACTS
  // ===========================================================================

  /**
   * Purchases a fresh engine with the latest spec for a specific car.
   * @param carNumber - Which car to upgrade (1 or 2)
   */
  buyEngineUpgrade(carNumber: 1 | 2): GameState {
    const { state, playerTeam, teamState, manufacturer } = getPlayerEngineContext();

    // Calculate cost (use pre-negotiated if available, otherwise ad-hoc)
    let cost: number;
    if (teamState.engineState.preNegotiatedUpgrades > 0) {
      // Free upgrade from contract bundle
      teamState.engineState.preNegotiatedUpgrades -= 1;
      cost = 0;
    } else {
      // Ad-hoc purchase
      cost = manufacturer.costs.upgrade;
    }

    // Check budget (if cost > 0)
    if (cost > 0 && playerTeam.budget < cost) {
      throw new Error('Insufficient budget for engine upgrade');
    }

    // Deduct cost
    playerTeam.budget -= cost;

    // Upgrade the car's engine to spec 1 (placeholder - spec releases not yet implemented)
    const carEngine = carNumber === 1 ? teamState.engineState.car1Engine : teamState.engineState.car2Engine;
    carEngine.specVersion = 1; // Will be set to latest spec when spec releases are implemented

    return state;
  },

  /**
   * Purchases customisation points for engine tuning.
   * @param quantity - Number of points to purchase
   */
  buyCustomisationPoints(quantity: number): GameState {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    const { state, playerTeam, teamState, manufacturer } = getPlayerEngineContext();

    // Calculate total cost
    const cost = manufacturer.costs.customisationPoint * quantity;

    // Check budget
    if (playerTeam.budget < cost) {
      throw new Error('Insufficient budget for customisation points');
    }

    // Deduct cost and add points
    playerTeam.budget -= cost;
    teamState.engineState.customisationPointsOwned += quantity;

    return state;
  },

  /**
   * Applies customisation tuning to a car's engine.
   * Each stat can be adjusted from -10 to +10 from base.
   * @param carNumber - Which car to customise (1 or 2)
   * @param customisation - The new customisation values for each stat
   */
  applyEngineCustomisation(carNumber: 1 | 2, customisation: EngineCustomisation): GameState {
    const { state, teamState } = getPlayerEngineContext();

    // Validate the customisation is within limits
    if (!isValidCustomisation(customisation, teamState.engineState.customisationPointsOwned)) {
      throw new Error(
        `Invalid customisation: each stat must be between -${MAX_CUSTOMISATION_PER_STAT} and +${MAX_CUSTOMISATION_PER_STAT}, ` +
        `and total adjustments cannot exceed ${teamState.engineState.customisationPointsOwned} points`
      );
    }

    // Apply the customisation to the specified car
    const carEngine = carNumber === 1 ? teamState.engineState.car1Engine : teamState.engineState.car2Engine;
    carEngine.customisation = { ...customisation };

    return state;
  },

  /**
   * Purchases the pre-season optimisation package for next season.
   * Applies a flat bonus to all engine stats for the next year.
   */
  buyEngineOptimisation(): GameState {
    const { state, playerTeam, teamState, manufacturer } = getPlayerEngineContext();

    // Check if already purchased
    if (teamState.engineState.optimisationPurchasedForNextSeason) {
      throw new Error('Optimisation already purchased for next season');
    }

    // Calculate cost
    const cost = manufacturer.costs.optimisation;

    // Check budget
    if (playerTeam.budget < cost) {
      throw new Error('Insufficient budget for optimisation');
    }

    // Deduct cost and mark as purchased
    playerTeam.budget -= cost;
    teamState.engineState.optimisationPurchasedForNextSeason = true;

    return state;
  },

  /**
   * Starts a negotiation with a manufacturer for next season's engine supply.
   */
  startEngineNegotiation(manufacturerId: string): GameState {
    const state = getGameState();
    if (!state) throw new Error('No game in progress');

    const playerTeamId = state.playerTeamId;

    // Check if already negotiating with this manufacturer
    const existing = state.engineNegotiations.find(
      (n) => n.teamId === playerTeamId && n.manufacturerId === manufacturerId
    );
    if (existing) {
      throw new Error('Already negotiating with this manufacturer');
    }

    // Create new negotiation
    const negotiation = createNegotiation(
      playerTeamId,
      manufacturerId,
      state.seasonNumber + 1,
      state.currentDate
    );

    state.engineNegotiations.push(negotiation);

    return state;
  },

  /**
   * Responds to a contract offer (accept, reject, or counter).
   */
  respondToEngineOffer(
    offerId: string,
    response: 'accept' | 'reject' | 'counter',
    counterTerms?: ContractTerms
  ): GameState {
    const state = getGameState();
    if (!state) throw new Error('No game in progress');

    // Find the negotiation by checking for matching offer
    const negotiation = state.engineNegotiations.find((n) =>
      n.offers.some((o) => o.id === offerId)
    );

    if (!negotiation) {
      throw new Error('Negotiation not found');
    }

    const offer = negotiation.offers.find((o) => o.id === offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (response === 'accept') {
      negotiation.status = NegotiationStatus.Accepted;
      // Contract signing will be handled by a separate system
    } else if (response === 'reject') {
      negotiation.status = NegotiationStatus.Rejected;
    } else if (response === 'counter') {
      if (!counterTerms) {
        throw new Error('Counter terms required for counter offer');
      }
      negotiation.status = NegotiationStatus.CounterPending;
      negotiation.playerCounterTerms = counterTerms;
    }

    return state;
  },
};
