import type { Section, SubItem } from '../navigation';

interface SectionButtonProps {
  section: Section;
  isSelected: boolean;
  onClick: () => void;
}

const SECTION_BASE_STYLES = 'flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors';
const SECTION_UNSELECTED = 'text-gray-400 hover:bg-gray-700 hover:text-white';

export function SectionButton({ section, isSelected, onClick }: SectionButtonProps) {
  const Icon = section.icon;
  const className = `${SECTION_BASE_STYLES} ${isSelected ? '' : SECTION_UNSELECTED}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={isSelected ? { backgroundColor: 'var(--accent-600)', color: 'var(--accent-contrast)' } : undefined}
    >
      <Icon size={24} />
      <span className="text-sm font-medium">{section.label}</span>
    </button>
  );
}

interface SubNavButtonProps {
  subItem: SubItem;
  isSelected: boolean;
  onClick: () => void;
}

const SUBNAV_BASE_STYLES = 'flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors';
const SUBNAV_UNSELECTED = 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white';

export function SubNavButton({ subItem, isSelected, onClick }: SubNavButtonProps) {
  const Icon = subItem.icon;
  const className = `${SUBNAV_BASE_STYLES} ${isSelected ? '' : SUBNAV_UNSELECTED}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={isSelected ? { backgroundColor: 'var(--accent-600)', color: 'var(--accent-contrast)' } : undefined}
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{subItem.label}</span>
    </button>
  );
}
