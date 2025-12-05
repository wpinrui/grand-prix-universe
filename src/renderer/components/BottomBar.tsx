import { Check } from 'lucide-react';
import type { Section } from '../navigation';
import type { Team, CalendarEntry } from '../../shared/domain';
import { TeamBadge } from './TeamBadge';
import { SubNavButton } from './NavButtons';

interface BottomBarProps {
  playerTeam: Team | null;
  selectedSection: Section;
  selectedSubItemId: string;
  onSubItemClick: (subItemId: string) => void;
  nextRace: CalendarEntry | null;
}

export function BottomBar({
  playerTeam,
  selectedSection,
  selectedSubItemId,
  onSubItemClick,
  nextRace,
}: BottomBarProps) {
  return (
    <footer className="bottom-bar flex items-center h-16 px-5 bg-gray-800 border-t border-gray-700">
      <TeamBadge team={playerTeam} />

      {/* Sub-navigation */}
      <nav className="sub-nav flex items-center ml-5 gap-2">
        {selectedSection.subItems.map((subItem) => (
          <SubNavButton
            key={subItem.id}
            subItem={subItem}
            isSelected={subItem.id === selectedSubItemId}
            onClick={() => onSubItemClick(subItem.id)}
          />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Next Race Info */}
      <div className="flex items-center gap-2 text-base text-gray-400 mr-5">
        {nextRace ? (
          <span>ROUND {nextRace.raceNumber}</span>
        ) : (
          <span>NO RACES</span>
        )}
      </div>

      {/* Advance Button */}
      <button
        type="button"
        className="flex items-center justify-center w-12 h-12 bg-green-600 hover:bg-green-500 rounded cursor-pointer transition-colors"
        title="Advance"
      >
        <Check size={28} />
      </button>
    </footer>
  );
}
