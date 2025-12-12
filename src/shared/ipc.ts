/**
 * IPC Channel Definitions
 *
 * Shared between main and renderer processes.
 * All IPC communication must go through these typed channels.
 */

import type {
  Team,
  Driver,
  Circuit,
  Sponsor,
  Manufacturer,
  Chief,
  GameRules,
  Regulations,
  SeasonRegulations,
  TyreCompoundConfig,
  GameState,
  NewGameParams,
  GameDate,
  GameEvent,
  EventQuery,
  TechnologyComponent,
  TechnologyAttribute,
  HandlingProblem,
  EngineCustomisation,
  ContractTerms,
  SponsorContractTerms,
} from './domain';
import type { TurnBlocked, DayStopReason } from './domain/engines';

// =============================================================================
// SAVE/LOAD TYPES
// =============================================================================

/**
 * Metadata about a save file, used for displaying save slots
 */
export interface SaveSlotInfo {
  filename: string;
  gameId: string; // Unique playthrough identifier (UUID)
  isAutosave: boolean;
  playerName: string;
  teamId: string;
  teamName: string;
  currentDate: GameDate; // In-game date when saved
  savedAt: string; // Real-world ISO date string when file was saved
  fileSize: number; // bytes
}

/** Sort comparator for SaveSlotInfo: newest savedAt first */
export const compareSavesByNewest = (a: SaveSlotInfo, b: SaveSlotInfo): number =>
  new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();

/**
 * Result of a save operation
 */
export interface SaveResult {
  success: boolean;
  filename?: string; // Generated filename on success
  savedAt?: string; // ISO timestamp of when the save was written
  error?: string; // Error message on failure
}

/**
 * Result of a load operation
 */
export interface LoadResult {
  success: boolean;
  state?: GameState; // Loaded state on success
  error?: string; // Error message on failure
}

// =============================================================================
// ADVANCE WEEK TYPES
// =============================================================================

/**
 * Result of an advance week operation
 * Either succeeds with updated state, or is blocked (e.g., post-season)
 */
export interface AdvanceWeekResult {
  success: boolean;
  state?: GameState; // Updated state on success
  blocked?: TurnBlocked; // Blocking info if advancement was blocked
  error?: string; // Error message on failure
}

/**
 * Result of a new season operation
 * Transitions from PostSeason to PreSeason of next year
 */
export interface NewSeasonResult {
  success: boolean;
  state?: GameState; // Updated state on success
  error?: string; // Error message on failure
}

// =============================================================================
// SIMULATION TYPES
// =============================================================================

/**
 * Result of starting/stopping simulation
 */
export interface SimulationResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// DESIGN TYPES
// =============================================================================

/**
 * Identifies a technology project by component and attribute
 */
export interface TechProjectIdentifier {
  component: TechnologyComponent;
  attribute: TechnologyAttribute;
}

/** Parameters for starting a technology project */
export type StartTechProjectParams = TechProjectIdentifier;

/** Parameters for cancelling a technology project */
export type CancelTechProjectParams = TechProjectIdentifier;

/**
 * Parameters for setting technology project allocation
 */
export interface SetTechAllocationParams extends TechProjectIdentifier {
  allocation: number; // 0-100
}

/**
 * Parameters for setting current year chassis problem to work on
 */
export interface SetCurrentYearProblemParams {
  problem: HandlingProblem | null; // null = stop working on any problem
}

/**
 * Parameters for setting current year chassis allocation
 */
export interface SetCurrentYearAllocationParams {
  allocation: number; // 0-100
}

// =============================================================================
// PARTS INSTALLATION TYPES
// =============================================================================

/**
 * Installation choice for a pending part
 */
export type PartInstallationChoice = 'car1' | 'car2' | 'both';

/**
 * Parameters for installing a pending part
 */
export interface InstallPartParams {
  pendingPartId: string;
  choice: PartInstallationChoice;
}

// =============================================================================
// ENGINE CONTRACTS TYPES
// =============================================================================

/**
 * Parameters for buying an engine upgrade for a specific car
 */
export interface BuyEngineUpgradeParams {
  carNumber: 1 | 2;
}

/**
 * Parameters for buying customisation points
 */
export interface BuyCustomisationPointsParams {
  quantity: number;
}

/**
 * Parameters for applying customisation to a car's engine
 */
export interface ApplyCustomisationParams {
  carNumber: 1 | 2;
  customisation: EngineCustomisation;
}

/**
 * Parameters for starting a negotiation with a manufacturer
 */
export interface StartNegotiationParams {
  manufacturerId: string;
}

/**
 * Response to a contract offer
 */
export type OfferResponse = 'accept' | 'reject' | 'counter';

/**
 * Parameters for responding to a contract offer
 */
export interface RespondToOfferParams {
  negotiationId: string;
  response: OfferResponse;
  counterTerms?: ContractTerms;
  /** If true, marks this as a "take it or leave it" offer */
  isUltimatum?: boolean;
}

// =============================================================================
// SPONSOR NEGOTIATION TYPES
// =============================================================================

/**
 * Parameters for starting a negotiation with a sponsor
 */
export interface StartSponsorNegotiationParams {
  sponsorId: string;
  /** Initial contract terms proposed by the player */
  terms: SponsorContractTerms;
}

/**
 * Parameters for responding to a sponsor offer
 */
export interface RespondToSponsorOfferParams {
  negotiationId: string;
  response: OfferResponse;
  counterTerms?: SponsorContractTerms;
  /** If true, marks this as a "take it or leave it" offer */
  isUltimatum?: boolean;
}

// =============================================================================
// TESTING TYPES
// =============================================================================

/**
 * Parameters for starting a development test session
 */
export interface StartTestSessionParams {
  driverId: string; // Driver to perform the testing
  mechanicsAllocated: number; // 0-100 percentage of mechanic department
}

/**
 * Parameters for updating mechanic allocation on an active test
 */
export interface SetTestAllocationParams {
  mechanicsAllocated: number; // 0-100
}

/**
 * Payload sent on each simulation tick (day advancement)
 * Pushed from main -> renderer via IPC event
 */
export interface SimulationTickPayload {
  state: GameState;
  stopped: boolean; // True if simulation auto-stopped
  stopReason?: DayStopReason; // Why it stopped (if stopped)
}

/** Channel names for IPC invoke calls (renderer -> main) */
export const IpcChannels = {
  // App lifecycle
  APP_GET_VERSION: 'app:getVersion',
  APP_QUIT: 'app:quit',

  // Config/content data
  CONFIG_GET_TEAMS: 'config:getTeams',
  CONFIG_GET_DRIVERS: 'config:getDrivers',
  CONFIG_GET_CIRCUITS: 'config:getCircuits',
  CONFIG_GET_SPONSORS: 'config:getSponsors',
  CONFIG_GET_MANUFACTURERS: 'config:getManufacturers',
  CONFIG_GET_CHIEFS: 'config:getChiefs',
  CONFIG_GET_RULES: 'config:getRules',
  CONFIG_GET_REGULATIONS: 'config:getRegulations',
  CONFIG_GET_REGULATIONS_BY_SEASON: 'config:getRegulationsBySeason',
  CONFIG_GET_COMPOUNDS: 'config:getCompounds',

  // Game state
  GAME_NEW: 'game:new',
  GAME_GET_STATE: 'game:getState',
  GAME_CLEAR_STATE: 'game:clearState',
  GAME_DISMISS_APPOINTMENT_NEWS: 'game:dismissAppointmentNews',
  GAME_ADVANCE_WEEK: 'game:advanceWeek',
  GAME_GO_TO_CIRCUIT: 'game:goToCircuit',
  GAME_RUN_RACE: 'game:runRace',
  GAME_NEW_SEASON: 'game:newSeason',

  // Simulation control
  GAME_SIMULATION_START: 'game:simulationStart',
  GAME_SIMULATION_STOP: 'game:simulationStop',

  // Save/load
  GAME_SAVE: 'game:save',
  GAME_LOAD: 'game:load',
  GAME_LIST_SAVES: 'game:listSaves',
  GAME_DELETE_SAVE: 'game:deleteSave',
  GAME_OPEN_SAVES_FOLDER: 'game:openSavesFolder',

  // Events
  EVENTS_QUERY: 'events:query',

  // Design
  DESIGN_START_NEXT_YEAR: 'design:startNextYear',
  DESIGN_SET_NEXT_YEAR_ALLOCATION: 'design:setNextYearAllocation',
  DESIGN_START_TECH_PROJECT: 'design:startTechProject',
  DESIGN_CANCEL_TECH_PROJECT: 'design:cancelTechProject',
  DESIGN_SET_TECH_ALLOCATION: 'design:setTechAllocation',
  DESIGN_SET_CURRENT_YEAR_PROBLEM: 'design:setCurrentYearProblem',
  DESIGN_SET_CURRENT_YEAR_ALLOCATION: 'design:setCurrentYearAllocation',

  // Testing (Development Testing for handling problem discovery)
  TESTING_START: 'testing:start',
  TESTING_STOP: 'testing:stop',
  TESTING_SET_ALLOCATION: 'testing:setAllocation',

  // Parts Installation
  PARTS_INSTALL: 'parts:install',

  // Engine Contracts
  ENGINE_BUY_UPGRADE: 'engine:buyUpgrade',
  ENGINE_BUY_CUSTOMISATION_POINTS: 'engine:buyCustomisationPoints',
  ENGINE_APPLY_CUSTOMISATION: 'engine:applyCustomisation',
  ENGINE_BUY_OPTIMISATION: 'engine:buyOptimisation',

  // Engine Negotiation
  ENGINE_START_NEGOTIATION: 'engine:startNegotiation',
  ENGINE_RESPOND_TO_OFFER: 'engine:respondToOffer',

  // Sponsor Negotiation
  SPONSOR_START_NEGOTIATION: 'sponsor:startNegotiation',
  SPONSOR_RESPOND_TO_OFFER: 'sponsor:respondToOffer',

  // Mail
  MAIL_MARK_READ: 'mail:markRead',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** Channel names for IPC events (main -> renderer) */
export const IpcEvents = {
  AUTO_SAVE_COMPLETE: 'event:autoSaveComplete',
  SIMULATION_TICK: 'event:simulationTick',
} as const;

export type IpcEvent = (typeof IpcEvents)[keyof typeof IpcEvents];

/** Payload types for IPC events */
export interface IpcEventPayloads {
  [IpcEvents.AUTO_SAVE_COMPLETE]: { filename: string };
  [IpcEvents.SIMULATION_TICK]: SimulationTickPayload;
}

/** Type definitions for IPC invoke calls (renderer -> main) */
export interface IpcInvokeMap {
  [IpcChannels.APP_GET_VERSION]: {
    args: [];
    result: string;
  };
  [IpcChannels.APP_QUIT]: {
    args: [];
    result: void;
  };
  [IpcChannels.CONFIG_GET_TEAMS]: {
    args: [];
    result: Team[];
  };
  [IpcChannels.CONFIG_GET_DRIVERS]: {
    args: [];
    result: Driver[];
  };
  [IpcChannels.CONFIG_GET_CIRCUITS]: {
    args: [];
    result: Circuit[];
  };
  [IpcChannels.CONFIG_GET_SPONSORS]: {
    args: [];
    result: Sponsor[];
  };
  [IpcChannels.CONFIG_GET_MANUFACTURERS]: {
    args: [];
    result: Manufacturer[];
  };
  [IpcChannels.CONFIG_GET_CHIEFS]: {
    args: [];
    result: Chief[];
  };
  [IpcChannels.CONFIG_GET_RULES]: {
    args: [];
    result: GameRules | null;
  };
  [IpcChannels.CONFIG_GET_REGULATIONS]: {
    args: [];
    result: Regulations | null;
  };
  [IpcChannels.CONFIG_GET_REGULATIONS_BY_SEASON]: {
    args: [season: number];
    result: SeasonRegulations | null;
  };
  [IpcChannels.CONFIG_GET_COMPOUNDS]: {
    args: [];
    result: TyreCompoundConfig[];
  };
  [IpcChannels.GAME_NEW]: {
    args: [params: NewGameParams];
    result: GameState;
  };
  [IpcChannels.GAME_GET_STATE]: {
    args: [];
    result: GameState | null;
  };
  [IpcChannels.GAME_CLEAR_STATE]: {
    args: [];
    result: void;
  };
  [IpcChannels.GAME_DISMISS_APPOINTMENT_NEWS]: {
    args: [];
    result: GameState;
  };
  [IpcChannels.GAME_ADVANCE_WEEK]: {
    args: [];
    result: AdvanceWeekResult;
  };
  [IpcChannels.GAME_GO_TO_CIRCUIT]: {
    args: [];
    result: AdvanceWeekResult;
  };
  [IpcChannels.GAME_RUN_RACE]: {
    args: [];
    result: AdvanceWeekResult;
  };
  [IpcChannels.GAME_NEW_SEASON]: {
    args: [];
    result: NewSeasonResult;
  };

  // Simulation control
  [IpcChannels.GAME_SIMULATION_START]: {
    args: [];
    result: SimulationResult;
  };
  [IpcChannels.GAME_SIMULATION_STOP]: {
    args: [];
    result: SimulationResult;
  };

  // Save/load
  [IpcChannels.GAME_SAVE]: {
    args: [];
    result: SaveResult;
  };
  [IpcChannels.GAME_LOAD]: {
    args: [filename: string];
    result: LoadResult;
  };
  [IpcChannels.GAME_LIST_SAVES]: {
    args: [];
    result: SaveSlotInfo[];
  };
  [IpcChannels.GAME_DELETE_SAVE]: {
    args: [filename: string];
    result: boolean;
  };
  [IpcChannels.GAME_OPEN_SAVES_FOLDER]: {
    args: [];
    result: void;
  };

  // Events
  [IpcChannels.EVENTS_QUERY]: {
    args: [query: EventQuery];
    result: GameEvent[];
  };

  // Design
  [IpcChannels.DESIGN_START_NEXT_YEAR]: {
    args: [];
    result: GameState;
  };
  [IpcChannels.DESIGN_SET_NEXT_YEAR_ALLOCATION]: {
    args: [allocation: number];
    result: GameState;
  };
  [IpcChannels.DESIGN_START_TECH_PROJECT]: {
    args: [params: StartTechProjectParams];
    result: GameState;
  };
  [IpcChannels.DESIGN_CANCEL_TECH_PROJECT]: {
    args: [params: CancelTechProjectParams];
    result: GameState;
  };
  [IpcChannels.DESIGN_SET_TECH_ALLOCATION]: {
    args: [params: SetTechAllocationParams];
    result: GameState;
  };
  [IpcChannels.DESIGN_SET_CURRENT_YEAR_PROBLEM]: {
    args: [params: SetCurrentYearProblemParams];
    result: GameState;
  };
  [IpcChannels.DESIGN_SET_CURRENT_YEAR_ALLOCATION]: {
    args: [params: SetCurrentYearAllocationParams];
    result: GameState;
  };

  // Testing (Development Testing)
  [IpcChannels.TESTING_START]: {
    args: [params: StartTestSessionParams];
    result: GameState;
  };
  [IpcChannels.TESTING_STOP]: {
    args: [];
    result: GameState;
  };
  [IpcChannels.TESTING_SET_ALLOCATION]: {
    args: [params: SetTestAllocationParams];
    result: GameState;
  };

  // Parts Installation
  [IpcChannels.PARTS_INSTALL]: {
    args: [params: InstallPartParams];
    result: GameState;
  };

  // Engine Contracts
  [IpcChannels.ENGINE_BUY_UPGRADE]: {
    args: [params: BuyEngineUpgradeParams];
    result: GameState;
  };
  [IpcChannels.ENGINE_BUY_CUSTOMISATION_POINTS]: {
    args: [params: BuyCustomisationPointsParams];
    result: GameState;
  };
  [IpcChannels.ENGINE_APPLY_CUSTOMISATION]: {
    args: [params: ApplyCustomisationParams];
    result: GameState;
  };
  [IpcChannels.ENGINE_BUY_OPTIMISATION]: {
    args: [];
    result: GameState;
  };

  // Engine Negotiation
  [IpcChannels.ENGINE_START_NEGOTIATION]: {
    args: [params: StartNegotiationParams];
    result: GameState;
  };
  [IpcChannels.ENGINE_RESPOND_TO_OFFER]: {
    args: [params: RespondToOfferParams];
    result: GameState;
  };

  // Sponsor Negotiation
  [IpcChannels.SPONSOR_START_NEGOTIATION]: {
    args: [params: StartSponsorNegotiationParams];
    result: GameState;
  };
  [IpcChannels.SPONSOR_RESPOND_TO_OFFER]: {
    args: [params: RespondToSponsorOfferParams];
    result: GameState;
  };

  // Mail
  [IpcChannels.MAIL_MARK_READ]: {
    args: [emailId: string];
    result: GameState;
  };
}

/** API exposed to renderer via contextBridge */
export interface ElectronAPI {
  invoke<K extends keyof IpcInvokeMap>(
    channel: K,
    ...args: IpcInvokeMap[K]['args']
  ): Promise<IpcInvokeMap[K]['result']>;
  on<K extends keyof IpcEventPayloads>(
    channel: K,
    callback: (payload: IpcEventPayloads[K]) => void
  ): () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
