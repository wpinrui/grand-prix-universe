import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { CalendarEventType, type CalendarEvent, type GameDate } from '../../shared/domain';
import { formatGameDate, daysBetween } from '../../shared/utils/date-utils';

// ===========================================
// CONSTANTS
// ===========================================

const MAX_NEWS_ITEMS = 20;

// ===========================================
// HELPERS
// ===========================================

/**
 * Sort news items by date (newest first)
 * daysBetween returns positive if b > a, so negate for descending order
 */
function sortByDateDescending(a: CalendarEvent, b: CalendarEvent): number {
  return daysBetween(b.date, a.date);
}

/**
 * Filter and sort headline events for display
 */
function getNewsItems(events: CalendarEvent[], currentDate: GameDate): CalendarEvent[] {
  return events
    .filter((e) => e.type === CalendarEventType.Headline)
    .filter((e) => daysBetween(e.date, currentDate) >= 0) // Only past/current news
    .sort(sortByDateDescending)
    .slice(0, MAX_NEWS_ITEMS);
}

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

  const newsItems = getNewsItems(gameState.calendarEvents, gameState.currentDate);

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
