import type { CalendarEvent } from '../../shared/domain';
import { formatGameDate } from '../../shared/utils/date-utils';

interface CalendarEventRowProps {
  item: CalendarEvent;
  showCriticalBadge?: boolean;
}

/**
 * Shared row component for displaying calendar events (news, mail, etc.)
 */
export function CalendarEventRow({ item, showCriticalBadge = false }: CalendarEventRowProps) {
  return (
    <div className="flex gap-4 py-3 border-b border-subtle last:border-b-0">
      <div className="w-32 shrink-0 text-muted text-sm">
        {formatGameDate(item.date)}
      </div>
      <div className="flex-1">
        <p className="text-primary">{item.subject}</p>
        {showCriticalBadge && item.critical && (
          <span className="text-xs text-accent mt-1 inline-block">Important</span>
        )}
      </div>
    </div>
  );
}
