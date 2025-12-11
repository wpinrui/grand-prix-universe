import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameDate, CalendarEvent, CalendarEntry, Circuit, Team } from '../../shared/domain';
import { TopBar } from './TopBar';
import { DayCard } from './DayCard';
import { useCalendarData } from '../hooks';
import { getCalendarStripDays, dateKey } from '../../shared/utils/date-utils';
import { CALENDAR_PANEL_HEIGHT, PANEL_TRANSLUCENT_BG_CLASSES, PANEL_FOOTER_CLASSES } from '../utils/theme-styles';

/** Index positions in the 9-day strip */
const PAST_DAY_INDEX = 0;
const CURRENT_DAY_INDEX = 1;
const TOTAL_DAYS = 9;

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
  playerTeam,
}: SimulationOverlayProps) {
  const animationKey = dateKey(currentDate);

  // Memoize days to prevent unnecessary recalculations
  const days = useMemo(
    () => getCalendarStripDays(currentDate),
    [currentDate.year, currentDate.month, currentDate.day]
  );

  // Use shared hook for calendar data
  const { eventsByDate, raceWeekendByDate, footerText } = useCalendarData({
    days,
    events,
    calendar,
    circuits,
    currentDate,
    nextRace,
    isPostSeason,
  });

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
              currentDate={currentDate}
              playerTeam={playerTeam}
            />
          </div>

          {/* Calendar panel - positioned below TopBar */}
          <motion.div
            initial={{ y: -CALENDAR_PANEL_HEIGHT, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -CALENDAR_PANEL_HEIGHT, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative z-10 border-b border-[var(--neutral-700)]"
            style={{ height: CALENDAR_PANEL_HEIGHT }}
          >
            {/* Panel background */}
            <div className={`absolute inset-0 ${PANEL_TRANSLUCENT_BG_CLASSES}`} />

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
              <div className={PANEL_FOOTER_CLASSES}>
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
