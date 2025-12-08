import { CalendarEventType, type CalendarEvent, type GameDate } from '../../shared/domain';
import { daysBetween } from '../../shared/utils/date-utils';

/**
 * Sort calendar events by date (newest first)
 * daysBetween(a, b) returns positive when b > a, giving us descending order
 */
export function sortByDateDescending(a: CalendarEvent, b: CalendarEvent): number {
  return daysBetween(a.date, b.date);
}

/**
 * Filter calendar events by type, only including past/current events, sorted newest first
 */
export function getFilteredCalendarEvents(
  events: CalendarEvent[],
  currentDate: GameDate,
  type: CalendarEventType,
  maxItems: number
): CalendarEvent[] {
  return events
    .filter((e) => e.type === type)
    .filter((e) => daysBetween(e.date, currentDate) >= 0)
    .sort(sortByDateDescending)
    .slice(0, maxItems);
}
