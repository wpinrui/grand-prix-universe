/**
 * IPC Channel Definitions
 *
 * Shared between main and renderer processes.
 * All IPC communication must go through these typed channels.
 */

/** Channel names for IPC communication */
export const IpcChannels = {
  // App lifecycle
  APP_GET_VERSION: 'app:getVersion',
  APP_QUIT: 'app:quit',

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
