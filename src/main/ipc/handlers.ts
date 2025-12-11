/**
 * IPC Handlers
 *
 * Register all main process handlers for IPC communication.
 */

import { app, ipcMain, shell } from 'electron';
import * as path from 'path';
import { IpcChannels } from '../../shared/ipc';
import type {
  StartTechProjectParams,
  CancelTechProjectParams,
  SetTechAllocationParams,
  SetCurrentYearProblemParams,
  SetCurrentYearAllocationParams,
  StartTestSessionParams,
  InstallPartParams,
  BuyEngineUpgradeParams,
  BuyCustomisationPointsParams,
  ApplyCustomisationParams,
  StartNegotiationParams,
  RespondToOfferParams,
} from '../../shared/ipc';
import type { NewGameParams, EventQuery } from '../../shared/domain';
import { queryEvents } from '../../shared/domain';
import { ConfigLoader, GameStateManager, SaveManager } from '../services';

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

  ipcMain.handle(IpcChannels.GAME_CLEAR_STATE, () => {
    GameStateManager.clearState();
  });

  ipcMain.handle(IpcChannels.GAME_ADVANCE_WEEK, () => {
    return GameStateManager.advanceWeek();
  });

  ipcMain.handle(IpcChannels.GAME_GO_TO_CIRCUIT, () => {
    return GameStateManager.goToCircuit();
  });

  ipcMain.handle(IpcChannels.GAME_RUN_RACE, () => {
    return GameStateManager.runRace();
  });

  ipcMain.handle(IpcChannels.GAME_NEW_SEASON, () => {
    return GameStateManager.startNewSeason();
  });

  // Simulation control handlers
  ipcMain.handle(IpcChannels.GAME_SIMULATION_START, () => {
    return GameStateManager.startSimulation();
  });

  ipcMain.handle(IpcChannels.GAME_SIMULATION_STOP, () => {
    return GameStateManager.stopSimulation();
  });

  // Save/Load handlers
  ipcMain.handle(IpcChannels.GAME_SAVE, async () => {
    return GameStateManager.saveGame();
  });

  ipcMain.handle(IpcChannels.GAME_LOAD, async (_event, filename: string) => {
    return GameStateManager.loadGame(filename);
  });

  ipcMain.handle(IpcChannels.GAME_LIST_SAVES, async () => {
    return SaveManager.listSaves();
  });

  ipcMain.handle(IpcChannels.GAME_DELETE_SAVE, async (_event, filename: string) => {
    return SaveManager.deleteSave(filename);
  });

  ipcMain.handle(IpcChannels.GAME_OPEN_SAVES_FOLDER, async () => {
    const savesDir = path.join(app.getPath('userData'), 'saves');
    await shell.openPath(savesDir);
  });

  // Events handlers
  ipcMain.handle(IpcChannels.EVENTS_QUERY, (_event, query: EventQuery) => {
    const state = GameStateManager.getCurrentState();
    if (!state) {
      return [];
    }
    return queryEvents(state.events, query);
  });

  // Design handlers
  ipcMain.handle(IpcChannels.DESIGN_START_NEXT_YEAR, () => {
    return GameStateManager.startNextYearChassis();
  });

  ipcMain.handle(IpcChannels.DESIGN_SET_NEXT_YEAR_ALLOCATION, (_event, allocation: number) => {
    return GameStateManager.setNextYearChassisAllocation(allocation);
  });

  ipcMain.handle(
    IpcChannels.DESIGN_START_TECH_PROJECT,
    (_event, params: StartTechProjectParams) => {
      return GameStateManager.startTechProject(params.component, params.attribute);
    }
  );

  ipcMain.handle(
    IpcChannels.DESIGN_CANCEL_TECH_PROJECT,
    (_event, params: CancelTechProjectParams) => {
      return GameStateManager.cancelTechProject(params.component, params.attribute);
    }
  );

  ipcMain.handle(
    IpcChannels.DESIGN_SET_TECH_ALLOCATION,
    (_event, params: SetTechAllocationParams) => {
      return GameStateManager.setTechAllocation(
        params.component,
        params.attribute,
        params.allocation
      );
    }
  );

  ipcMain.handle(
    IpcChannels.DESIGN_SET_CURRENT_YEAR_PROBLEM,
    (_event, params: SetCurrentYearProblemParams) => {
      return GameStateManager.setCurrentYearProblem(params.problem);
    }
  );

  ipcMain.handle(
    IpcChannels.DESIGN_SET_CURRENT_YEAR_ALLOCATION,
    (_event, params: SetCurrentYearAllocationParams) => {
      return GameStateManager.setCurrentYearAllocation(params.allocation);
    }
  );

  // Testing handlers
  ipcMain.handle(IpcChannels.TESTING_START, (_event, params: StartTestSessionParams) => {
    return GameStateManager.startTestSession(params.driverId, params.mechanicsAllocated);
  });

  ipcMain.handle(IpcChannels.TESTING_STOP, () => {
    return GameStateManager.stopTestSession();
  });

  ipcMain.handle(IpcChannels.TESTING_SET_ALLOCATION, (_event, allocation: number) => {
    return GameStateManager.setTestingAllocation(allocation);
  });

  // Parts installation handlers
  ipcMain.handle(IpcChannels.PARTS_INSTALL, (_event, params: InstallPartParams) => {
    return GameStateManager.installPart(params.pendingPartId, params.choice);
  });

  // Engine contract handlers
  ipcMain.handle(IpcChannels.ENGINE_BUY_UPGRADE, (_event, params: BuyEngineUpgradeParams) => {
    return GameStateManager.buyEngineUpgrade(params.carNumber);
  });

  ipcMain.handle(
    IpcChannels.ENGINE_BUY_CUSTOMISATION_POINTS,
    (_event, params: BuyCustomisationPointsParams) => {
      return GameStateManager.buyCustomisationPoints(params.quantity);
    }
  );

  ipcMain.handle(
    IpcChannels.ENGINE_APPLY_CUSTOMISATION,
    (_event, params: ApplyCustomisationParams) => {
      return GameStateManager.applyEngineCustomisation(params.carNumber, params.customisation);
    }
  );

  ipcMain.handle(IpcChannels.ENGINE_BUY_OPTIMISATION, () => {
    return GameStateManager.buyEngineOptimisation();
  });

  // Engine negotiation handlers
  ipcMain.handle(
    IpcChannels.ENGINE_START_NEGOTIATION,
    (_event, params: StartNegotiationParams) => {
      return GameStateManager.startEngineNegotiation(params.manufacturerId);
    }
  );

  ipcMain.handle(IpcChannels.ENGINE_RESPOND_TO_OFFER, (_event, params: RespondToOfferParams) => {
    return GameStateManager.respondToEngineOffer(
      params.negotiationId,
      params.response,
      params.counterTerms,
      params.isUltimatum
    );
  });
}
