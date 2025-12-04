/**
 * IPC Handlers
 *
 * Register all main process handlers for IPC communication.
 */

import { app, ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import { ConfigLoader } from '../services/config-loader';

/**
 * Register all IPC handlers.
 * Call this once during app initialization.
 */
export function registerIpcHandlers(): void {
  // App lifecycle handlers
  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IpcChannels.APP_QUIT, () => {
    app.quit();
  });

  // Config/content handlers
  ipcMain.handle(IpcChannels.CONFIG_GET_TEAMS, () => {
    return ConfigLoader.getTeams();
  });

  ipcMain.handle(IpcChannels.CONFIG_GET_DRIVERS, () => {
    return ConfigLoader.getDrivers();
  });

  ipcMain.handle(IpcChannels.CONFIG_GET_CIRCUITS, () => {
    return ConfigLoader.getCircuits();
  });

  // Game handlers (stubs for now)
  ipcMain.handle(IpcChannels.GAME_NEW, (_event, _teamId: string) => {
    // TODO: Implement when GameStateManager exists
    return { success: false };
  });

  ipcMain.handle(IpcChannels.GAME_SAVE, (_event, _slotId: string) => {
    // TODO: Implement when SaveManager exists
    return { success: false };
  });

  ipcMain.handle(IpcChannels.GAME_LOAD, (_event, _slotId: string) => {
    // TODO: Implement when SaveManager exists
    return { success: false };
  });

  ipcMain.handle(IpcChannels.GAME_GET_STATE, () => {
    // TODO: Implement when GameStateManager exists
    return null;
  });
}
