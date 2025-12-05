import type { Section, SubItem } from '../navigation';

interface SectionButtonProps {
  section: Section;
  isSelected: boolean;
  onClick: () => void;
}

export function SectionButton({ section, isSelected, onClick }: SectionButtonProps) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
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

export function SubNavButton({ subItem, isSelected, onClick }: SubNavButtonProps) {
  const Icon = subItem.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{subItem.label}</span>
    </button>
  );
}
