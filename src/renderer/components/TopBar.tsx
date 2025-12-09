import { Calendar, Coins, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GameDate, Team } from '../../shared/domain';
import { ACCENT_MUTED_BUTTON_CLASSES, ACCENT_MUTED_BUTTON_STYLE, ICON_BUTTON_GHOST_CLASSES } from '../utils/theme-styles';
import { AdvanceWeekButton } from './AdvanceWeekButton';
import { formatGameDate } from '../../shared/utils/date-utils';

const NAV_BUTTON_CLASSES = `${ICON_BUTTON_GHOST_CLASSES} p-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`;

interface TopBarProps {
  currentDate: GameDate | null;
  playerTeam: Team | null;
  onCalendarClick?: () => void;
  onSearchClick?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
}

export function TopBar({
  currentDate,
  playerTeam,
  onCalendarClick,
  onSearchClick,
  canGoBack = false,
  canGoForward = false,
  onBack,
  onForward,
}: TopBarProps) {
  return (
    <header className="top-bar flex items-center justify-between h-16 px-6 surface-primary border-b border-subtle">
      {/* Back/Forward + Search */}
      <div className="flex items-center gap-3">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            className={NAV_BUTTON_CLASSES}
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={onForward}
            disabled={!canGoForward}
            className={NAV_BUTTON_CLASSES}
            title="Go forward"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Search trigger */}
        <button
          type="button"
          onClick={onSearchClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--neutral-800)] border border-[var(--neutral-700)] rounded-lg text-muted hover:text-secondary hover:border-[var(--neutral-600)] transition-colors cursor-pointer min-w-[200px]"
        >
          <Search size={16} />
          <span className="text-sm">Search...</span>
          <kbd className="ml-auto px-1.5 py-0.5 text-xs font-mono bg-[var(--neutral-900)] rounded border border-[var(--neutral-700)]">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right side: Budget, Calendar, Advance Week */}
      <div className="flex items-center gap-3">
        {/* Budget Display */}
        <div
          className={`${ACCENT_MUTED_BUTTON_CLASSES} px-3 py-1.5`}
          style={ACCENT_MUTED_BUTTON_STYLE}
        >
          <Coins size={16} />
          <span className="tabular-nums">
            {playerTeam ? `$${playerTeam.budget.toLocaleString()}` : '—'}
          </span>
        </div>

        {/* Calendar Button */}
        <button
          type="button"
          className={`${ACCENT_MUTED_BUTTON_CLASSES} px-3 py-1.5`}
          style={ACCENT_MUTED_BUTTON_STYLE}
          title="View Calendar"
          onClick={onCalendarClick}
        >
          <Calendar size={16} />
          <span>
            {currentDate ? formatGameDate(currentDate) : '—'}
          </span>
        </button>

        {/* Advance Week Button */}
        <AdvanceWeekButton />
      </div>
    </header>
  );
}
