/**
 * Shared type guards for domain types
 */

import type { Driver } from './types';
import { DriverRole } from './types';

/**
 * Type guard: driver has a race seat (assigned to a team and not a test driver)
 * Used to filter drivers for race results and championship standings
 */
export function hasRaceSeat(driver: Driver): driver is Driver & { teamId: string } {
  return driver.teamId !== null && driver.role !== DriverRole.Test;
}
