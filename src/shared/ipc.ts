/**
 * IPC Channel Definitions
 *
 * Shared between main and renderer processes.
 * All IPC communication must go through these typed channels.
 */

import type { Team, Driver, Circuit, Sponsor, Manufacturer, Chief } from './domain';

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

  // Game state (placeholders for future implementation)
  GAME_NEW: 'game:new',
  GAME_SAVE: 'game:save',
  GAME_LOAD: 'game:load',
  GAME_GET_STATE: 'game:getState',
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
  [IpcChannels.GAME_NEW]: {
    args: [teamId: string];
    result: { success: boolean };
  };
  [IpcChannels.GAME_SAVE]: {
    args: [slotId: string];
    result: { success: boolean };
  };
  [IpcChannels.GAME_LOAD]: {
    args: [slotId: string];
    result: { success: boolean };
  };
  [IpcChannels.GAME_GET_STATE]: {
    args: [];
    result: unknown; // Will be typed properly when GameState is defined
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
