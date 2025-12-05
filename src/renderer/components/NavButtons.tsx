import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Section, SubItem } from '../navigation';
import { ACCENT_BUTTON_STYLE, ACCENT_NAV_INDICATOR_STYLE } from '../utils/theme-styles';

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

  const indicatorStyle: CSSProperties = isSelected
    ? ACCENT_NAV_INDICATOR_STYLE
    : {};

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
      {/* Active indicator bar */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r transition-all duration-200"
        style={{
          height: isSelected ? '100%' : '0%',
          ...indicatorStyle,
        }}
      />

      <Icon size={22} className="shrink-0" />
      <span className="text-sm font-semibold tracking-wide">{section.label}</span>
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

  const baseClasses = `
    btn flex items-center gap-2 px-3 py-2 rounded-lg
    text-sm font-medium transition-all duration-200
    border
  `;

  const stateClasses = isSelected
    ? ''
    : 'bg-[var(--neutral-800)] border-[var(--neutral-700)] text-secondary hover:bg-[var(--neutral-750)] hover:text-primary hover:border-[var(--neutral-600)]';

  const buttonStyle: CSSProperties = isSelected
    ? {
        ...ACCENT_BUTTON_STYLE,
        borderColor: 'var(--accent-500)',
      }
    : {};

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${stateClasses}`}
      style={buttonStyle}
    >
      <Icon size={18} />
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
  sm: { button: 'w-8 h-8', icon: 16 },
  md: { button: 'w-10 h-10', icon: 20 },
  lg: { button: 'w-12 h-12', icon: 24 },
} as const;

export function IconButton({
  icon: Icon,
  onClick,
  title,
  variant = 'accent',
  size = 'md',
}: IconButtonProps) {
  const sizeConfig = ICON_BUTTON_SIZES[size];

  const baseClasses = `
    btn ${sizeConfig.button} rounded-lg
    transition-all duration-200
    border
  `;

  const variantClasses = variant === 'ghost'
    ? 'bg-[var(--neutral-800)] border-[var(--neutral-700)] text-secondary hover:bg-[var(--neutral-750)] hover:text-primary'
    : '';

  const buttonStyle: CSSProperties = variant === 'accent'
    ? {
        ...ACCENT_BUTTON_STYLE,
        borderColor: 'var(--accent-500)',
      }
    : {};

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${variantClasses}`}
      style={buttonStyle}
      title={title}
    >
      <Icon size={sizeConfig.icon} />
    </button>
  );
}
