/**
 * Shared utilities for game state management
 */

/** Maximum value for percentage-based stats (morale, fitness, etc.) */
export const MAX_PERCENTAGE = 100;

/**
 * Clamps a value between 0 and MAX_PERCENTAGE (100).
 * Used for all percentage-based stats like morale, fitness, fatigue, etc.
 */
export function clampPercentage(value: number): number {
  return Math.max(0, Math.min(MAX_PERCENTAGE, value));
}

/**
 * Deep clones a value to prevent cache corruption.
 * Entities in GameState will evolve during play - we must not mutate ConfigLoader's cache.
 */
export function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Asserts that an array is not empty, throwing a descriptive error if it is
 */
export function assertNonEmpty<T>(array: T[], entityName: string): void {
  if (array.length === 0) {
    throw new Error(`No ${entityName} found in config data`);
  }
}
