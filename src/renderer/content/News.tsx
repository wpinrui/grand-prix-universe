import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { CalendarEventType, type CalendarEvent } from '../../shared/domain';
import { formatGameDate } from '../../shared/utils/date-utils';
import { getFilteredCalendarEvents } from '../utils/calendar-event-utils';

// ===========================================
// CONSTANTS
// ===========================================

const MAX_NEWS_ITEMS = 20;

// ===========================================
// COMPONENTS
// ===========================================

interface NewsItemRowProps {
  item: CalendarEvent;
}

function NewsItemRow({ item }: NewsItemRowProps) {
  return (
    <div className="flex gap-4 py-3 border-b border-subtle last:border-b-0">
      <div className="w-32 shrink-0 text-muted text-sm">
        {formatGameDate(item.date)}
      </div>
      <div className="flex-1">
        <p className="text-primary">{item.subject}</p>
      </div>
    </div>
  );
}

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
              <NewsItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
