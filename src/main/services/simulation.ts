/**
 * Simulation Module
 *
 * Handles auto-save and simulation tick processing.
 */

import { BrowserWindow } from 'electron';
import { SaveManager } from './save-manager';
import { IpcEvents, type IpcEventPayloads, type SimulationResult } from '../../shared/ipc';
import type { GameState } from '../../shared/domain';
import { GamePhase } from '../../shared/domain';

/** Auto-save interval in milliseconds (5 minutes) */
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

/** Base simulation tick interval in milliseconds (1 day per second) */
const BASE_SIMULATION_TICK_MS = 1000;

/** Simulation acceleration config */
const SIM_WARMUP_DAYS = 7;      // Days at 1x speed before acceleration starts
const SIM_ACCEL_DAYS = 15;      // Days over which we accelerate from 1x to 3x (day 8 to day 22)
const SIM_MAX_SPEED = 3.0;      // Maximum speed multiplier (333ms per tick)

/** Auto-save timer handle */
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

/** Simulation timer handle (using setTimeout for dynamic intervals) */
let simulationTimer: ReturnType<typeof setTimeout> | null = null;

/** Days simulated in current session (for acceleration calculation) */
let simulationDaysCount = 0;

/** Reference to get current state - set by GameStateManager */
let getCurrentStateFn: (() => GameState | null) | null = null;

/** Reference to process a tick - set by GameStateManager */
let processTickFn: ((state: GameState) => import('../../shared/ipc').SimulationTickPayload) | null = null;

/**
 * Initialize simulation module with state getter and tick processor
 */
export function initSimulation(
  getState: () => GameState | null,
  processTick: (state: GameState) => import('../../shared/ipc').SimulationTickPayload
): void {
  getCurrentStateFn = getState;
  processTickFn = processTick;
}

/**
 * Sends a typed event to all renderer windows
 */
export function sendToRenderer<K extends keyof IpcEventPayloads>(
  channel: K,
  payload: IpcEventPayloads[K]
): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(channel, payload);
  }
}

/**
 * Calculate the current simulation speed multiplier based on days simulated.
 * - Days 1-7: 1x speed
 * - Days 8-22: linear increase from 1x to 3x
 * - Days 23+: 3x speed (capped)
 */
export function getSimulationSpeed(daysSimulated: number): number {
  const daysAccelerating = Math.max(0, daysSimulated - SIM_WARMUP_DAYS + 1);
  return Math.min(SIM_MAX_SPEED, 1 + (daysAccelerating * (SIM_MAX_SPEED - 1)) / SIM_ACCEL_DAYS);
}

/**
 * Get the tick interval in ms for the current simulation state
 */
export function getSimulationTickInterval(daysSimulated: number): number {
  const speed = getSimulationSpeed(daysSimulated);
  return Math.round(BASE_SIMULATION_TICK_MS / speed);
}

/**
 * Starts the auto-save timer
 */
export function startAutoSave(getState: () => GameState | null): void {
  stopAutoSave(); // Clear any existing timer
  autoSaveTimer = setInterval(async () => {
    const currentState = getState();
    if (currentState) {
      const result = await SaveManager.autoSave(currentState);
      if (result.skipped) {
        console.log('[AutoSave] Skipped - no changes since last autosave');
      } else if (result.success && result.filename) {
        // Update the state's lastSavedAt timestamp
        if (result.savedAt) {
          currentState.lastSavedAt = result.savedAt;
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
export function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/**
 * Schedules the next simulation tick with dynamic interval based on acceleration
 */
function scheduleNextTick(): void {
  if (!getCurrentStateFn || !processTickFn) return;

  const currentState = getCurrentStateFn();
  if (!currentState || !currentState.simulation.isSimulating) {
    return;
  }

  const interval = getSimulationTickInterval(simulationDaysCount);

  simulationTimer = setTimeout(() => {
    if (!getCurrentStateFn || !processTickFn) return;

    const state = getCurrentStateFn();
    if (!state) {
      stopSimulation();
      return;
    }

    try {
      // Update speed in state for UI display
      state.simulation.speed = getSimulationSpeed(simulationDaysCount);

      const tickPayload = processTickFn(state);
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
export function startSimulation(getState: () => GameState | null): SimulationResult {
  const state = getState();
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
export function stopSimulation(): SimulationResult {
  if (simulationTimer) {
    clearTimeout(simulationTimer);
    simulationTimer = null;
  }

  // Reset days counter
  simulationDaysCount = 0;

  if (getCurrentStateFn) {
    const state = getCurrentStateFn();
    if (state) {
      state.simulation.isSimulating = false;
      state.simulation.speed = 1; // Reset speed display
    }
  }

  return { success: true };
}
