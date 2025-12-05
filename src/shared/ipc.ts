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

// =============================================================================
// SAVE/LOAD TYPES
// =============================================================================

/**
 * Metadata about a save file, used for displaying save slots
 */
export interface SaveSlotInfo {
  filename: string;
  playerName: string;
  teamId: string;
  teamName: string;
  seasonNumber: number;
  weekNumber: number;
  savedAt: string; // ISO date string
  fileSize: number; // bytes
}

/**
 * Result of a save operation
 */
export interface SaveResult {
  success: boolean;
  filename?: string; // Generated filename on success
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

/** Channel names for IPC communication */
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

  // Save/load
  GAME_SAVE: 'game:save',
  GAME_LOAD: 'game:load',
  GAME_LIST_SAVES: 'game:listSaves',
  GAME_DELETE_SAVE: 'game:deleteSave',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

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
}

/** API exposed to renderer via contextBridge */
export interface ElectronAPI {
  invoke<K extends keyof IpcInvokeMap>(
    channel: K,
    ...args: IpcInvokeMap[K]['args']
  ): Promise<IpcInvokeMap[K]['result']>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
