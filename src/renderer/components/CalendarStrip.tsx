import { motion, AnimatePresence } from 'framer-motion';
import type { GameDate, CalendarEvent } from '../../shared/domain';
import {
  getCalendarStripDays,
  getShortDayName,
  getShortMonthName,
  isSameDay,
} from '../../shared/utils/date-utils';

interface CalendarStripProps {
  currentDate: GameDate;
  events: CalendarEvent[];
  isVisible: boolean;
}

interface DayCellProps {
  date: GameDate;
  isCurrent: boolean;
  isPast: boolean;
  showMonth: boolean;
  event: CalendarEvent | undefined;
}

function DayCell({ date, isCurrent, isPast, showMonth, event }: DayCellProps) {
  const dayName = getShortDayName(date);
  const monthName = getShortMonthName(date);

  return (
    <div
      className={`
        flex-1 min-w-0 px-2 py-2 border-r border-[var(--neutral-700)] last:border-r-0
        flex flex-col justify-center
        ${isCurrent ? 'bg-[var(--accent-800)]/50' : ''}
        ${isPast ? 'opacity-50' : ''}
      `}
    >
      {/* Date header */}
      <div className="flex items-baseline gap-1 text-xs">
        <span className={`font-medium ${isCurrent ? 'text-[var(--accent-300)]' : 'text-secondary'}`}>
          {dayName}
        </span>
        <span className={`font-bold ${isCurrent ? 'text-[var(--accent-200)]' : 'text-primary'}`}>
          {date.day}
        </span>
        {showMonth && (
          <span className="text-muted ml-0.5">{monthName}</span>
        )}
      </div>

      {/* Event text */}
      {event && (
        <div className="mt-0.5 text-xs text-muted truncate" title={event.subject}>
          {event.subject}
        </div>
      )}
    </div>
  );
}

export function CalendarStrip({ currentDate, events, isVisible }: CalendarStripProps) {
  const days = getCalendarStripDays(currentDate);

  // Find events for each day
  const getEventForDay = (date: GameDate): CalendarEvent | undefined => {
    return events.find((e) => isSameDay(e.date, date));
  };

  // Determine if we should show month for a day (first day of month, or first day in strip)
  const shouldShowMonth = (date: GameDate, index: number): boolean => {
    if (index === 0) return true; // Always show for first cell
    return date.day === 1; // Show on month boundaries
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden border-b border-[var(--neutral-700)]"
        >
          <div className="flex bg-[var(--neutral-850)] h-14">
            {days.map((date, index) => (
              <DayCell
                key={`${date.year}-${date.month}-${date.day}`}
                date={date}
                isCurrent={index === 1} // Index 1 is the current day
                isPast={index === 0} // Index 0 is the past day
                showMonth={shouldShowMonth(date, index)}
                event={getEventForDay(date)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
