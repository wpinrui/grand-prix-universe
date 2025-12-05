import { Check, Flag } from 'lucide-react';
import type { Section } from '../navigation';
import type { Team, CalendarEntry } from '../../shared/domain';
import { TeamBadge } from './TeamBadge';
import { SubNavButton, IconButton } from './NavButtons';

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
    <footer className="bottom-bar flex items-center h-16 px-5 surface-primary border-t border-subtle">
      {/* Team Badge */}
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
      <div className="flex items-center gap-3 mr-4">
        <Flag size={16} className="text-secondary" />
        <div className="text-sm">
          {nextRace ? (
            <span className="font-medium text-secondary">
              ROUND {nextRace.raceNumber}
            </span>
          ) : (
            <span className="text-muted">NO RACES</span>
          )}
        </div>
      </div>

      {/* Advance Button */}
      <IconButton
        icon={Check}
        onClick={() => {}}
        title="Advance Week"
        variant="accent"
        size="lg"
      />
    </footer>
  );
}
