import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CalendarEvent } from '../../shared/domain';
import { formatGameDate } from '../../shared/utils/date-utils';

interface CalendarEventRowProps {
  item: CalendarEvent;
  showCriticalBadge?: boolean;
}

/**
 * Shared row component for displaying calendar events (news, mail, etc.)
 * Expandable to show full body text when clicked.
 */
export function CalendarEventRow({ item, showCriticalBadge = false }: CalendarEventRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasBody = Boolean(item.body);

  return (
    <div className="border-b border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => hasBody && setIsExpanded(!isExpanded)}
        className={`w-full flex gap-4 py-3 text-left ${hasBody ? 'cursor-pointer hover:bg-[var(--neutral-800)]/50' : ''}`}
        disabled={!hasBody}
      >
        {/* Expand icon */}
        <div className="w-5 shrink-0 flex items-center justify-center text-muted">
          {hasBody && (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
        </div>

        {/* Date */}
        <div className="w-28 shrink-0 text-muted text-sm">
          {formatGameDate(item.date)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-primary truncate">{item.subject}</p>
          {item.sender && (
            <p className="text-xs text-muted mt-0.5">{item.sender}</p>
          )}
          {showCriticalBadge && item.critical && (
            <span className="text-xs text-amber-400 mt-1 inline-block">Important</span>
          )}
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && item.body && (
        <div className="pl-[4.25rem] pr-4 pb-4 text-sm text-secondary leading-relaxed">
          {item.body}
        </div>
      )}
    </div>
  );
}
