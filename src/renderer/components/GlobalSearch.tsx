/**
 * Global search modal - Football Manager style search across all entities
 * Opens with Ctrl+K, searches teams, drivers, staff, circuits, and pages
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Search, Users, User, UserCog, MapPin, FileText } from 'lucide-react';
import { useGlobalSearch, type SearchResult, type SearchResultType } from '../hooks/useGlobalSearch';
import type { SectionId } from '../navigation';

// ===========================================
// TYPES
// ===========================================

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: SearchResultType, id: string) => void;
}

interface ResultGroupProps {
  label: string;
  icon: React.ReactNode;
  results: SearchResult[];
  highlightedIndex: number;
  baseIndex: number;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
}

// ===========================================
// CONSTANTS
// ===========================================

const GROUP_CONFIG = [
  { key: 'teams', label: 'Teams', icon: <Users size={14} /> },
  { key: 'drivers', label: 'Drivers', icon: <User size={14} /> },
  { key: 'staff', label: 'Staff', icon: <UserCog size={14} /> },
  { key: 'circuits', label: 'Circuits', icon: <MapPin size={14} /> },
  { key: 'pages', label: 'Pages', icon: <FileText size={14} /> },
] as const satisfies ReadonlyArray<{
  key: keyof ReturnType<typeof useGlobalSearch>['results'];
  label: string;
  icon: React.ReactNode;
}>;

type GroupKey = (typeof GROUP_CONFIG)[number]['key'];

const KBD_CLASSES = 'px-1.5 py-0.5 font-mono bg-[var(--neutral-800)] rounded border border-subtle mr-1';

// ===========================================
// RESULT GROUP COMPONENT
// ===========================================

function ResultGroup({
  label,
  icon,
  results,
  highlightedIndex,
  baseIndex,
  onSelect,
  onHover,
}: ResultGroupProps) {
  if (results.length === 0) return null;

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 px-4 py-1 text-xs font-semibold text-muted uppercase tracking-wider">
        {icon}
        {label}
      </div>
      {results.map((result, i) => {
        const globalIndex = baseIndex + i;
        const isHighlighted = globalIndex === highlightedIndex;

        return (
          <button
            key={result.id}
            type="button"
            onClick={() => onSelect(result)}
            onMouseEnter={() => onHover(globalIndex)}
            className={`w-full text-left px-4 py-2 cursor-pointer transition-colors ${
              isHighlighted
                ? 'bg-[var(--accent-600)] text-white'
                : 'text-primary hover:bg-[var(--neutral-700)]'
            }`}
          >
            <div className="font-medium">{result.label}</div>
            {result.sublabel && (
              <div className={`text-sm ${isHighlighted ? 'text-white/70' : 'text-muted'}`}>
                {result.sublabel}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function GlobalSearch({ isOpen, onClose, onSelect }: GlobalSearchProps) {
  const { query, setQuery, clearQuery, results, hasResults } = useGlobalSearch();
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Memoize flat list of all results for keyboard navigation
  const flatResults = useMemo(() => {
    const flat: SearchResult[] = [];
    for (const config of GROUP_CONFIG) {
      flat.push(...results[config.key]);
    }
    return flat;
  }, [results]);

  // Memoize base indices for each group
  const groupBaseIndices = useMemo(() => {
    let baseIndex = 0;
    const indices = {} as Record<GroupKey, number>;
    for (const config of GROUP_CONFIG) {
      indices[config.key] = baseIndex;
      baseIndex += results[config.key].length;
    }
    return indices;
  }, [results]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      clearQuery();
      setHighlightedIndex(0);
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, clearQuery]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.querySelectorAll('button');
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelect(result.type, result.id);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[highlightedIndex]) {
            handleSelect(flatResults[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, highlightedIndex, handleSelect, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[15vh] z-50"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
          <Search size={20} className="text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams, drivers, staff, circuits..."
            className="flex-1 bg-transparent text-primary placeholder-muted outline-none text-base"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono text-muted bg-[var(--neutral-800)] rounded border border-subtle">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-auto">
          {query.trim() === '' ? (
            <div className="px-4 py-8 text-center text-muted">
              Start typing to search...
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-8 text-center text-muted">
              No results for "{query}"
            </div>
          ) : (
            GROUP_CONFIG.map((config) => (
              <ResultGroup
                key={config.key}
                label={config.label}
                icon={config.icon}
                results={results[config.key]}
                highlightedIndex={highlightedIndex}
                baseIndex={groupBaseIndices[config.key]}
                onSelect={handleSelect}
                onHover={setHighlightedIndex}
              />
            ))
          )}
        </div>

        {/* Footer hint */}
        {hasResults && (
          <div className="px-4 py-2 border-t border-subtle text-xs text-muted flex items-center gap-4">
            <span>
              <kbd className={KBD_CLASSES}>↑↓</kbd>
              Navigate
            </span>
            <span>
              <kbd className={KBD_CLASSES}>↵</kbd>
              Select
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================
// HELPER EXPORTS
// ===========================================

/**
 * Parse a page result ID into section and subItem
 */
export function parsePageId(pageId: string): { section: SectionId; subItem: string } | null {
  const [section, subItem] = pageId.split('/');
  if (section && subItem) {
    return { section: section as SectionId, subItem };
  }
  return null;
}
