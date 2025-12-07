/**
 * Theme style constants for UI components
 *
 * These use CSS custom properties set by useTeamTheme.
 * Centralizes common styling patterns for accent-colored elements.
 */

import type { CSSProperties } from 'react';

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
export const BORDERED_BUTTON_BASE = 'btn rounded-lg transition-all duration-200 border';

/**
 * Primary action button - emerald CTA (New Game, OK, Start, etc.)
 */
export const PRIMARY_BUTTON_CLASSES =
  'btn px-6 py-2 font-semibold bg-emerald-600 text-white border border-emerald-500 rounded-lg hover:bg-emerald-500 disabled:bg-[var(--neutral-700)] disabled:border-[var(--neutral-600)] disabled:text-muted disabled:cursor-not-allowed transition-all duration-200';

/**
 * Primary accent button style - for main accent actions (Advance Week, etc.)
 */
export const ACCENT_BUTTON_STYLE: CSSProperties = {
  backgroundColor: 'var(--accent-600)',
  color: 'var(--accent-contrast)',
  borderColor: 'var(--accent-500)',
  boxShadow: '0 0 15px color-mix(in srgb, var(--accent-500) 40%, transparent)',
};

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
  'btn px-4 py-2 text-secondary hover:text-primary transition-colors';

/**
 * Ghost button with border - nav buttons, icon buttons in unselected state
 */
export const GHOST_BORDERED_BUTTON_CLASSES =
  'bg-[var(--neutral-800)] border-[var(--neutral-700)] text-secondary hover:bg-[var(--neutral-750)] hover:text-primary hover:border-[var(--neutral-600)]';

/**
 * Danger button - destructive actions (Delete confirmation, etc.)
 */
export const DANGER_BUTTON_CLASSES =
  'btn px-4 py-2 font-semibold bg-red-600 text-white border border-red-500 rounded-lg hover:bg-red-500 transition-all duration-200';

/**
 * Warning button - caution actions (Restart, etc.)
 */
export const WARNING_BUTTON_CLASSES =
  'btn px-4 py-2 font-semibold bg-amber-600 text-white border border-amber-500 rounded-lg hover:bg-amber-500 transition-all duration-200';

/**
 * Icon button - success variant (Load, Download, etc.)
 */
export const ICON_BUTTON_SUCCESS_CLASSES =
  'btn p-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 disabled:opacity-50 transition-all';

/**
 * Icon button - danger variant (Delete, Remove, etc.)
 */
export const ICON_BUTTON_DANGER_CLASSES =
  'btn p-2 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-all';

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
