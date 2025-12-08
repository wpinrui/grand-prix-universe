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
  EntityType,
} from './types';

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
 *   involvedEntities: [
 *     { type: EntityType.Manager, id: 'player' },
 *     { type: EntityType.Team, id: 'ferrari' },
 *   ],
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
  return { type: 'driver' as EntityType, id: driverId };
}

/**
 * Helper to create an EntityRef for a team
 */
export function teamRef(teamId: string): EntityRef {
  return { type: 'team' as EntityType, id: teamId };
}

/**
 * Helper to create an EntityRef for the player manager
 * Uses a fixed ID since there's only one player per game
 */
export function managerRef(): EntityRef {
  return { type: 'manager' as EntityType, id: 'player' };
}

/**
 * Helper to create an EntityRef for a circuit
 */
export function circuitRef(circuitId: string): EntityRef {
  return { type: 'circuit' as EntityType, id: circuitId };
}

/**
 * Helper to create an EntityRef for a sponsor
 */
export function sponsorRef(sponsorId: string): EntityRef {
  return { type: 'sponsor' as EntityType, id: sponsorId };
}

/**
 * Helper to create an EntityRef for a staff member (chief)
 */
export function staffRef(staffId: string): EntityRef {
  return { type: 'staff' as EntityType, id: staffId };
}
