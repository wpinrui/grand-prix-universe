import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit } from '../../shared/domain';
import { DayCard } from './DayCard';
import { useCalendarData } from '../hooks';
import { offsetDate, isSameDay, dateKey } from '../../shared/utils/date-utils';
import { CALENDAR_PANEL_HEIGHT } from '../utils/theme-styles';

/** Number of visible days */
const VISIBLE_DAYS = 9;
/** Extra days rendered on each side for smooth scrolling */
const BUFFER_DAYS = 3;
/** Total days rendered */
const TOTAL_DAYS = VISIBLE_DAYS + BUFFER_DAYS * 2;
/** Width of one day as percentage of visible area */
const DAY_WIDTH_PERCENT = 100 / VISIBLE_DAYS;
/** Pixels of scroll needed to move one day */
const PIXELS_PER_DAY = 80;

/**
 * Get extended array of days for smooth scrolling
 */
function getExtendedDays(centerDate: GameDate): GameDate[] {
  const days: GameDate[] = [];
  const startOffset = -(BUFFER_DAYS + 1);
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
  // Day offset (whole days from current date)
  const [dayOffset, setDayOffset] = useState(0);
  // Visual offset in pixels for smooth scrolling
  const [pixelOffset, setPixelOffset] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset when panel opens
  useEffect(() => {
    if (isVisible) {
      setDayOffset(0);
      setPixelOffset(0);
    }
  }, [isVisible]);

  // Close on Escape
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

  // Scrollwheel - pure smooth scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    setPixelOffset((prev) => {
      const newOffset = prev + e.deltaY;
      const daysDelta = Math.trunc(newOffset / PIXELS_PER_DAY);

      // If we've scrolled enough to shift days, commit that
      if (Math.abs(daysDelta) >= 1) {
        setDayOffset((d) => d + daysDelta);
        return newOffset % PIXELS_PER_DAY;
      }

      return newOffset;
    });
  }, []);

  // Calculate translateX from pixel offset
  const fractionalDays = pixelOffset / PIXELS_PER_DAY;
  const translateX = `${-(BUFFER_DAYS + fractionalDays) * DAY_WIDTH_PERCENT}%`;

  // Center date and days array
  const centerDate = useMemo(() => offsetDate(currentDate, dayOffset), [currentDate, dayOffset]);
  const days = useMemo(() => getExtendedDays(centerDate), [centerDate]);

  // Calendar data
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
    setPixelOffset(0);
  }, []);

  const isOffToday = dayOffset !== 0 || Math.abs(pixelOffset) > 10;

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
                {isOffToday && (
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
              <div
                className="h-full flex"
                style={{
                  width: `${(TOTAL_DAYS / VISIBLE_DAYS) * 100}%`,
                  transform: `translateX(${translateX})`,
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
