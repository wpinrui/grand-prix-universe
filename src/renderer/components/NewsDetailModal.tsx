/**
 * NewsDetailModal - Full modal overlay for reading news articles
 *
 * Displays the full headline, body text, and quotes with proper styling.
 * Closes on X button, Escape key, or backdrop click.
 */

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { CalendarEvent, NewsQuote } from '../../shared/domain';
import { NewsSource, NewsCategory } from '../../shared/domain';
import { formatGameDate } from '../../shared/utils/date-utils';
import { SourceBadge } from './NewsCard';

// ===========================================
// TYPES
// ===========================================

interface NewsDetailModalProps {
  item: CalendarEvent;
  onClose: () => void;
}

// ===========================================
// CATEGORY STYLING
// ===========================================

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  [NewsCategory.PreSeason]: 'Pre-Season',
  [NewsCategory.RacePreview]: 'Race Preview',
  [NewsCategory.RaceResult]: 'Race Result',
  [NewsCategory.Transfer]: 'Transfer',
  [NewsCategory.Technical]: 'Technical',
  [NewsCategory.Championship]: 'Championship',
  [NewsCategory.Rumor]: 'Rumor',
  [NewsCategory.Commentary]: 'Commentary',
};

// ===========================================
// SUB-COMPONENTS
// ===========================================

function CategoryBadge({ category }: { category: NewsCategory }) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--neutral-700)] text-secondary">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function QuoteBlock({ quote }: { quote: NewsQuote }) {
  return (
    <blockquote className="my-6 pl-4 border-l-4 border-[var(--accent-600)] bg-[var(--neutral-850)] rounded-r-lg py-4 pr-4">
      <p className="text-primary italic leading-relaxed mb-3">"{quote.text}"</p>
      <footer className="text-sm">
        <span className="text-[var(--accent-400)] font-medium">
          — {quote.attribution}
        </span>
        {quote.attributionRole && (
          <span className="text-muted">, {quote.attributionRole}</span>
        )}
        {!quote.isNamed && (
          <span className="text-muted/60 text-xs ml-2">(anonymous source)</span>
        )}
      </footer>
    </blockquote>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function NewsDetailModal({ item, onClose }: NewsDetailModalProps) {
  const source = item.newsSource ?? NewsSource.F1Official;
  const category = item.newsCategory;
  const quotes = item.quotes ?? [];

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Split body into paragraphs
  const paragraphs = item.body?.split('\n\n').filter(Boolean) ?? [];

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto card">
        {/* Header */}
        <div className="sticky top-0 surface-primary border-b border-subtle px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <SourceBadge source={source} size="large" />
            {category && <CategoryBadge category={category} />}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{formatGameDate(item.date)}</span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--neutral-700)] text-muted hover:text-primary transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Headline */}
          <h1 className="text-2xl font-bold text-primary mb-6 leading-tight">
            {item.subject}
          </h1>

          {/* Body with interleaved quotes */}
          <div className="text-secondary leading-relaxed">
            {paragraphs.length > 0 ? (
              <>
                {/* First paragraph */}
                {paragraphs[0] && <p className="mb-4">{paragraphs[0]}</p>}

                {/* First quote after first paragraph (if exists) */}
                {quotes[0] && <QuoteBlock quote={quotes[0]} />}

                {/* Remaining paragraphs */}
                {paragraphs.slice(1).map((paragraph, index) => (
                  <p key={index} className="mb-4">
                    {paragraph}
                  </p>
                ))}

                {/* Remaining quotes at the end */}
                {quotes.slice(1).map((quote, index) => (
                  <QuoteBlock key={index} quote={quote} />
                ))}
              </>
            ) : (
              // No body, just show quotes if any
              quotes.map((quote, index) => <QuoteBlock key={index} quote={quote} />)
            )}
          </div>

          {/* Sender info if present */}
          {item.sender && (
            <div className="mt-6 pt-4 border-t border-subtle">
              <p className="text-xs text-muted">Source: {item.sender}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
