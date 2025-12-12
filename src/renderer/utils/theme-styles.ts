/**
 * Theme style constants for UI components
 *
 * These use CSS custom properties set by useTeamTheme.
 * Centralizes common styling patterns for accent-colored elements.
 */

import type { CSSProperties } from 'react';
import { NewsSource } from '../../shared/domain';

// ===========================================
// ACCENT BUTTON STYLES
// ===========================================

/** Base accent button style (internal use) */
const ACCENT_BUTTON_BASE: CSSProperties = {
  backgroundColor: 'var(--accent-600)',
  color: 'var(--accent-contrast)',
  boxShadow: '0 0 15px color-mix(in srgb, var(--accent-500) 40%, transparent)',
};

/**
 * Primary accent button with visible border - for buttons that need border definition
 */
export const ACCENT_BORDERED_BUTTON_STYLE: CSSProperties = {
  ...ACCENT_BUTTON_BASE,
  borderColor: 'var(--accent-500)',
};

/**
 * Muted accent button - secondary actions (calendar button, etc.)
 */
export const ACCENT_MUTED_BUTTON_STYLE: CSSProperties = {
  backgroundColor: 'var(--accent-900)',
  color: 'var(--accent-300)',
  borderColor: 'var(--accent-800)',
};

// ===========================================
// ACCENT TEXT STYLES
// ===========================================

/**
 * Primary accent text - important values, highlights
 */
export const ACCENT_TEXT_STYLE: CSSProperties = {
  color: 'var(--accent-400)',
};

// ===========================================
// CARD STYLES
// ===========================================

/**
 * Card with subtle accent tint
 */
export const ACCENT_CARD_STYLE: CSSProperties = {
  borderColor: 'var(--accent-800)',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 0 15px color-mix(in srgb, var(--accent-600) 15%, transparent)',
};

// ===========================================
// BUTTON CLASS CONSTANTS
// ===========================================

/** Shared base classes for bordered buttons */
export const BORDERED_BUTTON_BASE = 'btn rounded-lg cursor-pointer transition-all duration-200 border';

/**
 * Primary action button - emerald CTA (New Game, OK, Start, etc.)
 */
export const PRIMARY_BUTTON_CLASSES =
  'btn px-6 py-2 font-semibold bg-emerald-600 text-white border border-emerald-500 rounded-lg cursor-pointer hover:bg-emerald-500 disabled:bg-[var(--neutral-700)] disabled:border-[var(--neutral-600)] disabled:text-muted disabled:cursor-not-allowed transition-all duration-200';

/**
 * Primary accent button classes - for main accent actions
 */
export const ACCENT_BUTTON_CLASSES = `${BORDERED_BUTTON_BASE} font-semibold hover:brightness-110 flex items-center gap-2`;

/**
 * Muted accent button classes - for secondary accent actions (calendar, etc.)
 */
export const ACCENT_MUTED_BUTTON_CLASSES = `${BORDERED_BUTTON_BASE} text-sm font-medium hover:brightness-110 flex items-center gap-2`;

/**
 * Ghost button - secondary actions (Back, Cancel, etc.)
 */
export const GHOST_BUTTON_CLASSES =
  'btn px-4 py-2 cursor-pointer text-secondary hover:text-primary transition-colors';

/**
 * Ghost button with border - nav buttons, icon buttons in unselected state
 */
export const GHOST_BORDERED_BUTTON_CLASSES =
  'cursor-pointer bg-[var(--neutral-800)] border-[var(--neutral-700)] text-secondary hover:bg-[var(--neutral-750)] hover:text-primary hover:border-[var(--neutral-600)]';

/**
 * Danger button - destructive actions (Delete confirmation, etc.)
 */
export const DANGER_BUTTON_CLASSES =
  'btn px-4 py-2 font-semibold bg-red-600 text-white border border-red-500 rounded-lg cursor-pointer hover:bg-red-500 transition-all duration-200';

/**
 * Warning button - caution actions (Restart, etc.)
 */
export const WARNING_BUTTON_CLASSES =
  'btn px-4 py-2 font-semibold bg-amber-600 text-white border border-amber-500 rounded-lg cursor-pointer hover:bg-amber-500 transition-all duration-200';

/**
 * Icon button - success variant (Load, Download, etc.)
 */
export const ICON_BUTTON_SUCCESS_CLASSES =
  'btn p-2 rounded-lg cursor-pointer bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 disabled:opacity-50 transition-all';

/**
 * Icon button - danger variant (Delete, Remove, etc.)
 */
export const ICON_BUTTON_DANGER_CLASSES =
  'btn p-2 rounded-lg cursor-pointer bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-all';

/**
 * Icon button - neutral variant (Expand, Toggle, etc.)
 */
export const ICON_BUTTON_NEUTRAL_CLASSES =
  'btn p-2 rounded-lg cursor-pointer bg-neutral-700/50 text-secondary hover:bg-neutral-700 hover:text-primary transition-all';

/**
 * Icon button - ghost variant (panel controls, minimal buttons)
 */
export const ICON_BUTTON_GHOST_CLASSES =
  'rounded cursor-pointer hover:bg-[var(--neutral-700)] text-secondary hover:text-primary transition-colors';

// ===========================================
// ALERT CLASS CONSTANTS
// ===========================================

/**
 * Error alert - for error messages and failure feedback
 */
export const ERROR_ALERT_CLASSES =
  'card p-3 bg-red-600/20 border-red-600/30 text-red-300 text-sm';

/**
 * Success alert - for success messages and confirmation feedback
 */
export const SUCCESS_ALERT_CLASSES =
  'card p-3 bg-emerald-600/20 border-emerald-600/30 text-emerald-300 text-sm';

// ===========================================
// LAYOUT CONSTANTS
// ===========================================

/** Height of the calendar panel (used by SimulationOverlay and CalendarPreviewPanel) */
export const CALENDAR_PANEL_HEIGHT = 300;

// ===========================================
// PANEL STYLE CONSTANTS
// ===========================================

/** Translucent panel background with blur effect */
export const PANEL_TRANSLUCENT_BG_CLASSES = 'bg-[var(--neutral-900)]/80 backdrop-blur-sm';

/** Standard panel footer styling */
export const PANEL_FOOTER_CLASSES = 'px-4 py-2 border-t border-[var(--neutral-700)] bg-[var(--neutral-850)]';

// ===========================================
// TABLE STYLE CONSTANTS
// ===========================================

/** Base cell padding for tables */
export const TABLE_CELL_BASE = 'px-4 py-3';

/** Table header row container */
export const TABLE_HEADER_CLASS = 'surface-inset border-b border-[var(--neutral-600)]';

/** Table header row text styling */
export const TABLE_HEADER_ROW_CLASS = 'text-xs font-semibold text-muted uppercase tracking-wider';

/** Table body with dividers */
export const TABLE_BODY_CLASS = 'divide-y divide-[var(--neutral-700)]';

// ===========================================
// CALENDAR EVENT BADGE STYLES
// ===========================================

/** Email event badge (emerald) - design notifications, department emails */
export const EVENT_BADGE_EMAIL_CLASSES =
  'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50';

/** Projection event badge (sky, dashed) - estimated future completions */
export const EVENT_BADGE_PROJECTION_CLASSES =
  'bg-sky-900/30 text-sky-300/80 border border-dashed border-sky-700/50';

/** Default event badge (neutral) - other events */
export const EVENT_BADGE_DEFAULT_CLASSES =
  'bg-[var(--neutral-750)] text-muted';

// ===========================================
// TABLE ROW HIGHLIGHT STYLES
// ===========================================

export interface HighlightedRowStyles {
  rowStyle: CSSProperties;
  rowClass: string;
  nameStyle: CSSProperties;
}

/**
 * Get styles for a highlighted table row (player's team, next race, etc.)
 * Used by Championship and Races tables.
 */
export function getHighlightedRowStyles(isHighlighted: boolean): HighlightedRowStyles {
  return {
    rowStyle: isHighlighted ? ACCENT_CARD_STYLE : {},
    rowClass: isHighlighted ? 'bg-[var(--accent-900)]/30' : '',
    nameStyle: isHighlighted ? ACCENT_TEXT_STYLE : {},
  };
}

// ===========================================
// NEWS SOURCE STYLING
// ===========================================

/**
 * Styling configuration for news sources
 * Each source has distinct colors to visually differentiate them in the News UI
 */
export interface NewsSourceStyle {
  label: string; // Display name
  bgClass: string; // Background color class
  textClass: string; // Text color class
  borderClass: string; // Border color class
}

/**
 * News source styling configuration
 * Maps NewsSource enum values to visual styling
 */
export const NEWS_SOURCE_STYLES: Record<NewsSource, NewsSourceStyle> = {
  [NewsSource.F1Official]: {
    label: 'F1 Official',
    bgClass: 'bg-red-600/20',
    textClass: 'text-red-400',
    borderClass: 'border-red-600/30',
  },
  [NewsSource.TheRace]: {
    label: 'The Race',
    bgClass: 'bg-purple-600/20',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-600/30',
  },
  [NewsSource.LocalMedia]: {
    label: 'Local Media',
    bgClass: 'bg-teal-600/20',
    textClass: 'text-teal-400',
    borderClass: 'border-teal-600/30',
  },
  [NewsSource.PitlaneInsider]: {
    label: 'Pitlane Insider',
    bgClass: 'bg-orange-600/20',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-600/30',
  },
  [NewsSource.TechAnalysis]: {
    label: 'Tech Analysis',
    bgClass: 'bg-blue-600/20',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-600/30',
  },
  [NewsSource.PaddockRumors]: {
    label: 'Paddock Rumors',
    bgClass: 'bg-amber-600/20',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-600/30',
  },
  [NewsSource.FanVoice]: {
    label: 'Fan Voice',
    bgClass: 'bg-pink-600/20',
    textClass: 'text-pink-400',
    borderClass: 'border-pink-600/30',
  },
};

/**
 * Get combined badge classes for a news source
 * Returns Tailwind classes for a styled badge/pill
 */
export function getNewsSourceBadgeClasses(source: NewsSource): string {
  const style = NEWS_SOURCE_STYLES[source];
  return `${style.bgClass} ${style.textClass} ${style.borderClass} border`;
}
