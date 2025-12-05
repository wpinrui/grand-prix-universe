import { Calendar } from 'lucide-react';
import type { GameDate, Team } from '../../shared/domain';
import { ACCENT_MUTED_BUTTON_STYLE, ACCENT_TEXT_STYLE } from '../utils/color-palette';

interface TopBarProps {
  sectionLabel: string;
  subItemLabel: string;
  currentDate: GameDate | null;
  playerTeam: Team | null;
}

export function TopBar({ sectionLabel, subItemLabel, currentDate, playerTeam }: TopBarProps) {
  return (
    <header className="top-bar flex items-center justify-between h-14 px-5 bg-gray-800 border-b border-gray-700">
      <div className="text-xl font-semibold">
        {sectionLabel}: {subItemLabel}
      </div>
      <div className="flex items-center gap-4">
        {/* Calendar Button */}
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors"
          style={ACCENT_MUTED_BUTTON_STYLE}
          title="Calendar"
        >
          <Calendar size={18} />
          <span className="text-sm">
            {currentDate
              ? `Week ${currentDate.week}, Season ${currentDate.season}`
              : '—'}
          </span>
        </button>
        {/* Budget */}
        <div className="text-xl font-semibold" style={ACCENT_TEXT_STYLE}>
          {playerTeam ? `$${playerTeam.budget.toLocaleString()}` : '—'}
        </div>
      </div>
    </header>
  );
}
