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
  seasonNumber: number;
  weekNumber: number;
  savedAt: string; // ISO date string
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
