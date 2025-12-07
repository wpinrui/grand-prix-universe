import { Calendar, Coins } from 'lucide-react';
import type { GameDate, Team } from '../../shared/domain';
import { ACCENT_MUTED_BUTTON_CLASSES, ACCENT_MUTED_BUTTON_STYLE } from '../utils/theme-styles';
import { AdvanceWeekButton } from './AdvanceWeekButton';

interface TopBarProps {
  sectionLabel: string;
  subItemLabel: string;
  currentDate: GameDate | null;
  playerTeam: Team | null;
}

export function TopBar({ sectionLabel, subItemLabel, currentDate, playerTeam }: TopBarProps) {
  return (
    <header className="top-bar flex items-center justify-between h-16 px-6 surface-primary border-b border-subtle">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight text-primary">
          {sectionLabel}
        </h1>
        <span className="text-secondary">/</span>
        <span className="text-base font-medium text-secondary">
          {subItemLabel}
        </span>
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
        >
          <Calendar size={16} />
          <span>
            {currentDate
              ? `Week ${currentDate.week}, ${2024 + currentDate.season}`
              : '—'}
          </span>
        </button>

        {/* Advance Week Button */}
        <AdvanceWeekButton />
      </div>
    </header>
  );
}
