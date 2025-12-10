import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit } from '../../shared/domain';
import { CalendarEventType } from '../../shared/domain';
import { DayCard } from './DayCard';
import { useCalendarData } from '../hooks';
import {
  offsetDate,
  isSameDay,
  dateKey,
  getMonthCalendarDays,
  getMonthName,
} from '../../shared/utils/date-utils';
import { FlagIcon } from './FlagIcon';
import { CALENDAR_PANEL_HEIGHT, ICON_BUTTON_GHOST_CLASSES, PANEL_TRANSLUCENT_BG_CLASSES, PANEL_FOOTER_CLASSES } from '../utils/theme-styles';

/** Number of visible days in strip view */
const VISIBLE_DAYS = 7;
/** Extra days rendered on each side for smooth scrolling */
const BUFFER_DAYS = 7;
/** Total days rendered in strip */
const TOTAL_DAYS = VISIBLE_DAYS + BUFFER_DAYS * 2;
/** Width of one day as percentage of strip width (for translation) */
const DAY_WIDTH_STRIP_PERCENT = 100 / TOTAL_DAYS;
/** Pixels of scroll needed to move one day */
const PIXELS_PER_DAY = 80;

/** Day names for month grid header */
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Renders event summary for a day cell in month grid
 * Uses mini-badges matching DayCard styling for consistency
 */
function EventsSummary({ events }: { events: CalendarEvent[] }) {
  const milestones = events.filter((e) => e.type === CalendarEventType.Milestone);
  const projections = events.filter((e) => e.type === CalendarEventType.Projection);

  return (
    <div className="space-y-0.5" title={events.map((e) => e.subject).join('\n')}>
      {/* Milestones - emerald badges */}
      {milestones.slice(0, 2).map((e) => (
        <div
          key={e.id}
          className="text-xs truncate px-1 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/50"
        >
          {e.subject}
        </div>
      ))}
      {milestones.length > 2 && (
        <div className="text-xs text-emerald-400">+{milestones.length - 2} more</div>
      )}

      {/* Projections - sky badges with dashed border */}
      {projections.slice(0, 2).map((e) => (
        <div
          key={e.id}
          className="text-xs truncate px-1 py-0.5 rounded bg-sky-900/30 text-sky-300/80 border border-dashed border-sky-700/50"
        >
          {e.subject}
        </div>
      ))}
      {projections.length > 2 && (
        <div className="text-xs text-sky-400/70">+{projections.length - 2} more</div>
      )}
    </div>
  );
}

/** Delay before adding click-outside listener (prevents opening click from closing) */
const CLICK_OUTSIDE_DELAY_MS = 100;

/**
 * Get extended array of days for smooth scrolling
 * Anchor date becomes the first visible day
 */
function getExtendedDays(anchorDate: GameDate): GameDate[] {
  const days: GameDate[] = [];
  // Anchor date becomes the first visible day (at index BUFFER_DAYS)
  const startOffset = -BUFFER_DAYS;
  let date = offsetDate(anchorDate, startOffset);
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
}

export function CalendarPreviewPanel({
  currentDate,
  events,
  calendar,
  circuits,
  nextRace,
  isVisible,
  onClose,
}: CalendarPreviewPanelProps) {
  // Strip view state
  const [dayOffset, setDayOffset] = useState(0);
  const [pixelOffset, setPixelOffset] = useState(0);

  // Expanded state
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewYear, setViewYear] = useState(currentDate.year);
  const [viewMonth, setViewMonth] = useState(currentDate.month);

  const panelRef = useRef<HTMLDivElement>(null);

  // Reset when panel opens
  useEffect(() => {
    if (isVisible) {
      setDayOffset(0);
      setPixelOffset(0);
      setIsExpanded(false);
      setViewYear(currentDate.year);
      setViewMonth(currentDate.month);
    }
  }, [isVisible, currentDate.year, currentDate.month]);

  // Close on Escape
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isExpanded) {
          setIsExpanded(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, isExpanded, onClose]);

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
    }, CLICK_OUTSIDE_DELAY_MS);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Scrollwheel - pure smooth scroll (strip view only)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isExpanded) return;
      e.preventDefault();

      setPixelOffset((prev) => {
        const newOffset = prev + e.deltaY;
        const daysDelta = Math.trunc(newOffset / PIXELS_PER_DAY);

        if (Math.abs(daysDelta) >= 1) {
          setDayOffset((d) => d + daysDelta);
          return newOffset % PIXELS_PER_DAY;
        }

        return newOffset;
      });
    },
    [isExpanded]
  );

  // Calculate translateX from pixel offset (percentage relative to strip width)
  const fractionalDays = pixelOffset / PIXELS_PER_DAY;
  const translateX = `${-(BUFFER_DAYS + fractionalDays) * DAY_WIDTH_STRIP_PERCENT}%`;

  // Strip view data
  const centerDate = useMemo(() => offsetDate(currentDate, dayOffset), [currentDate, dayOffset]);
  const stripDays = useMemo(() => getExtendedDays(centerDate), [centerDate]);

  // Month view data
  const monthDays = useMemo(
    () => getMonthCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // Use the appropriate days array for calendar data
  const days = isExpanded ? monthDays : stripDays;

  // Calendar data
  const { eventsByDate, raceWeekendByDate, footerText } = useCalendarData({
    days,
    events,
    calendar,
    circuits,
    currentDate,
    nextRace,
  });

  // Jump to today (strip view)
  const handleJumpToToday = useCallback(() => {
    setDayOffset(0);
    setPixelOffset(0);
  }, []);

  // Month navigation
  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  const handleJumpToCurrentMonth = useCallback(() => {
    setViewYear(currentDate.year);
    setViewMonth(currentDate.month);
  }, [currentDate.year, currentDate.month]);

  // Toggle expand/collapse
  const handleToggleExpand = useCallback(() => {
    if (!isExpanded) {
      // When expanding, set month view to current date's month
      setViewYear(currentDate.year);
      setViewMonth(currentDate.month);
    }
    setIsExpanded((prev) => !prev);
  }, [isExpanded, currentDate.year, currentDate.month]);

  const isOffToday = dayOffset !== 0 || Math.abs(pixelOffset) > 10;
  const isViewingDifferentMonth =
    viewYear !== currentDate.year || viewMonth !== currentDate.month;

  const monthDisplayDate = { year: viewYear, month: viewMonth, day: 1 };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={panelRef}
          initial={{ y: -CALENDAR_PANEL_HEIGHT, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -CALENDAR_PANEL_HEIGHT, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`absolute top-16 left-0 right-0 z-40 border-b border-[var(--neutral-700)] ${isExpanded ? 'bottom-0' : ''}`}
          style={isExpanded ? undefined : { height: CALENDAR_PANEL_HEIGHT }}
          onWheel={handleWheel}
        >
          <div className={`absolute inset-0 ${PANEL_TRANSLUCENT_BG_CLASSES}`} />

          <div className="relative h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--neutral-700)]">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className={`p-1 ${ICON_BUTTON_GHOST_CLASSES}`}
                      title="Previous month"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium text-secondary min-w-[140px] text-center">
                      {getMonthName(monthDisplayDate)} {viewYear}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className={`p-1 ${ICON_BUTTON_GHOST_CLASSES}`}
                      title="Next month"
                    >
                      <ChevronRight size={18} />
                    </button>
                    {isViewingDifferentMonth && (
                      <button
                        type="button"
                        onClick={handleJumpToCurrentMonth}
                        className="ml-2 text-xs text-[var(--accent-400)] hover:text-[var(--accent-300)] underline"
                      >
                        Jump to current month
                      </button>
                    )}
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleExpand}
                  className={`p-1.5 ${ICON_BUTTON_GHOST_CLASSES}`}
                  title={isExpanded ? 'Collapse to strip view' : 'Expand to month view'}
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={`p-1.5 ${ICON_BUTTON_GHOST_CLASSES}`}
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            {isExpanded ? (
              // Month Grid View
              <div className="flex-1 overflow-hidden p-4">
                {/* Day names header */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAY_NAMES.map((name) => (
                    <div
                      key={name}
                      className="text-center text-xs font-medium text-muted py-1"
                    >
                      {name}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1 h-[calc(100%-28px)]">
                  {monthDays.map((date) => {
                    const key = dateKey(date);
                    const isCurrentDay = isSameDay(date, currentDate);
                    const isCurrentMonth = date.month === viewMonth;
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const raceInfo = raceWeekendByDate.get(key);

                    return (
                      <div
                        key={key}
                        className={`
                          rounded border p-1 flex flex-col overflow-hidden
                          ${isCurrentMonth ? 'bg-[var(--neutral-800)] border-[var(--neutral-700)]' : 'bg-[var(--neutral-850)] border-[var(--neutral-800)]'}
                          ${isCurrentDay ? 'ring-2 ring-[var(--accent-500)] bg-[var(--accent-800)]' : ''}
                        `}
                      >
                        {/* Day number */}
                        <div
                          className={`text-xs font-medium mb-0.5 ${
                            isCurrentDay
                              ? 'text-[var(--accent-300)]'
                              : isCurrentMonth
                                ? 'text-secondary'
                                : 'text-muted/50'
                          }`}
                        >
                          {date.day}
                        </div>

                        {/* Race weekend indicator */}
                        {raceInfo && isCurrentMonth && (
                          <div
                            className={`
                              text-xs truncate px-1 py-0.5 rounded mb-0.5 flex items-center gap-1
                              ${raceInfo.session === 'Race' ? 'bg-[var(--accent-700)] text-[var(--accent-200)]' : 'bg-[var(--neutral-700)] text-muted'}
                            `}
                            title={`${raceInfo.session}: ${raceInfo.circuitName}`}
                          >
                            <FlagIcon country={raceInfo.country} size="sm" />
                            <span className="truncate">{raceInfo.session}</span>
                          </div>
                        )}

                        {/* Events indicator */}
                        {dayEvents.length > 0 && isCurrentMonth && (
                          <EventsSummary events={dayEvents} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Strip View
              <div className="flex-1 overflow-hidden">
                <div
                  className="h-full flex"
                  style={{
                    width: `${(TOTAL_DAYS / VISIBLE_DAYS) * 100}%`,
                    transform: `translateX(${translateX})`,
                  }}
                >
                  {stripDays.map((date) => {
                    const key = dateKey(date);
                    const isCurrentDay = isSameDay(date, currentDate);
                    return (
                      <DayCard
                        key={key}
                        date={date}
                        isCurrent={isCurrentDay}
                        isPast={false}
                        events={eventsByDate.get(key) ?? []}
                        raceWeekendInfo={raceWeekendByDate.get(key) ?? null}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className={PANEL_FOOTER_CLASSES}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {isExpanded ? 'Use arrows to navigate months' : 'Scroll to navigate days'}
                </span>
                <span className="text-sm text-secondary">{footerText}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
