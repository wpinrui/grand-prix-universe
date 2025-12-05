import type { CSSProperties } from 'react';
import { Calendar, DollarSign } from 'lucide-react';
import type { GameDate, Team } from '../../shared/domain';
import { ACCENT_TEXT_STYLE, ACCENT_MUTED_BUTTON_STYLE } from '../utils/theme-styles';

interface TopBarProps {
  sectionLabel: string;
  subItemLabel: string;
  currentDate: GameDate | null;
  playerTeam: Team | null;
}

export function TopBar({ sectionLabel, subItemLabel, currentDate, playerTeam }: TopBarProps) {
  const calendarButtonStyle: CSSProperties = {
    ...ACCENT_MUTED_BUTTON_STYLE,
    border: '1px solid var(--accent-800)',
  };

  const budgetStyle: CSSProperties = {
    ...ACCENT_TEXT_STYLE,
    textShadow: '0 0 20px color-mix(in srgb, var(--accent-400) 30%, transparent)',
  };

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

      {/* Right side: Calendar & Budget */}
      <div className="flex items-center gap-4">
        {/* Calendar Button */}
        <button
          type="button"
          className="btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110"
          style={calendarButtonStyle}
          title="View Calendar"
        >
          <Calendar size={16} />
          <span>
            {currentDate
              ? `Week ${currentDate.week}, S${currentDate.season}`
              : '—'}
          </span>
        </button>

        {/* Budget Display */}
        <div
          className="flex items-center gap-2 text-xl font-bold tabular-nums"
          style={budgetStyle}
        >
          <DollarSign size={18} className="opacity-70" />
          <span>
            {playerTeam ? playerTeam.budget.toLocaleString() : '—'}
          </span>
        </div>
      </div>
    </header>
  );
}
