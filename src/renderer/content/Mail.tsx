import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { CalendarEventType, type CalendarEvent } from '../../shared/domain';
import { formatGameDate } from '../../shared/utils/date-utils';
import { getFilteredCalendarEvents } from '../utils/calendar-event-utils';

// ===========================================
// CONSTANTS
// ===========================================

const MAX_MAIL_ITEMS = 50;

// ===========================================
// COMPONENTS
// ===========================================

interface MailItemRowProps {
  item: CalendarEvent;
}

function MailItemRow({ item }: MailItemRowProps) {
  return (
    <div className="flex gap-4 py-3 border-b border-subtle last:border-b-0">
      <div className="w-32 shrink-0 text-muted text-sm">
        {formatGameDate(item.date)}
      </div>
      <div className="flex-1">
        <p className="text-primary">{item.subject}</p>
        {item.critical && (
          <span className="text-xs text-accent mt-1 inline-block">Important</span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <p className="text-secondary">No messages yet.</p>
      <p className="text-muted text-sm mt-1">
        Messages from departments and staff will appear here.
      </p>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Mail() {
  const { gameState } = useDerivedGameState();

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading mail...</p>
      </div>
    );
  }

  const mailItems = getFilteredCalendarEvents(
    gameState.calendarEvents,
    gameState.currentDate,
    CalendarEventType.Email,
    MAX_MAIL_ITEMS
  );

  return (
    <div className="max-w-3xl">
      <SectionHeading>Mail</SectionHeading>
      <div className="card">
        {mailItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="px-4">
            {mailItems.map((item) => (
              <MailItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
