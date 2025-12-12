/**
 * GameStateManager Service
 *
 * Manages the game state lifecycle:
 * - Creating new games
 * - Holding current state in memory
 * - Auto-save functionality
 * - Simulation control
 * - Game actions (design, testing, contracts)
 */

import { ConfigLoader } from './config-loader';
import { SaveManager } from './save-manager';
import { EngineManager } from '../engines/engine-manager';
import { cloneDeep, clampPercentage } from './state-utils';
import {
  validateNewGameParams,
  loadAndCloneEntities,
  buildGameState,
  DEFAULT_STARTING_SEASON,
} from './game-init';
import {
  initSimulation,
  startAutoSave,
  stopAutoSave,
  startSimulation as simStart,
  stopSimulation as simStop,
} from './simulation';
import { processTurn, processSimulationTick } from './turn-processor';
import {
  processRaceWeekend,
  findCurrentRace,
} from './race-processor';
import {
  buildSeasonEndInput,
  applySeasonEndResult,
  transitionToNewSeason,
} from './season-transition';
import {
  createContractFromNegotiation,
  generateContractSigningHeadline,
  createSponsorContractFromNegotiation,
  generateSponsorSigningEvent,
} from './contract-creator';
import type {
  GameState,
  DesignState,
  Team,
  Manufacturer,
  TeamRuntimeState,
  ActiveManufacturerContract,
  ManufacturerNegotiation,
  SponsorNegotiation,
  TechnologyDesignProject,
  EngineCustomisation,
  SponsorContractTerms,
} from '../../shared/domain';
import {
  GamePhase,
  TechnologyComponent,
  TechnologyAttribute,
  TechnologyProjectPhase,
  HandlingProblem,
  ChassisDesignStage,
  ManufacturerType,
  createEvent,
  managerRef,
  teamRef,
} from '../../shared/domain';
import type {
  SaveResult,
  LoadResult,
  AdvanceWeekResult,
  NewSeasonResult,
  SimulationResult,
  PartInstallationChoice,
} from '../../shared/ipc';
import {
  NegotiationPhase,
  StakeholderType,
  type ContractTerms,
} from '../../shared/domain/types';
import {
  isValidCustomisation,
  MAX_CUSTOMISATION_PER_STAT,
  createManufacturerNegotiation,
  createSponsorNegotiation,
  generateBaseContractTerms,
  OFFER_EXPIRY_DAYS,
  LATE_SEASON_MONTH,
} from '../../shared/domain/engine-utils';
import { offsetDate } from '../../shared/utils/date-utils';

/** Shared engine manager instance */
const engineManager = new EngineManager();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
    (c) => c.teamId === playerTeamId && c.type === ManufacturerType.Engine
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

// =============================================================================
// GAME STATE MANAGER
// =============================================================================

/**
 * GameStateManager - Singleton service for managing game state
 */
export const GameStateManager = {
  /** Current game state (null if no game loaded) */
  currentState: null as GameState | null,

  /** Start auto-save (call after loading a game) */
  startAutoSave() {
    startAutoSave(() => GameStateManager.currentState);
  },

  /** Stop auto-save (call when clearing state) */
  stopAutoSave,

  /** Start simulation loop */
  startSimulation(): SimulationResult {
    return simStart(() => GameStateManager.currentState);
  },

  /** Stop simulation loop */
  stopSimulation(): SimulationResult {
    return simStop();
  },

  /**
   * Creates a new game with the given parameters
   */
  createNewGame(params: import('../../shared/domain').NewGameParams): GameState {
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

    // Initialize simulation module
    initSimulation(
      () => GameStateManager.currentState,
      processSimulationTick
    );

    // Start auto-save timer
    GameStateManager.startAutoSave();

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
    simStop();
    GameStateManager.currentState = null;
  },

  /**
   * Dismisses the pending appointment news (player has seen it)
   * Returns the updated game state
   */
  dismissAppointmentNews(): GameState {
    const state = GameStateManager.currentState;
    if (!state) {
      throw new Error('No active game');
    }
    state.pendingAppointmentNews = null;
    return cloneDeep(state);
  },

  /**
   * Mark an email as read.
   * Returns the updated game state
   */
  markEmailRead(emailId: string): GameState {
    const state = GameStateManager.currentState;
    if (!state) {
      throw new Error('No active game');
    }
    const email = state.calendarEvents.find((e) => e.id === emailId);
    if (email) {
      email.read = true;
    }
    return cloneDeep(state);
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

      // Initialize simulation module
      initSimulation(
        () => GameStateManager.currentState,
        processSimulationTick
      );

      GameStateManager.startAutoSave();
    }
    return result;
  },

  /**
   * Starts a new season after post-season is complete.
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

  // ==========================================================================
  // DESIGN METHODS
  // ==========================================================================

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
    const state = GameStateManager.currentState;
    if (!state) throw new Error('No game in progress');

    const playerTeamId = state.player.teamId;

    // Check if already negotiating with this manufacturer
    const existing = state.negotiations.find(
      (n) =>
        n.stakeholderType === StakeholderType.Manufacturer &&
        n.teamId === playerTeamId &&
        (n as ManufacturerNegotiation).manufacturerId === manufacturerId &&
        n.phase !== NegotiationPhase.Completed &&
        n.phase !== NegotiationPhase.Failed
    );
    if (existing) {
      throw new Error('Already negotiating with this manufacturer');
    }

    // Get manufacturer for generating initial terms
    const manufacturer = state.manufacturers.find((m) => m.id === manufacturerId);
    if (!manufacturer) {
      throw new Error('Manufacturer not found');
    }

    // Generate initial offer terms based on manufacturer pricing
    // Desperation: 0 for initial player offer (we don't know their desperation yet)
    // Late season: Check if we're negotiating in the final months
    const isLateSeason = state.currentDate.month >= LATE_SEASON_MONTH;
    const initialTerms = generateBaseContractTerms(manufacturer, 0, isLateSeason);

    // Create new negotiation
    const negotiation = createManufacturerNegotiation(
      playerTeamId,
      manufacturerId,
      state.currentSeason.seasonNumber + 1,
      state.currentDate,
      initialTerms
    );

    state.negotiations.push(negotiation);

    return state;
  },

  /**
   * Responds to a contract offer (accept, reject, or counter).
   * Works with the generic rounds-based negotiation system.
   *
   * @param negotiationId - ID of the negotiation to respond to
   * @param response - Player's response: accept, reject, or counter
   * @param counterTerms - Required for counter offers
   * @param isUltimatum - If true, marks this as a "take it or leave it" offer
   */
  respondToEngineOffer(
    negotiationId: string,
    response: 'accept' | 'reject' | 'counter',
    counterTerms?: ContractTerms,
    isUltimatum?: boolean
  ): GameState {
    const state = GameStateManager.currentState;
    if (!state) throw new Error('No game in progress');

    // Find the negotiation by ID
    const negotiationIndex = state.negotiations.findIndex((n) => n.id === negotiationId);
    if (negotiationIndex === -1) {
      throw new Error('Negotiation not found');
    }

    const negotiation = state.negotiations[negotiationIndex] as ManufacturerNegotiation;

    // Ensure it's a manufacturer negotiation in response-received phase
    if (negotiation.stakeholderType !== StakeholderType.Manufacturer) {
      throw new Error('Not a manufacturer negotiation');
    }

    if (response === 'accept') {
      // Accept the counterparty's terms - negotiation complete
      negotiation.phase = NegotiationPhase.Completed;
      negotiation.lastActivityDate = { ...state.currentDate };

      // Create the contract and generate news headline
      const result = createContractFromNegotiation(negotiation, state);
      generateContractSigningHeadline(
        state,
        result,
        negotiation.teamId,
        negotiation.manufacturerId
      );
    } else if (response === 'reject') {
      // Reject - negotiation failed
      negotiation.phase = NegotiationPhase.Failed;
      negotiation.lastActivityDate = { ...state.currentDate };
    } else if (response === 'counter') {
      // Counter with new terms - add a new round
      if (!counterTerms) {
        throw new Error('Counter terms required for counter offer');
      }

      const expiresDate = offsetDate(state.currentDate, OFFER_EXPIRY_DAYS);
      const newRound = {
        roundNumber: negotiation.currentRound + 1,
        offeredBy: 'player' as const,
        terms: counterTerms,
        offeredDate: { ...state.currentDate },
        expiresDate,
        isUltimatum,
      };

      negotiation.rounds.push(newRound);
      negotiation.currentRound = newRound.roundNumber;
      negotiation.phase = NegotiationPhase.AwaitingResponse;
      negotiation.lastActivityDate = { ...state.currentDate };
    }

    return state;
  },

  // ===========================================================================
  // SPONSOR NEGOTIATION
  // ===========================================================================

  /**
   * Starts a new negotiation with a sponsor.
   * Player initiates contact with proposed terms.
   */
  startSponsorNegotiation(sponsorId: string, terms: SponsorContractTerms): GameState {
    const state = GameStateManager.currentState;
    if (!state) throw new Error('No game in progress');

    const playerTeamId = state.player.teamId;

    // Check if already negotiating with this sponsor
    const existing = state.negotiations.find(
      (n) =>
        n.stakeholderType === StakeholderType.Sponsor &&
        n.teamId === playerTeamId &&
        (n as SponsorNegotiation).sponsorId === sponsorId &&
        n.phase !== NegotiationPhase.Completed &&
        n.phase !== NegotiationPhase.Failed
    );
    if (existing) {
      throw new Error('Already negotiating with this sponsor');
    }

    // Verify sponsor exists
    const sponsor = state.sponsors.find((s) => s.id === sponsorId);
    if (!sponsor) {
      throw new Error('Sponsor not found');
    }

    // Create new negotiation for next season
    const negotiation = createSponsorNegotiation(
      playerTeamId,
      sponsorId,
      state.currentSeason.seasonNumber + 1,
      state.currentDate,
      terms
    );

    state.negotiations.push(negotiation);

    return state;
  },

  /**
   * Responds to a sponsor offer (accept, reject, or counter).
   */
  respondToSponsorOffer(
    negotiationId: string,
    response: 'accept' | 'reject' | 'counter',
    counterTerms?: SponsorContractTerms,
    isUltimatum?: boolean
  ): GameState {
    const state = GameStateManager.currentState;
    if (!state) throw new Error('No game in progress');

    // Find the negotiation by ID
    const negotiationIndex = state.negotiations.findIndex((n) => n.id === negotiationId);
    if (negotiationIndex === -1) {
      throw new Error('Negotiation not found');
    }

    const negotiation = state.negotiations[negotiationIndex] as SponsorNegotiation;

    // Ensure it's a sponsor negotiation
    if (negotiation.stakeholderType !== StakeholderType.Sponsor) {
      throw new Error('Not a sponsor negotiation');
    }

    if (response === 'accept') {
      // Accept the counterparty's terms - negotiation complete
      negotiation.phase = NegotiationPhase.Completed;
      negotiation.lastActivityDate = { ...state.currentDate };

      // Create the contract and generate signing event
      const result = createSponsorContractFromNegotiation(negotiation, state);
      if (result) {
        generateSponsorSigningEvent(state, result, true); // Player team is always involved
      }
    } else if (response === 'reject') {
      // Reject - negotiation failed
      negotiation.phase = NegotiationPhase.Failed;
      negotiation.lastActivityDate = { ...state.currentDate };
    } else if (response === 'counter') {
      // Counter with new terms - add a new round
      if (!counterTerms) {
        throw new Error('Counter terms required for counter offer');
      }

      const expiresDate = offsetDate(state.currentDate, OFFER_EXPIRY_DAYS);
      const newRound = {
        roundNumber: negotiation.currentRound + 1,
        offeredBy: 'player' as const,
        terms: counterTerms,
        offeredDate: { ...state.currentDate },
        expiresDate,
        isUltimatum,
      };

      negotiation.rounds.push(newRound);
      negotiation.currentRound = newRound.roundNumber;
      negotiation.phase = NegotiationPhase.AwaitingResponse;
      negotiation.lastActivityDate = { ...state.currentDate };
    }

    return state;
  },
};
