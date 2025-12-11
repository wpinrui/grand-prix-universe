/**
 * Season Transition Module
 *
 * Handles season end processing and new season initialization.
 */

import { ConfigLoader } from './config-loader';
import { clampPercentage } from './state-utils';
import {
  createInitialDriverStandings,
  createInitialConstructorStandings,
} from './game-init';
import type {
  GameState,
  CalendarEntry,
  DriverRuntimeState,
} from '../../shared/domain';
import type {
  SeasonEndInput,
  SeasonEndResult,
  DriverAttributeChange,
  ChiefChange,
} from '../../shared/domain/engines';
import { GamePhase } from '../../shared/domain';
import {
  getPreSeasonStartDate,
  yearToSeason,
} from '../../shared/utils/date-utils';

/**
 * Apply driver attribute changes to game state (mutates state)
 * Used for aging effects (improvement for young, decline for old)
 */
export function applyDriverAttributeChanges(
  state: GameState,
  changes: DriverAttributeChange[]
): void {
  for (const change of changes) {
    const driver = state.drivers.find((d) => d.id === change.driverId);
    if (!driver) continue;

    const currentValue = driver.attributes[change.attribute];
    driver.attributes[change.attribute] = clampPercentage(currentValue + change.change);
  }
}

/**
 * Apply chief changes to game state (mutates state)
 * Handles ability adjustments
 */
export function applyChiefChanges(state: GameState, changes: ChiefChange[]): void {
  for (const change of changes) {
    const chief = state.chiefs.find((c) => c.id === change.chiefId);
    if (!chief) continue;

    if (change.abilityChange !== undefined) {
      chief.ability = clampPercentage(chief.ability + change.abilityChange);
    }
  }
}

/**
 * Mark retired entities by clearing their teamId (makes them free agents)
 * Works for any entity with id and teamId properties (Driver, Chief)
 * In future, could remove from roster entirely or add to "retired" list
 */
export function applyRetirements<T extends { id: string; teamId: string | null }>(
  entities: T[],
  retiredIds: string[]
): void {
  for (const id of retiredIds) {
    const entity = entities.find((e) => e.id === id);
    if (entity) {
      entity.teamId = null;
    }
  }
}

/**
 * Reset driver runtime states for new season
 * Applies partial state overrides (fatigue, fitness, etc.)
 */
export function applyResetDriverStates(
  state: GameState,
  resets: Record<string, Partial<DriverRuntimeState>>
): void {
  for (const [driverId, resetValues] of Object.entries(resets)) {
    const driverState = state.driverStates[driverId];
    if (driverState) {
      Object.assign(driverState, resetValues);
    }
  }
}

/**
 * Build SeasonEndInput from current game state
 */
export function buildSeasonEndInput(state: GameState): SeasonEndInput {
  return {
    drivers: state.drivers,
    teams: state.teams,
    chiefs: state.chiefs,
    driverStates: state.driverStates,
    teamStates: state.teamStates,
    currentSeason: yearToSeason(state.currentDate.year),
    circuits: state.circuits,
  };
}

/**
 * Apply all season end results to game state (mutates state)
 * Note: Does NOT update calendar - that's handled by transitionToNewSeason
 * to avoid polluting the archive with the new calendar
 */
export function applySeasonEndResult(state: GameState, result: SeasonEndResult): void {
  applyDriverAttributeChanges(state, result.driverAttributeChanges);
  applyChiefChanges(state, result.chiefChanges);
  applyRetirements(state.drivers, result.retiredDriverIds);
  applyRetirements(state.chiefs, result.retiredChiefIds);
  applyResetDriverStates(state, result.resetDriverStates);
}

/**
 * Archive current season to pastSeasons and prepare for new season
 */
export function transitionToNewSeason(state: GameState, newCalendar: CalendarEntry[]): void {
  // Archive the completed season
  state.pastSeasons.push({
    seasonNumber: state.currentSeason.seasonNumber,
    calendar: state.currentSeason.calendar,
    driverStandings: state.currentSeason.driverStandings,
    constructorStandings: state.currentSeason.constructorStandings,
    regulations: state.currentSeason.regulations,
  });

  // Increment season number
  const currentSeasonNumber = yearToSeason(state.currentDate.year);
  const newSeasonNumber = currentSeasonNumber + 1;

  // Get regulations for new season (fall back to current if not found)
  const newRegulations =
    ConfigLoader.getRegulationsBySeason(newSeasonNumber) ?? state.currentSeason.regulations;

  // Reset current season data
  state.currentSeason = {
    seasonNumber: newSeasonNumber,
    calendar: newCalendar,
    driverStandings: createInitialDriverStandings(state.drivers),
    constructorStandings: createInitialConstructorStandings(state.teams),
    regulations: newRegulations,
  };

  // Update date to start of new season (January 1st)
  state.currentDate = getPreSeasonStartDate(newSeasonNumber);

  // Set phase to PreSeason
  state.phase = GamePhase.PreSeason;
}
