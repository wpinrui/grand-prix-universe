import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit } from '../../shared/domain';
import { DayCard, type RaceWeekendInfo } from './DayCard';
import {
  getCalendarStripDaysFromCenter,
  offsetDate,
  getRaceSessionForDate,
  getRaceSunday,
  daysBetween,
  isSameDay,
} from '../../shared/utils/date-utils';

/** Create a lookup key from a GameDate */
function dateKey(date: GameDate): string {
  return `${date.year}-${date.month}-${date.day}`;
}

/** Panel configuration */
const PANEL_HEIGHT = 300;

interface CalendarPreviewPanelProps {
  currentDate: GameDate;
  events: CalendarEvent[];
  calendar: CalendarEntry[];
  circuits: Circuit[];
  nextRace: CalendarEntry | null;
  isVisible: boolean;
  onClose: () => void;
  onExpandToMonth?: () => void;
}

export function CalendarPreviewPanel({
  currentDate,
  events,
  calendar,
  circuits,
  nextRace,
  isVisible,
  onClose,
  onExpandToMonth,
}: CalendarPreviewPanelProps) {
  // View offset: how many days shifted from current date (positive = future)
  const [viewOffset, setViewOffset] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset view offset when panel opens
  useEffect(() => {
    if (isVisible) {
      setViewOffset(0);
    }
  }, [isVisible]);

  // Close on Escape key
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate close from the opening click
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Scrollwheel handler to shift days
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    // Scroll down (positive deltaY) = move to future days
    const direction = e.deltaY > 0 ? 1 : -1;
    setViewOffset((prev) => prev + direction);
  }, []);

  // The center date of the strip (current game date + view offset)
  const centerDate = useMemo(
    () => offsetDate(currentDate, viewOffset),
    [currentDate, viewOffset]
  );

  // Get the 9 days to display
  const days = useMemo(
    () => getCalendarStripDaysFromCenter(centerDate),
    [centerDate]
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
  }, [currentDate, nextRace]);

  // Jump back to today
  const handleJumpToToday = useCallback(() => {
    setViewOffset(0);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={panelRef}
          initial={{ y: -PANEL_HEIGHT, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -PANEL_HEIGHT, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute top-16 left-0 right-0 z-40 border-b border-[var(--neutral-700)]"
          style={{ height: PANEL_HEIGHT }}
          onWheel={handleWheel}
        >
          {/* Panel background */}
          <div className="absolute inset-0 bg-[var(--neutral-900)]" />

          {/* Panel content */}
          <div className="relative h-full flex flex-col">
            {/* Header with controls */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--neutral-700)]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-secondary">Calendar Preview</span>
                {viewOffset !== 0 && (
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="text-xs text-[var(--accent-400)] hover:text-[var(--accent-300)] underline"
                  >
                    Jump to today
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {onExpandToMonth && (
                  <button
                    type="button"
                    onClick={onExpandToMonth}
                    className="p-1.5 rounded hover:bg-[var(--neutral-700)] text-secondary hover:text-primary transition-colors"
                    title="Expand to month view"
                  >
                    <Maximize2 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded hover:bg-[var(--neutral-700)] text-secondary hover:text-primary transition-colors"
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Days strip */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full flex">
                {days.map((date, index) => {
                  const key = dateKey(date);
                  const isActualCurrentDay = isSameDay(date, currentDate);
                  return (
                    <DayCard
                      key={key}
                      date={date}
                      isCurrent={isActualCurrentDay}
                      isPast={index === 0 && viewOffset === 0}
                      events={eventsByDate.get(key) ?? []}
                      raceWeekendInfo={raceWeekendByDate.get(key) ?? null}
                    />
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-[var(--neutral-700)] bg-[var(--neutral-850)]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Scroll to navigate days</span>
                <span className="text-sm text-secondary">{footerText}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
