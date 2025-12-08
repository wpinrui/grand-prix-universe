import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit, Team } from '../../shared/domain';
import { TopBar } from './TopBar';
import { DayCard, type RaceWeekendInfo } from './DayCard';
import {
  getCalendarStripDays,
  getRaceSessionForDate,
  getRaceSunday,
  daysBetween,
} from '../../shared/utils/date-utils';

/** Create a lookup key from a GameDate */
function dateKey(date: GameDate): string {
  return `${date.year}-${date.month}-${date.day}`;
}

/** Index positions in the 9-day strip */
const PAST_DAY_INDEX = 0;
const CURRENT_DAY_INDEX = 1;
const TOTAL_DAYS = 9;

/** Panel configuration */
const PANEL_HEIGHT = 300;

/** Slide animation offset (1/9 of width as percentage) */
const SLIDE_OFFSET_PERCENT = `${(100 / TOTAL_DAYS).toFixed(2)}%`;

interface SimulationOverlayProps {
  currentDate: GameDate;
  events: CalendarEvent[];
  calendar: CalendarEntry[];
  circuits: Circuit[];
  nextRace: CalendarEntry | null;
  isVisible: boolean;
  isPostSeason: boolean;
  // TopBar props
  sectionLabel: string;
  subItemLabel: string;
  playerTeam: Team | null;
}

export function SimulationOverlay({
  currentDate,
  events,
  calendar,
  circuits,
  nextRace,
  isVisible,
  isPostSeason,
  sectionLabel,
  subItemLabel,
  playerTeam,
}: SimulationOverlayProps) {
  const animationKey = dateKey(currentDate);

  // Memoize days to prevent unnecessary recalculations of dependent useMemo hooks
  const days = useMemo(
    () => getCalendarStripDays(currentDate),
    [currentDate.year, currentDate.month, currentDate.day]
  );

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

  // Build race weekend info lookup map (memoized for O(1) access per day)
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

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col"
        >
          {/* Blurred backdrop */}
          <div className="absolute inset-0 bg-[var(--neutral-950)]/80 backdrop-blur-sm" />

          {/* TopBar with stop button */}
          <div className="relative z-10">
            <TopBar
              sectionLabel={sectionLabel}
              subItemLabel={subItemLabel}
              currentDate={currentDate}
              playerTeam={playerTeam}
            />
          </div>

          {/* Calendar panel - positioned below TopBar */}
          <motion.div
            initial={{ y: -PANEL_HEIGHT, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -PANEL_HEIGHT, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative z-10 border-b border-[var(--neutral-700)]"
            style={{ height: PANEL_HEIGHT }}
          >
            {/* Panel background */}
            <div className="absolute inset-0 bg-[var(--neutral-900)]" />

            {/* Panel content */}
            <div className="relative h-full flex flex-col">
              {/* Days strip with sliding animation */}
              <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="sync" initial={false}>
                  <motion.div
                    key={animationKey}
                    initial={{ x: SLIDE_OFFSET_PERCENT, opacity: 0.5 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="h-full flex"
                  >
                    {days.map((date, index) => {
                      const key = dateKey(date);
                      return (
                        <DayCard
                          key={key}
                          date={date}
                          isCurrent={index === CURRENT_DAY_INDEX}
                          isPast={index === PAST_DAY_INDEX}
                          events={eventsByDate.get(key) ?? []}
                          raceWeekendInfo={raceWeekendByDate.get(key) ?? null}
                        />
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-[var(--neutral-700)] bg-[var(--neutral-850)]">
                <div className="text-sm text-secondary text-center">
                  {footerText}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
