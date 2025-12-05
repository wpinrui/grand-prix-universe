/**
 * IPC Handlers
 *
 * Register all main process handlers for IPC communication.
 */

import { app, ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import type { NewGameParams } from '../../shared/domain';
import { ConfigLoader } from '../services/config-loader';
import { GameStateManager } from '../services/game-state-manager';
import { SaveManager } from '../services/save-manager';

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

  ipcMain.handle(IpcChannels.CONFIG_GET_SPONSORS, () => {
    return ConfigLoader.getSponsors();
  });

  ipcMain.handle(IpcChannels.CONFIG_GET_MANUFACTURERS, () => {
    return ConfigLoader.getManufacturers();
  });

  ipcMain.handle(IpcChannels.CONFIG_GET_CHIEFS, () => {
    return ConfigLoader.getChiefs();
  });

  ipcMain.handle(IpcChannels.CONFIG_GET_RULES, () => {
    return ConfigLoader.getRules();
  });

  ipcMain.handle(IpcChannels.CONFIG_GET_REGULATIONS, () => {
    return ConfigLoader.getRegulations();
  });

  ipcMain.handle(IpcChannels.CONFIG_GET_REGULATIONS_BY_SEASON, (_event, season: number) => {
    return ConfigLoader.getRegulationsBySeason(season);
  });

  ipcMain.handle(IpcChannels.CONFIG_GET_COMPOUNDS, () => {
    return ConfigLoader.getCompounds();
  });

  // Game state handlers
  ipcMain.handle(IpcChannels.GAME_NEW, (_event, params: NewGameParams) => {
    return GameStateManager.createNewGame(params);
  });

  ipcMain.handle(IpcChannels.GAME_GET_STATE, () => {
    return GameStateManager.getCurrentState();
  });

  // Save/Load handlers
  ipcMain.handle(IpcChannels.GAME_SAVE, async () => {
    const state = GameStateManager.getCurrentState();
    if (!state) {
      return { success: false, error: 'No active game to save' };
    }
    return SaveManager.save(state);
  });

  ipcMain.handle(IpcChannels.GAME_LOAD, async (_event, filename: string) => {
    const result = await SaveManager.load(filename);
    if (result.success && result.state) {
      // Update GameStateManager with loaded state and start auto-save
      GameStateManager.currentState = result.state;
      GameStateManager.startAutoSave();
    }
    return result;
  });

  ipcMain.handle(IpcChannels.GAME_LIST_SAVES, async () => {
    return SaveManager.listSaves();
  });

  ipcMain.handle(IpcChannels.GAME_DELETE_SAVE, async (_event, filename: string) => {
    return SaveManager.deleteSave(filename);
  });
}
