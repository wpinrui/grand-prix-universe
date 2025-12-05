/**
 * Route path constants for the application.
 * Single source of truth for all route paths - prevents typos and enables
 * compile-time checking when routes are renamed.
 */
export const RoutePaths = {
  TITLE: '/',
  PLAYER_NAME: '/player-name',
  TEAM_SELECT: '/team-select',
  LOAD_GAME: '/load-game',
  GAME: '/game',
} as const;
