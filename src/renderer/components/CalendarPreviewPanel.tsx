import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit } from '../../shared/domain';
import { DayCard } from './DayCard';
import { useCalendarData } from '../hooks';
import { offsetDate, isSameDay, dateKey } from '../../shared/utils/date-utils';
import { CALENDAR_PANEL_HEIGHT } from '../utils/theme-styles';

/** Number of visible days */
const VISIBLE_DAYS = 9;
/** Extra days rendered on each side for smooth scrolling */
const BUFFER_DAYS = 2;
/** Total days rendered */
const TOTAL_DAYS = VISIBLE_DAYS + BUFFER_DAYS * 2; // 13 days
/** Width of one day as percentage of visible area */
const DAY_WIDTH_PERCENT = 100 / VISIBLE_DAYS;
/** Pixels of scroll needed to move one day */
const PIXELS_PER_DAY = 100;
/** Spring config for snapping animation */
const SNAP_SPRING = { stiffness: 400, damping: 35 };

/**
 * Get array of days centered on a date with buffer on each side.
 * Returns TOTAL_DAYS days: BUFFER_DAYS before, VISIBLE_DAYS centered, BUFFER_DAYS after
 */
function getExtendedDays(centerDate: GameDate): GameDate[] {
  const days: GameDate[] = [];
  // Start from (BUFFER_DAYS + half of visible - 1) days before center
  // For 9 visible with index 1 as "current", we want centerDate at index BUFFER_DAYS + 1
  const startOffset = -(BUFFER_DAYS + 1); // -3 for buffer=2

  let date = offsetDate(centerDate, startOffset);
  for (let i = 0; i < TOTAL_DAYS; i++) {
    days.push(date);
    date = offsetDate(date, 1);
  }
  return days;
}

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
  // Accumulated scroll in pixels
  const scrollPixelsRef = useRef(0);
  // Spring for smooth visual offset (in day units, can be fractional)
  const visualOffset = useSpring(0, SNAP_SPRING);
  // Transform to CSS translateX (accounting for buffer offset)
  const translateX = useTransform(
    visualOffset,
    (v) => `${-(BUFFER_DAYS + v) * DAY_WIDTH_PERCENT}%`
  );
  // Snap timeout
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset state when panel opens
  useEffect(() => {
    if (isVisible) {
      setDayOffset(0);
      scrollPixelsRef.current = 0;
      visualOffset.jump(0);
    }
  }, [isVisible, visualOffset]);

  // Close on Escape key
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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

  // Commit scroll and reset visual offset
  const commitScroll = useCallback(
    (days: number) => {
      if (days !== 0) {
        setDayOffset((prev) => prev + days);
        // Jump visual offset back by the committed amount so position stays continuous
        visualOffset.jump(visualOffset.get() - days);
      }
      scrollPixelsRef.current = 0;
    },
    [visualOffset]
  );

  // Snap to nearest whole day
  const snapToNearest = useCallback(() => {
    const current = visualOffset.get();
    const nearest = Math.round(current);
    // Commit the whole days and animate to 0
    commitScroll(nearest);
    visualOffset.set(0);
  }, [visualOffset, commitScroll]);

  // Scrollwheel handler
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      // Clear pending snap
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
      }

      // Accumulate scroll
      scrollPixelsRef.current += e.deltaY;
      const daysDelta = scrollPixelsRef.current / PIXELS_PER_DAY;

      // Update visual offset (smooth)
      visualOffset.set(daysDelta);

      // If scrolled past buffer, commit some days to keep content available
      if (Math.abs(daysDelta) >= BUFFER_DAYS) {
        const toCommit = Math.trunc(daysDelta);
        commitScroll(toCommit);
      }

      // Schedule snap when scrolling stops
      snapTimeoutRef.current = setTimeout(snapToNearest, 150);
    },
    [visualOffset, commitScroll, snapToNearest]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    };
  }, []);

  // Center date for the days array
  const centerDate = useMemo(() => offsetDate(currentDate, dayOffset), [currentDate, dayOffset]);

  // Extended days array (13 days for smooth scrolling)
  const days = useMemo(() => getExtendedDays(centerDate), [centerDate]);

  // Calendar data hook
  const { eventsByDate, raceWeekendByDate, footerText } = useCalendarData({
    days,
    events,
    calendar,
    circuits,
    currentDate,
    nextRace,
  });

  // Jump to today
  const handleJumpToToday = useCallback(() => {
    setDayOffset(0);
    scrollPixelsRef.current = 0;
    visualOffset.set(0);
  }, [visualOffset]);

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
          <div className="absolute inset-0 bg-[var(--neutral-900)]" />

          <div className="relative h-full flex flex-col">
            {/* Header */}
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

            {/* Days strip - wider than container, translated to show correct portion */}
            <div className="flex-1 overflow-hidden">
              <motion.div
                className="h-full flex"
                style={{
                  width: `${(TOTAL_DAYS / VISIBLE_DAYS) * 100}%`,
                  x: translateX,
                }}
              >
                {days.map((date) => {
                  const key = dateKey(date);
                  const isActualCurrentDay = isSameDay(date, currentDate);
                  return (
                    <DayCard
                      key={key}
                      date={date}
                      isCurrent={isActualCurrentDay}
                      isPast={false}
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
