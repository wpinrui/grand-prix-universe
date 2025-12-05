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

/**
 * Primary accent button - prominent actions, selected states
 */
export const ACCENT_BUTTON_STYLE: CSSProperties = {
  backgroundColor: 'var(--accent-600)',
  color: 'var(--accent-contrast)',
  boxShadow: '0 0 15px color-mix(in srgb, var(--accent-500) 40%, transparent)',
};

/**
 * Muted accent button - secondary actions
 */
export const ACCENT_MUTED_BUTTON_STYLE: CSSProperties = {
  backgroundColor: 'var(--accent-900)',
  color: 'var(--accent-300)',
  borderColor: 'var(--accent-800)',
};

/**
 * Ghost accent button - tertiary actions, hover reveals accent
 */
export const ACCENT_GHOST_BUTTON_STYLE: CSSProperties = {
  backgroundColor: 'transparent',
  color: 'var(--accent-400)',
  borderColor: 'var(--accent-700)',
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

/**
 * Bright accent text - extra emphasis
 */
export const ACCENT_TEXT_BRIGHT_STYLE: CSSProperties = {
  color: 'var(--accent-300)',
};

/**
 * Muted accent text - subtle accent
 */
export const ACCENT_TEXT_MUTED_STYLE: CSSProperties = {
  color: 'var(--accent-600)',
};

// ===========================================
// SURFACE & CARD STYLES
// ===========================================

/**
 * Card with subtle accent tint
 */
export const ACCENT_CARD_STYLE: CSSProperties = {
  borderColor: 'var(--accent-800)',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 0 15px color-mix(in srgb, var(--accent-600) 15%, transparent)',
};

/**
 * Card with stronger accent presence
 */
export const ACCENT_CARD_STRONG_STYLE: CSSProperties = {
  borderColor: 'var(--accent-700)',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 0 20px color-mix(in srgb, var(--accent-500) 25%, transparent)',
};

// ===========================================
// BORDER STYLES
// ===========================================

/**
 * Subtle accent border
 */
export const ACCENT_BORDER_STYLE: CSSProperties = {
  borderColor: 'var(--accent-800)',
};

/**
 * Accent border with glow
 */
export const ACCENT_BORDER_GLOW_STYLE: CSSProperties = {
  borderColor: 'var(--accent-600)',
  boxShadow: '0 0 10px color-mix(in srgb, var(--accent-500) 30%, transparent)',
};

// ===========================================
// PROGRESS BAR FILL STYLES
// ===========================================

/**
 * Accent-colored progress fill
 */
export const ACCENT_PROGRESS_STYLE: CSSProperties = {
  backgroundColor: 'var(--accent-500)',
  boxShadow: '0 0 8px color-mix(in srgb, var(--accent-500) 50%, transparent)',
};

// ===========================================
// NAV INDICATOR STYLES
// ===========================================

/**
 * Active nav indicator bar
 */
export const ACCENT_NAV_INDICATOR_STYLE: CSSProperties = {
  backgroundColor: 'var(--accent-500)',
  boxShadow: '0 0 10px var(--accent-500)',
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

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Merge base styles with accent styles conditionally
 */
export function withAccent(
  baseStyles: CSSProperties,
  accentStyles: CSSProperties,
  condition: boolean
): CSSProperties {
  return condition ? { ...baseStyles, ...accentStyles } : baseStyles;
}

/**
 * CSS variable getter for dynamic accent shades
 */
export function accentVar(shade: number): string {
  return `var(--accent-${shade})`;
}
