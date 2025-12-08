/**
 * Events Infrastructure - Helper functions for creating and working with game events
 *
 * This module provides utilities for the Events System, which is the backbone
 * for historical tracking, news generation, relationship dynamics, and career history.
 *
 * See proposal.md > Events Infrastructure for full documentation.
 */

import { randomUUID } from 'crypto';
import type {
  GameEvent,
  GameEventType,
  EventImportance,
  EntityRef,
  GameDate,
  EventQuery,
} from './types';
import { EntityType } from './types';

/**
 * Fixed ID for the player manager entity.
 * There's only one player per game, so this ID is constant.
 */
export const PLAYER_MANAGER_ID = 'player';

/**
 * Parameters for creating a new game event
 */
export interface CreateEventParams {
  /** Event type - determines the structure of data payload */
  type: GameEventType;

  /** In-game date when event occurred */
  date: GameDate;

  /** All entities involved in this event (for querying) */
  involvedEntities: EntityRef[];

  /** Event-specific payload */
  data: Record<string, unknown>;

  /** Significance level for filtering/display */
  importance: EventImportance;
}

/**
 * Creates a new game event with auto-generated ID and timestamp.
 *
 * @example
 * ```ts
 * const event = createEvent({
 *   type: 'CAREER_STARTED',
 *   date: { year: 2025, month: 1, day: 1 },
 *   involvedEntities: [managerRef(), teamRef('ferrari')],
 *   data: { playerName: 'John Doe', teamId: 'ferrari' },
 *   importance: 'high',
 * });
 * ```
 */
export function createEvent(params: CreateEventParams): GameEvent {
  return {
    id: randomUUID(),
    type: params.type,
    date: params.date,
    involvedEntities: params.involvedEntities,
    data: params.data,
    importance: params.importance,
    createdAt: Date.now(),
  };
}

/**
 * Helper to create an EntityRef for a driver
 */
export function driverRef(driverId: string): EntityRef {
  return { type: EntityType.Driver, id: driverId };
}

/**
 * Helper to create an EntityRef for a team
 */
export function teamRef(teamId: string): EntityRef {
  return { type: EntityType.Team, id: teamId };
}

/**
 * Helper to create an EntityRef for the player manager
 * Uses a fixed ID since there's only one player per game
 */
export function managerRef(): EntityRef {
  return { type: EntityType.Manager, id: PLAYER_MANAGER_ID };
}

/**
 * Helper to create an EntityRef for a circuit
 */
export function circuitRef(circuitId: string): EntityRef {
  return { type: EntityType.Circuit, id: circuitId };
}

/**
 * Helper to create an EntityRef for a sponsor
 */
export function sponsorRef(sponsorId: string): EntityRef {
  return { type: EntityType.Sponsor, id: sponsorId };
}

/**
 * Helper to create an EntityRef for a staff member (chief)
 */
export function staffRef(staffId: string): EntityRef {
  return { type: EntityType.Staff, id: staffId };
}

// =============================================================================
// EVENT QUERYING
// =============================================================================

/**
 * Importance levels ordered from lowest to highest
 * Used for minImportance filtering
 */
const IMPORTANCE_LEVELS: EventImportance[] = ['low', 'medium', 'high'];

/**
 * Compare two GameDates. Returns:
 * - negative if a < b
 * - 0 if a === b
 * - positive if a > b
 */
function compareDates(a: GameDate, b: GameDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Check if a date is within a range (inclusive)
 */
function isDateInRange(
  date: GameDate,
  from: GameDate,
  to: GameDate
): boolean {
  return compareDates(date, from) >= 0 && compareDates(date, to) <= 0;
}

/**
 * Check if an event meets the minimum importance threshold
 */
function meetsImportanceThreshold(
  eventImportance: EventImportance,
  minImportance: EventImportance
): boolean {
  const eventLevel = IMPORTANCE_LEVELS.indexOf(eventImportance);
  const minLevel = IMPORTANCE_LEVELS.indexOf(minImportance);
  return eventLevel >= minLevel;
}

/**
 * Query events from a list based on filter criteria.
 *
 * @param events - The full list of events to search
 * @param query - Filter and pagination options
 * @returns Filtered and sorted list of events
 *
 * @example
 * ```ts
 * // Get all high-importance events for the player
 * const playerEvents = queryEvents(gameState.events, {
 *   entityIds: [PLAYER_MANAGER_ID],
 *   minImportance: 'high',
 *   limit: 50,
 * });
 *
 * // Get recent race events
 * const raceEvents = queryEvents(gameState.events, {
 *   types: ['RACE_FINISH', 'QUALIFYING_RESULT'],
 *   order: 'desc',
 *   limit: 10,
 * });
 * ```
 */
export function queryEvents(
  events: GameEvent[],
  query: EventQuery = {}
): GameEvent[] {
  const {
    entityIds,
    entityTypes,
    types,
    dateRange,
    minImportance,
    limit,
    offset = 0,
    order = 'desc',
  } = query;

  // Filter events
  let result = events.filter((event) => {
    // Filter by entity IDs (OR logic)
    if (entityIds && entityIds.length > 0) {
      const hasMatchingEntity = event.involvedEntities.some((ref) =>
        entityIds.includes(ref.id)
      );
      if (!hasMatchingEntity) return false;
    }

    // Filter by entity types (OR logic)
    if (entityTypes && entityTypes.length > 0) {
      const hasMatchingType = event.involvedEntities.some((ref) =>
        entityTypes.includes(ref.type)
      );
      if (!hasMatchingType) return false;
    }

    // Filter by event types (OR logic)
    if (types && types.length > 0) {
      if (!types.includes(event.type)) return false;
    }

    // Filter by date range
    if (dateRange) {
      if (!isDateInRange(event.date, dateRange.from, dateRange.to)) {
        return false;
      }
    }

    // Filter by minimum importance
    if (minImportance) {
      if (!meetsImportanceThreshold(event.importance, minImportance)) {
        return false;
      }
    }

    return true;
  });

  // Sort by date (then by createdAt for same-day ordering)
  result.sort((a, b) => {
    const dateComparison = compareDates(a.date, b.date);
    if (dateComparison !== 0) {
      return order === 'asc' ? dateComparison : -dateComparison;
    }
    // Same date: sort by createdAt
    return order === 'asc'
      ? a.createdAt - b.createdAt
      : b.createdAt - a.createdAt;
  });

  // Apply pagination
  if (offset > 0) {
    result = result.slice(offset);
  }
  if (limit !== undefined && limit > 0) {
    result = result.slice(0, limit);
  }

  return result;
}
