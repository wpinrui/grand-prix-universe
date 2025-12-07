import { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit } from '../../shared/domain';
import {
  getCalendarStripDays,
  getShortDayName,
  getShortMonthName,
  getCountryFlag,
  getRaceSessionForDate,
  getRaceSunday,
  daysBetween,
  type RaceSessionType,
} from '../../shared/utils/date-utils';

/** Create a lookup key from a GameDate */
function dateKey(date: GameDate): string {
  return `${date.year}-${date.month}-${date.day}`;
}

/** Index positions in the 9-day strip */
const PAST_DAY_INDEX = 0;
const CURRENT_DAY_INDEX = 1;

/** Panel configuration */
const PANEL_HEIGHT = 300;

interface SimulationOverlayProps {
  currentDate: GameDate;
  events: CalendarEvent[];
  calendar: CalendarEntry[];
  circuits: Circuit[];
  nextRace: CalendarEntry | null;
  isVisible: boolean;
  isPostSeason: boolean;
}

interface RaceWeekendInfo {
  session: RaceSessionType;
  circuitName: string;
  country: string;
}

interface DayCardProps {
  date: GameDate;
  isCurrent: boolean;
  isPast: boolean;
  showMonth: boolean;
  events: CalendarEvent[];
  raceWeekendInfo: RaceWeekendInfo | null;
}

function DayCard({ date, isCurrent, isPast, showMonth, events, raceWeekendInfo }: DayCardProps) {
  const dayName = getShortDayName(date);
  const monthName = getShortMonthName(date);

  return (
    <div
      className={`
        flex-1 min-w-0 flex flex-col border-r border-[var(--neutral-700)] last:border-r-0
        ${isCurrent ? 'bg-[var(--accent-800)]/30' : ''}
        ${isPast ? 'opacity-50' : ''}
      `}
    >
      {/* Date header */}
      <div className="px-3 py-2 border-b border-[var(--neutral-700)]/50">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-base font-medium ${isCurrent ? 'text-[var(--accent-300)]' : 'text-secondary'}`}>
            {dayName}
          </span>
          <span className={`text-xl font-bold ${isCurrent ? 'text-[var(--accent-200)]' : 'text-primary'}`}>
            {date.day}
          </span>
          {showMonth && (
            <span className="text-sm text-muted ml-1">{monthName}</span>
          )}
        </div>
      </div>

      {/* Content card area */}
      <div className="flex-1 p-2 overflow-hidden">
        <div className="h-full bg-[var(--neutral-800)]/50 rounded border border-[var(--neutral-700)]/30 p-2 overflow-y-auto">
          {/* Race weekend session */}
          {raceWeekendInfo && (
            <div className={`
              mb-2 p-2 rounded text-sm font-medium
              ${raceWeekendInfo.session === 'Race'
                ? 'bg-[var(--accent-700)]/40 text-[var(--accent-200)]'
                : 'bg-[var(--neutral-700)]/40 text-secondary'}
            `}>
              <div className="flex items-center gap-1.5">
                <span className="text-base">{getCountryFlag(raceWeekendInfo.country)}</span>
                <span>{raceWeekendInfo.session}</span>
              </div>
              <div className="text-xs text-muted mt-0.5 truncate">
                {raceWeekendInfo.circuitName}
              </div>
            </div>
          )}

          {/* Calendar events */}
          {events.map((event) => (
            <div
              key={event.id}
              className="mb-1.5 p-1.5 rounded bg-[var(--neutral-700)]/30 text-xs text-muted"
              title={event.subject}
            >
              <span className="truncate block">{event.subject}</span>
            </div>
          ))}

          {/* Empty state */}
          {!raceWeekendInfo && events.length === 0 && (
            <div className="h-full flex items-center justify-center text-xs text-muted/50">
              —
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SimulationOverlay({
  currentDate,
  events,
  calendar,
  circuits,
  nextRace,
  isVisible,
  isPostSeason,
}: SimulationOverlayProps) {
  const days = getCalendarStripDays(currentDate);
  const prevDateRef = useRef<string>(dateKey(currentDate));
  const animationKey = dateKey(currentDate);

  // Track date changes for animation direction
  useEffect(() => {
    prevDateRef.current = animationKey;
  }, [animationKey]);

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

  // Get race weekend info for a date
  const getRaceWeekendInfo = (date: GameDate): RaceWeekendInfo | null => {
    // Check all upcoming races in the calendar
    for (const entry of calendar) {
      if (entry.completed || entry.cancelled) continue;

      const session = getRaceSessionForDate(date, entry.weekNumber);
      if (session) {
        const circuit = circuitsById.get(entry.circuitId);
        if (circuit) {
          return {
            session,
            circuitName: circuit.name,
            country: circuit.country,
          };
        }
      }
    }
    return null;
  };

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

          {/* Calendar panel - positioned at top */}
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
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={animationKey}
                    initial={{ x: '11.11%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '-11.11%', opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="h-full flex"
                  >
                    {days.map((date, index) => (
                      <DayCard
                        key={dateKey(date)}
                        date={date}
                        isCurrent={index === CURRENT_DAY_INDEX}
                        isPast={index === PAST_DAY_INDEX}
                        showMonth={index === PAST_DAY_INDEX || date.day === 1}
                        events={eventsByDate.get(dateKey(date)) ?? []}
                        raceWeekendInfo={getRaceWeekendInfo(date)}
                      />
                    ))}
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
