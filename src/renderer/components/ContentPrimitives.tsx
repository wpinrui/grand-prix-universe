/**
 * Shared UI primitives for content screens (Staff, Cars, etc.)
 */

import { ACCENT_TEXT_STYLE } from '../utils/theme-styles';

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/** Returns color class based on 0-100 percentage value (green to red scale) */
export function getPercentageColorClass(value: number): string {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-lime-500';
  if (value >= 40) return 'bg-yellow-500';
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

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-[var(--neutral-700)] rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted w-8">{value}%</span>
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
