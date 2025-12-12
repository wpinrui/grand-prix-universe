/**
 * Shared UI primitives for content screens (Staff, Cars, etc.)
 */

import { ACCENT_TEXT_STYLE, ACCENT_BORDERED_BUTTON_STYLE, GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/** Returns color class based on 0-100 percentage value (green to red scale) */
export function getPercentageColorClass(value: number): string {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-lime-500';
  if (value >= 40) return 'bg-amber-500';
  if (value >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

// ===========================================
// SUMMARY STAT
// ===========================================

interface SummaryStatProps {
  label: string;
  value: React.ReactNode;
}

/** Large stat display for summary cards */
export function SummaryStat({ label, value }: SummaryStatProps) {
  return (
    <div>
      <div className="text-sm font-medium text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-3xl font-bold" style={ACCENT_TEXT_STYLE}>
        {value}
      </div>
    </div>
  );
}

// ===========================================
// DETAIL ROW
// ===========================================

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

/** Key-value row for detail cards */
export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div>
      <span className="text-muted">{label}:</span>{' '}
      <span className="text-secondary">{value}</span>
    </div>
  );
}

// ===========================================
// PROGRESS BAR
// ===========================================

interface ProgressBarProps {
  value: number;
  colorClass?: string;
}

/** Horizontal progress bar with percentage display */
export function ProgressBar({ value, colorClass }: ProgressBarProps) {
  const barColor = colorClass ?? getPercentageColorClass(value);
  const roundedValue = Math.round(value);

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-[var(--neutral-700)] rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted w-8">{roundedValue}%</span>
    </div>
  );
}

// ===========================================
// CENTERED MESSAGE
// ===========================================

interface CenteredMessageProps {
  children: React.ReactNode;
}

/** Full-height centered message for loading/error/empty states */
export function CenteredMessage({ children }: CenteredMessageProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-secondary">{children}</p>
    </div>
  );
}

// ===========================================
// TAB BAR
// ===========================================

export interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabBadge<T extends string> {
  tabId: T;
  count: number;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  /** Optional badge to show notification count on a specific tab */
  badge?: TabBadge<T>;
}

/** Horizontal tab bar using team accent colors */
export function TabBar<T extends string>({ tabs, activeTab, onTabChange, badge }: TabBarProps<T>) {
  return (
    <div className="flex gap-2 mb-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const badgeCount = badge?.tabId === tab.id ? badge.count : 0;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`btn px-5 py-2 text-sm font-medium cursor-pointer transition-all rounded-lg border relative ${
              isActive ? '' : GHOST_BORDERED_BUTTON_CLASSES
            }`}
            style={isActive ? ACCENT_BORDERED_BUTTON_STYLE : undefined}
          >
            {tab.label}
            {badgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-black text-xs font-bold px-1">
                {badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
