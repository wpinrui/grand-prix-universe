import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit } from '../../shared/domain';
import { DayCard } from './DayCard';
import { useCalendarData } from '../hooks';
import { getCalendarStripDaysFromCenter, offsetDate, isSameDay, dateKey } from '../../shared/utils/date-utils';
import { CALENDAR_PANEL_HEIGHT } from '../utils/theme-styles';

/** Pixels of scroll needed to move one day */
const PIXELS_PER_DAY = 100;

/** Spring config for snapping animation */
const SNAP_SPRING = { stiffness: 300, damping: 30 };

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
  // View offset in whole days from current date
  const [dayOffset, setDayOffset] = useState(0);
  // Scroll accumulator for smooth feel
  const scrollAccumRef = useRef(0);
  // Spring-animated fractional offset (0-1 range, represents progress to next/prev day)
  const scrollFraction = useSpring(0, SNAP_SPRING);
  // Transform scrollFraction to percentage for translateX
  const translateX = useTransform(scrollFraction, (v) => `${-v * (100 / 9)}%`);
  // Timeout for snap-on-scroll-end
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset state when panel opens
  useEffect(() => {
    if (isVisible) {
      setDayOffset(0);
      scrollAccumRef.current = 0;
      scrollFraction.set(0);
    }
  }, [isVisible, scrollFraction]);

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

    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Snap to nearest day when scrolling stops
  const snapToNearestDay = useCallback(() => {
    const currentFraction = scrollFraction.get();
    if (Math.abs(currentFraction) < 0.5) {
      // Snap back to current position
      scrollFraction.set(0);
    } else {
      // Snap to next/prev day
      const direction = currentFraction > 0 ? 1 : -1;
      setDayOffset((prev) => prev + direction);
      scrollFraction.set(0);
    }
    scrollAccumRef.current = 0;
  }, [scrollFraction]);

  // Scrollwheel handler with smooth animation
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      // Clear any pending snap
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
      }

      // Accumulate scroll
      scrollAccumRef.current += e.deltaY;

      // Convert to fractional days
      const fractionDelta = scrollAccumRef.current / PIXELS_PER_DAY;

      // If we've scrolled past a full day, commit that day change
      if (Math.abs(fractionDelta) >= 1) {
        const wholeDays = Math.trunc(fractionDelta);
        setDayOffset((prev) => prev + wholeDays);
        scrollAccumRef.current = scrollAccumRef.current % PIXELS_PER_DAY;
      }

      // Update the visual fraction (clamped to -1 to 1)
      const visualFraction = scrollAccumRef.current / PIXELS_PER_DAY;
      scrollFraction.set(Math.max(-1, Math.min(1, visualFraction)));

      // Schedule snap when scrolling stops
      snapTimeoutRef.current = setTimeout(snapToNearestDay, 150);
    },
    [scrollFraction, snapToNearestDay]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
      }
    };
  }, []);

  // The center date of the strip (current game date + view offset)
  const centerDate = useMemo(() => offsetDate(currentDate, dayOffset), [currentDate, dayOffset]);

  // Get the 9 days to display
  const days = useMemo(() => getCalendarStripDaysFromCenter(centerDate), [centerDate]);

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
    setDayOffset(0);
    scrollAccumRef.current = 0;
    scrollFraction.set(0);
  }, [scrollFraction]);

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
                {dayOffset !== 0 && (
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

            {/* Days strip with smooth scroll */}
            <div className="flex-1 overflow-hidden">
              <motion.div className="h-full flex" style={{ x: translateX }}>
                {days.map((date, index) => {
                  const key = dateKey(date);
                  const isActualCurrentDay = isSameDay(date, currentDate);
                  return (
                    <DayCard
                      key={key}
                      date={date}
                      isCurrent={isActualCurrentDay}
                      isPast={index === 0 && dayOffset === 0}
                      events={eventsByDate.get(key) ?? []}
                      raceWeekendInfo={raceWeekendByDate.get(key) ?? null}
                    />
                  );
                })}
              </motion.div>
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
