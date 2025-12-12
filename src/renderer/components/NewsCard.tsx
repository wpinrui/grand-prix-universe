/**
 * NewsCard Components
 *
 * Flipboard-style cards for displaying news articles.
 * Hero variant for high-importance news, small variant for the 3-column grid.
 */

import type { CalendarEvent } from '../../shared/domain';
import { NewsSource } from '../../shared/domain';
import { formatGameDate } from '../../shared/utils/date-utils';
import { NEWS_SOURCE_STYLES, getNewsSourceBadgeClasses } from '../utils/theme-styles';

// ===========================================
// TYPES
// ===========================================

interface NewsCardProps {
  item: CalendarEvent;
  onClick: () => void;
}

// ===========================================
// HELPERS
// ===========================================

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

function SourceBadge({ source, size = 'normal' }: { source: NewsSource; size?: 'small' | 'normal' }) {
  const style = NEWS_SOURCE_STYLES[source];
  const sizeClasses = size === 'small' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`${getNewsSourceBadgeClasses(source)} ${sizeClasses} rounded font-medium uppercase tracking-wide`}>
      {style.label}
    </span>
  );
}

// ===========================================
// HERO CARD (High Importance)
// ===========================================

/**
 * Full-width hero card for high-importance news articles.
 * Spans entire grid width with larger text and more visible excerpt.
 */
export function NewsCardHero({ item, onClick }: NewsCardProps) {
  const source = item.newsSource ?? NewsSource.F1Official;
  const excerpt = item.body ? truncateText(item.body, 180) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left card p-6 cursor-pointer transition-all duration-200 hover:brightness-110 hover:shadow-lg group"
    >
      {/* Header: Source + Date */}
      <div className="flex items-center justify-between mb-3">
        <SourceBadge source={source} />
        <span className="text-sm text-muted">{formatGameDate(item.date, 'short')}</span>
      </div>

      {/* Headline */}
      <h2 className="text-xl font-bold text-primary mb-2 group-hover:text-[var(--accent-400)] transition-colors">
        {item.subject}
      </h2>

      {/* Body Excerpt */}
      {excerpt && (
        <p className="text-secondary text-sm leading-relaxed line-clamp-2">
          {excerpt}
        </p>
      )}
    </button>
  );
}

// ===========================================
// SMALL CARD (Medium/Low Importance)
// ===========================================

/**
 * Compact card for the 3-column grid layout.
 * Shows source badge, headline, and brief excerpt.
 */
export function NewsCardSmall({ item, onClick }: NewsCardProps) {
  const source = item.newsSource ?? NewsSource.F1Official;
  const excerpt = item.body ? truncateText(item.body, 100) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left card p-4 cursor-pointer transition-all duration-200 hover:brightness-110 hover:border-[var(--accent-700)] group h-full flex flex-col"
    >
      {/* Header: Source + Date */}
      <div className="flex items-center justify-between mb-2">
        <SourceBadge source={source} size="small" />
        <span className="text-xs text-muted">{formatGameDate(item.date, 'short')}</span>
      </div>

      {/* Headline */}
      <h3 className="text-sm font-semibold text-primary mb-2 line-clamp-2 group-hover:text-[var(--accent-400)] transition-colors flex-grow">
        {item.subject}
      </h3>

      {/* Body Excerpt */}
      {excerpt && (
        <p className="text-muted text-xs leading-relaxed line-clamp-3">
          {excerpt}
        </p>
      )}
    </button>
  );
}
