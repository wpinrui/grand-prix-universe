import { Calendar } from 'lucide-react';
import type { GameDate, Team } from '../../shared/domain';

interface TopBarProps {
  sectionLabel: string;
  subItemLabel: string | undefined;
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
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer transition-colors"
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
        <div className="text-xl font-semibold text-green-400">
          {playerTeam ? `$${playerTeam.budget.toLocaleString()}` : '—'}
        </div>
      </div>
    </header>
  );
}
