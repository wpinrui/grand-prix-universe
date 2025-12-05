/**
 * Theme style constants for UI components
 *
 * These use CSS custom properties set by useTeamTheme.
 * Centralizes common styling patterns for accent-colored elements.
 */

/**
 * Style for accent-colored buttons (selected states, primary actions)
 */
export const ACCENT_BUTTON_STYLE = {
  backgroundColor: 'var(--accent-600)',
  color: 'var(--accent-contrast)',
} as const;

/**
 * Style for muted accent buttons (secondary actions like calendar)
 */
export const ACCENT_MUTED_BUTTON_STYLE = {
  backgroundColor: 'var(--accent-800)',
  color: 'var(--accent-200)',
} as const;

/**
 * Style for accent-colored text (budget display, highlights)
 */
export const ACCENT_TEXT_STYLE = {
  color: 'var(--accent-400)',
} as const;
