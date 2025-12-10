import type { GameDate, CalendarEvent } from '../../shared/domain';
import { CalendarEventType } from '../../shared/domain';
import { getShortDayName, getShortMonthName, type RaceSessionType } from '../../shared/utils/date-utils';
import { FlagIcon } from './FlagIcon';
import { Flag } from 'lucide-react';

export interface RaceWeekendInfo {
  session: RaceSessionType;
  circuitName: string;
  country: string;
}

interface DayCardProps {
  date: GameDate;
  isCurrent: boolean;
  isPast: boolean;
  events: CalendarEvent[];
  raceWeekendInfo: RaceWeekendInfo | null;
}

export function DayCard({ date, isCurrent, isPast, events, raceWeekendInfo }: DayCardProps) {
  const dayName = getShortDayName(date);
  const monthName = getShortMonthName(date);

  return (
    <div
      className={`
        flex-1 min-w-0 flex flex-col border-r border-[var(--neutral-700)] last:border-r-0
        ${isCurrent ? 'bg-[var(--accent-900)]' : 'bg-[var(--neutral-850)]'}
        ${isPast ? 'opacity-50' : ''}
      `}
    >
      {/* Date header */}
      <div className="px-3 py-2 border-b border-[var(--neutral-700)]">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-base font-medium ${isCurrent ? 'text-[var(--accent-300)]' : 'text-secondary'}`}>
            {dayName}
          </span>
          <span className={`text-xl font-bold ${isCurrent ? 'text-[var(--accent-200)]' : 'text-primary'}`}>
            {date.day}
          </span>
          <span className="text-sm text-muted ml-1">{monthName}</span>
        </div>
      </div>

      {/* Content card area */}
      <div className="flex-1 p-2 overflow-hidden">
        <div className="h-full bg-[var(--neutral-800)] rounded border border-[var(--neutral-700)] p-2 overflow-y-auto">
          {/* Race weekend session */}
          {raceWeekendInfo && (
            <div className={`
              mb-2 p-2 rounded text-sm font-medium
              ${raceWeekendInfo.session === 'Race'
                ? 'bg-[var(--accent-700)] text-[var(--accent-200)]'
                : 'bg-[var(--neutral-700)] text-secondary'}
            `}>
              <div className="flex items-center gap-1.5">
                <FlagIcon country={raceWeekendInfo.country} />
                <span>{raceWeekendInfo.session}</span>
              </div>
              <div className="text-xs text-muted mt-0.5 truncate">
                {raceWeekendInfo.circuitName}
              </div>
            </div>
          )}

          {/* Calendar events */}
          {events.map((event) => {
            const isMilestone = event.type === CalendarEventType.Milestone;
            return (
              <div
                key={event.id}
                className={`
                  mb-1.5 p-1.5 rounded text-xs flex items-center gap-1.5
                  ${isMilestone
                    ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
                    : 'bg-[var(--neutral-750)] text-muted'}
                `}
                title={event.subject}
              >
                {isMilestone && <Flag size={12} className="flex-shrink-0" />}
                <span className="truncate">{event.subject}</span>
              </div>
            );
          })}

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
