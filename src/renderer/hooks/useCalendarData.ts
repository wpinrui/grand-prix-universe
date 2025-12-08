import { useMemo } from 'react';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit } from '../../shared/domain';
import type { RaceWeekendInfo } from '../components/DayCard';
import {
  dateKey,
  getRaceSessionForDate,
  getRaceSunday,
  daysBetween,
} from '../../shared/utils/date-utils';

interface UseCalendarDataParams {
  days: GameDate[];
  events: CalendarEvent[];
  calendar: CalendarEntry[];
  circuits: Circuit[];
  currentDate: GameDate;
  nextRace: CalendarEntry | null;
  isPostSeason?: boolean;
}

interface CalendarData {
  circuitsById: Map<string, Circuit>;
  eventsByDate: Map<string, CalendarEvent[]>;
  raceWeekendByDate: Map<string, RaceWeekendInfo>;
  footerText: string;
}

/**
 * Shared hook for calendar strip data computation.
 * Used by both SimulationOverlay and CalendarPreviewPanel.
 */
export function useCalendarData({
  days,
  events,
  calendar,
  circuits,
  currentDate,
  nextRace,
  isPostSeason = false,
}: UseCalendarDataParams): CalendarData {
  // Build circuit lookup map
  const circuitsById = useMemo(() => {
    const map = new Map<string, Circuit>();
    for (const circuit of circuits) {
      map.set(circuit.id, circuit);
    }
    return map;
  }, [circuits]);

  // Build events lookup map (multiple events per day possible)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dateKey(event.date);
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  // Build race weekend info lookup map
  const raceWeekendByDate = useMemo(() => {
    const map = new Map<string, RaceWeekendInfo>();

    for (const entry of calendar) {
      if (entry.completed || entry.cancelled) continue;

      const circuit = circuitsById.get(entry.circuitId);
      if (!circuit) continue;

      // Check each day in our strip for this race weekend
      for (const date of days) {
        const session = getRaceSessionForDate(date, entry.weekNumber);
        if (session) {
          map.set(dateKey(date), {
            session,
            circuitName: circuit.name,
            country: circuit.country,
          });
        }
      }
    }

    return map;
  }, [calendar, circuitsById, days]);

  // Calculate footer text
  const footerText = useMemo(() => {
    if (isPostSeason) {
      return 'Simulating post-season...';
    }

    if (!nextRace) {
      return 'No upcoming races';
    }

    const raceSunday = getRaceSunday(currentDate.year, nextRace.weekNumber);
    const daysUntil = daysBetween(currentDate, raceSunday);

    if (daysUntil === 0) {
      return 'Race day!';
    } else if (daysUntil === 1) {
      return '1 day to race';
    } else if (daysUntil > 0) {
      return `${daysUntil} days to next race`;
    } else {
      return 'Race in progress';
    }
  }, [currentDate, nextRace, isPostSeason]);

  return {
    circuitsById,
    eventsByDate,
    raceWeekendByDate,
    footerText,
  };
}
