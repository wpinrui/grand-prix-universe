import { useDerivedGameState } from '../hooks';
import { SectionHeading, CalendarEventRow } from '../components';
import { CalendarEventType } from '../../shared/domain';
import { getFilteredCalendarEvents } from '../utils/calendar-event-utils';

// ===========================================
// CONSTANTS
// ===========================================

const MAX_NEWS_ITEMS = 20;

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <p className="text-secondary">No news yet.</p>
      <p className="text-muted text-sm mt-1">
        News headlines will appear here as the season progresses.
      </p>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function News() {
  const { gameState } = useDerivedGameState();

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading news...</p>
      </div>
    );
  }

  const newsItems = getFilteredCalendarEvents(
    gameState.calendarEvents,
    gameState.currentDate,
    CalendarEventType.Headline,
    MAX_NEWS_ITEMS
  );

  return (
    <div className="max-w-3xl">
      <SectionHeading>News</SectionHeading>
      <div className="card">
        {newsItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="px-4">
            {newsItems.map((item) => (
              <CalendarEventRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
