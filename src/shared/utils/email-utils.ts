import type { CalendarEvent, GameState } from '../domain/types';
import { CalendarEventType } from '../domain/types';

/**
 * Compare two GameDate objects for sorting (ascending order)
 */
function compareDates(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date.year !== b.date.year) return a.date.year - b.date.year;
  if (a.date.month !== b.date.month) return a.date.month - b.date.month;
  return a.date.day - b.date.day;
}

/**
 * Get all unread emails sorted by date (oldest first)
 */
export function getUnreadEmails(calendarEvents: CalendarEvent[]): CalendarEvent[] {
  return calendarEvents
    .filter((e) => e.type === CalendarEventType.Email && !e.read)
    .sort(compareDates);
}

/**
 * Get the oldest unread email
 */
export function getOldestUnreadEmail(calendarEvents: CalendarEvent[]): CalendarEvent | null {
  const unread = getUnreadEmails(calendarEvents);
  return unread.length > 0 ? unread[0] : null;
}

/**
 * Check if an email still requires a response based on game state.
 * Each mustRespond email category has its own response-checking logic.
 */
export function isEmailResponseRequired(email: CalendarEvent, _gameState: GameState): boolean {
  if (!email.mustRespond) return false;

  // Future: Add category-specific response checking here
  // Example for negotiations:
  // case EmailCategory.NegotiationResponse: {
  //   const negotiationId = email.data?.negotiationId;
  //   const negotiation = gameState.negotiations.find((n) => n.id === negotiationId);
  //   return negotiation?.phase === NegotiationPhase.ResponseReceived;
  // }

  // Default: if mustRespond is set but no category-specific check exists,
  // consider it still requiring response
  return true;
}

/**
 * Get all must-respond emails that haven't been satisfied yet, sorted by date (oldest first)
 */
export function getUnrespondedMustRespondEmails(
  calendarEvents: CalendarEvent[],
  gameState: GameState
): CalendarEvent[] {
  return calendarEvents
    .filter((e) => e.type === CalendarEventType.Email && isEmailResponseRequired(e, gameState))
    .sort(compareDates);
}

/**
 * Get the oldest must-respond email that hasn't been satisfied
 */
export function getOldestMustRespondEmail(
  calendarEvents: CalendarEvent[],
  gameState: GameState
): CalendarEvent | null {
  const mustRespond = getUnrespondedMustRespondEmails(calendarEvents, gameState);
  return mustRespond.length > 0 ? mustRespond[0] : null;
}

/**
 * Check if time advancement is blocked by must-respond emails
 */
export function isTimeAdvancementBlocked(
  calendarEvents: CalendarEvent[],
  gameState: GameState
): boolean {
  return getUnrespondedMustRespondEmails(calendarEvents, gameState).length > 0;
}
