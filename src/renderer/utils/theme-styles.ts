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

/**
 * Primary action button - emerald CTA (New Game, OK, Start, etc.)
 */
export const PRIMARY_BUTTON_CLASSES =
  'btn px-6 py-2 font-semibold bg-emerald-600 text-white border border-emerald-500 rounded-lg hover:bg-emerald-500 disabled:bg-[var(--neutral-700)] disabled:border-[var(--neutral-600)] disabled:text-muted disabled:cursor-not-allowed transition-all duration-200';

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
