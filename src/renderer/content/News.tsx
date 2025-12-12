/**
 * News Screen
 *
 * Flipboard-style magazine layout displaying news articles.
 * Features: month navigation pills, search, year dropdown, hero + grid layout.
 */

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, Dropdown } from '../components';
import { NewsCardHero, NewsCardSmall } from '../components/NewsCard';
import { CalendarEventType, type CalendarEvent } from '../../shared/domain';
import { daysBetween, seasonToYear } from '../../shared/utils/date-utils';
import type { DropdownOption } from '../components';

// ===========================================
// CONSTANTS
// ===========================================

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const INITIAL_DISPLAY_COUNT = 25;
const LOAD_MORE_COUNT = 25;

// ===========================================
// HELPERS
// ===========================================

/**
 * Get unique months that have news items for a given year
 */
function getMonthsWithNews(events: CalendarEvent[], year: number): number[] {
  const monthsSet = new Set<number>();
  for (const event of events) {
    if (event.type === CalendarEventType.Headline && event.date.year === year) {
      monthsSet.add(event.date.month);
    }
  }
  return Array.from(monthsSet).sort((a, b) => a - b);
}

/**
 * Get unique years that have news items
 */
function getYearsWithNews(events: CalendarEvent[]): number[] {
  const yearsSet = new Set<number>();
  for (const event of events) {
    if (event.type === CalendarEventType.Headline) {
      yearsSet.add(event.date.year);
    }
  }
  return Array.from(yearsSet).sort((a, b) => b - a); // Newest first
}

/**
 * Filter and sort news events
 */
function filterNewsEvents(
  events: CalendarEvent[],
  currentYear: number,
  selectedMonth: number | null,
  selectedYear: number,
  searchQuery: string,
  currentDate: { year: number; month: number; day: number }
): CalendarEvent[] {
  let filtered = events
    .filter((e) => e.type === CalendarEventType.Headline)
    .filter((e) => daysBetween(e.date, currentDate) >= 0) // Only past/current
    .filter((e) => e.date.year === selectedYear);

  // Filter by month if selected
  if (selectedMonth !== null) {
    filtered = filtered.filter((e) => e.date.month === selectedMonth);
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.subject.toLowerCase().includes(query) ||
        (e.body && e.body.toLowerCase().includes(query))
    );
  }

  // Sort by date (newest first)
  return filtered.sort((a, b) => daysBetween(a.date, b.date));
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="py-12 text-center">
      <p className="text-secondary">
        {hasSearch ? 'No news matching your search.' : 'No news yet.'}
      </p>
      <p className="text-muted text-sm mt-1">
        {hasSearch
          ? 'Try a different search term or clear your filters.'
          : 'News headlines will appear here as the season progresses.'}
      </p>
    </div>
  );
}

interface MonthPillsProps {
  months: number[];
  selectedMonth: number | null;
  onSelect: (month: number | null) => void;
}

function MonthPills({ months, selectedMonth, onSelect }: MonthPillsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin">
      {/* "All" pill */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
          selectedMonth === null
            ? 'bg-[var(--accent-600)] text-white'
            : 'bg-[var(--neutral-800)] text-secondary hover:bg-[var(--neutral-700)] hover:text-primary'
        }`}
      >
        All
      </button>
      {/* Month pills */}
      {months.map((month) => (
        <button
          key={month}
          type="button"
          onClick={() => onSelect(month)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            selectedMonth === month
              ? 'bg-[var(--accent-600)] text-white'
              : 'bg-[var(--neutral-800)] text-secondary hover:bg-[var(--neutral-700)] hover:text-primary'
          }`}
        >
          {MONTH_NAMES[month - 1]}
        </button>
      ))}
    </div>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search news..."
        className="w-40 pl-9 pr-3 py-1.5 rounded-lg text-sm surface-primary border border-subtle text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)]"
      />
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function News() {
  const { gameState } = useDerivedGameState();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Loading state
  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading news...</p>
      </div>
    );
  }

  const currentYear = seasonToYear(gameState.currentSeason.seasonNumber);
  const yearsWithNews = useMemo(
    () => getYearsWithNews(gameState.calendarEvents),
    [gameState.calendarEvents]
  );

  // Default to current year, fallback to most recent year with news
  const [selectedYear, setSelectedYear] = useState(
    yearsWithNews.includes(currentYear) ? currentYear : yearsWithNews[0] ?? currentYear
  );

  const monthsWithNews = useMemo(
    () => getMonthsWithNews(gameState.calendarEvents, selectedYear),
    [gameState.calendarEvents, selectedYear]
  );

  // Reset month selection when year changes if current month not available
  const handleYearChange = (year: string) => {
    const newYear = parseInt(year, 10);
    setSelectedYear(newYear);
    const newMonths = getMonthsWithNews(gameState.calendarEvents, newYear);
    if (selectedMonth !== null && !newMonths.includes(selectedMonth)) {
      setSelectedMonth(null);
    }
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  };

  const filteredNews = useMemo(
    () =>
      filterNewsEvents(
        gameState.calendarEvents,
        currentYear,
        selectedMonth,
        selectedYear,
        searchQuery,
        gameState.currentDate
      ),
    [gameState.calendarEvents, currentYear, selectedMonth, selectedYear, searchQuery, gameState.currentDate]
  );

  // Split into hero (first high importance) and grid items
  const heroItem = filteredNews.find((item) => item.importance === 'high');
  const gridItems = heroItem
    ? filteredNews.filter((item) => item.id !== heroItem.id)
    : filteredNews;

  const displayedGridItems = gridItems.slice(0, displayCount);
  const hasMore = gridItems.length > displayCount;

  // Build year dropdown options
  const yearOptions: DropdownOption<string>[] = yearsWithNews.map((year) => ({
    value: year.toString(),
    label: year.toString(),
  }));

  // If no years with news, show current year
  if (yearOptions.length === 0) {
    yearOptions.push({ value: currentYear.toString(), label: currentYear.toString() });
  }

  const handleCardClick = (item: CalendarEvent) => {
    // TODO: Open NewsDetailModal (PR 3)
    console.log('Open news detail:', item);
  };

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
  };

  return (
    <div className="h-full flex flex-col">
      <SectionHeading>News</SectionHeading>

      {/* Toolbar: Month Pills | Search | Year */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        {/* Month Pills */}
        <div className="flex-1 min-w-0">
          <MonthPills
            months={monthsWithNews}
            selectedMonth={selectedMonth}
            onSelect={(month) => {
              setSelectedMonth(month);
              setDisplayCount(INITIAL_DISPLAY_COUNT);
            }}
          />
        </div>

        {/* Search + Year Dropdown */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <SearchInput value={searchQuery} onChange={setSearchQuery} />
          <Dropdown
            options={yearOptions}
            value={selectedYear.toString()}
            onChange={handleYearChange}
            className="w-24"
          />
        </div>
      </div>

      {/* Content */}
      {filteredNews.length === 0 ? (
        <EmptyState hasSearch={searchQuery.length > 0 || selectedMonth !== null} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Hero Card */}
          {heroItem && (
            <div className="mb-4">
              <NewsCardHero item={heroItem} onClick={() => handleCardClick(heroItem)} />
            </div>
          )}

          {/* Grid of Small Cards */}
          {displayedGridItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedGridItems.map((item) => (
                <NewsCardSmall key={item.id} item={item} onClick={() => handleCardClick(item)} />
              ))}
            </div>
          )}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-6 mb-4">
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-[var(--neutral-800)] text-secondary hover:bg-[var(--neutral-700)] hover:text-primary transition-colors cursor-pointer"
              >
                Load More ({gridItems.length - displayCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
