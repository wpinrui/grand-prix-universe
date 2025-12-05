import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Section, SubItem } from '../navigation';
import { ACCENT_BORDERED_BUTTON_STYLE, GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';

/** Shared base classes for bordered nav buttons */
const BORDERED_BUTTON_BASE = 'btn rounded-lg transition-all duration-200 border';

// ===========================================
// SECTION NAV BUTTON (Sidebar)
// ===========================================

interface SectionButtonProps {
  section: Section;
  isSelected: boolean;
  onClick: () => void;
}

export function SectionButton({ section, isSelected, onClick }: SectionButtonProps) {
  const Icon = section.icon;

  // Active state styling - CSS handles the indicator via .nav-item.active::before
  const buttonStyle: CSSProperties = isSelected
    ? {
        backgroundColor: 'color-mix(in srgb, var(--accent-600) 15%, transparent)',
        color: 'var(--accent-300)',
      }
    : {};

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        nav-item relative flex items-center gap-3 w-full px-4 py-3.5
        text-left cursor-pointer transition-all duration-200
        ${isSelected ? 'active' : 'text-secondary hover:text-primary'}
      `}
      style={buttonStyle}
    >
      <Icon size={24} className="shrink-0" />
      <span className="text-base font-semibold tracking-wide">{section.label}</span>
    </button>
  );
}

// ===========================================
// SUBNAV BUTTON (Bottom bar)
// ===========================================

interface SubNavButtonProps {
  subItem: SubItem;
  isSelected: boolean;
  onClick: () => void;
}

export function SubNavButton({ subItem, isSelected, onClick }: SubNavButtonProps) {
  const Icon = subItem.icon;
  const baseClasses = `${BORDERED_BUTTON_BASE} flex items-center gap-2 px-4 py-2.5 text-base font-medium`;
  const stateClasses = isSelected ? '' : GHOST_BORDERED_BUTTON_CLASSES;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${stateClasses}`}
      style={isSelected ? ACCENT_BORDERED_BUTTON_STYLE : undefined}
    >
      <Icon size={20} />
      <span>{subItem.label}</span>
    </button>
  );
}

// ===========================================
// ICON BUTTON (Standalone actions)
// ===========================================

interface IconButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  title?: string;
  variant?: 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const ICON_BUTTON_SIZES = {
  sm: { button: 'w-10 h-10', icon: 18 },
  md: { button: 'w-12 h-12', icon: 22 },
  lg: { button: 'w-14 h-14', icon: 28 },
} as const;

export function IconButton({
  icon: Icon,
  onClick,
  title,
  variant = 'accent',
  size = 'md',
}: IconButtonProps) {
  const sizeConfig = ICON_BUTTON_SIZES[size];
  const baseClasses = `${BORDERED_BUTTON_BASE} ${sizeConfig.button}`;
  const variantClasses = variant === 'ghost' ? GHOST_BORDERED_BUTTON_CLASSES : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${variantClasses}`}
      style={variant === 'accent' ? ACCENT_BORDERED_BUTTON_STYLE : undefined}
      title={title}
    >
      <Icon size={sizeConfig.icon} />
    </button>
  );
}
