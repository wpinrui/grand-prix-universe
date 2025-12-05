import type { LucideIcon } from 'lucide-react';
import type { Section, SubItem } from '../navigation';
import { ACCENT_BUTTON_STYLE } from '../utils/theme-styles';

// Variant-specific styling
const VARIANT_STYLES = {
  section: {
    base: 'flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors',
    unselected: 'text-gray-400 hover:bg-gray-700 hover:text-white',
    iconSize: 24,
  },
  subnav: {
    base: 'flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors',
    unselected: 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white',
    iconSize: 20,
  },
} as const;

type NavButtonVariant = keyof typeof VARIANT_STYLES;

interface NavButtonBaseProps {
  icon: LucideIcon;
  label: string;
  isSelected: boolean;
  onClick: () => void;
  variant: NavButtonVariant;
}

function NavButtonBase({ icon: Icon, label, isSelected, onClick, variant }: NavButtonBaseProps) {
  const styles = VARIANT_STYLES[variant];
  const className = `${styles.base} ${isSelected ? '' : styles.unselected}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={isSelected ? ACCENT_BUTTON_STYLE : undefined}
    >
      <Icon size={styles.iconSize} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

interface SectionButtonProps {
  section: Section;
  isSelected: boolean;
  onClick: () => void;
}

export function SectionButton({ section, isSelected, onClick }: SectionButtonProps) {
  return (
    <NavButtonBase
      icon={section.icon}
      label={section.label}
      isSelected={isSelected}
      onClick={onClick}
      variant="section"
    />
  );
}

interface SubNavButtonProps {
  subItem: SubItem;
  isSelected: boolean;
  onClick: () => void;
}

export function SubNavButton({ subItem, isSelected, onClick }: SubNavButtonProps) {
  return (
    <NavButtonBase
      icon={subItem.icon}
      label={subItem.label}
      isSelected={isSelected}
      onClick={onClick}
      variant="subnav"
    />
  );
}
