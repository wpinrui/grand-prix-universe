import { useDerivedGameState } from '../hooks';
import { SectionHeading, CalendarEventRow } from '../components';
import { CalendarEventType } from '../../shared/domain';
import { getFilteredCalendarEvents } from '../utils/calendar-event-utils';

// ===========================================
// CONSTANTS
// ===========================================

const MAX_MAIL_ITEMS = 50;

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
              <CalendarEventRow key={item.id} item={item} showCriticalBadge />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
