/**
 * Route path constants for the application.
 * Single source of truth for all route paths - prevents typos and enables
 * compile-time checking when routes are renamed.
 */
export const RoutePaths = {
  TITLE: '/',
  TEAM_SELECT: '/team-select',
  GAME: '/game',
} as const;
