import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit } from '../../shared/domain';
import { DayCard } from './DayCard';
import { useCalendarData } from '../hooks';
import { getCalendarStripDaysFromCenter, offsetDate, isSameDay, dateKey } from '../../shared/utils/date-utils';
import { CALENDAR_PANEL_HEIGHT } from '../utils/theme-styles';

/** Scroll sensitivity: higher = more scroll needed to move one day */
const SCROLL_THRESHOLD = 80;

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
  // Accumulated scroll delta for smooth threshold-based scrolling
  const scrollAccumulator = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset view offset and scroll accumulator when panel opens
  useEffect(() => {
    if (isVisible) {
      setViewOffset(0);
      scrollAccumulator.current = 0;
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

  // Scrollwheel handler with threshold-based sensitivity
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    scrollAccumulator.current += e.deltaY;

    // Only move when accumulated scroll exceeds threshold
    if (Math.abs(scrollAccumulator.current) >= SCROLL_THRESHOLD) {
      const steps = Math.trunc(scrollAccumulator.current / SCROLL_THRESHOLD);
      setViewOffset((prev) => prev + steps);
      scrollAccumulator.current = scrollAccumulator.current % SCROLL_THRESHOLD;
    }
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

  // Use shared hook for calendar data
  const { eventsByDate, raceWeekendByDate, footerText } = useCalendarData({
    days,
    events,
    calendar,
    circuits,
    currentDate,
    nextRace,
  });

  // Jump back to today
  const handleJumpToToday = useCallback(() => {
    setViewOffset(0);
    scrollAccumulator.current = 0;
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={panelRef}
          initial={{ y: -CALENDAR_PANEL_HEIGHT, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -CALENDAR_PANEL_HEIGHT, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute top-16 left-0 right-0 z-40 border-b border-[var(--neutral-700)]"
          style={{ height: CALENDAR_PANEL_HEIGHT }}
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
