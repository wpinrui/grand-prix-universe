/**
 * News Generator Service
 *
 * Generates daily news headlines for the News screen.
 * Creates a living, breathing F1 world with abundant coverage.
 *
 * This module provides:
 * - Context building for news generation
 * - Helper functions for creating news headlines and quotes
 * - Entry point for daily news generation (called by turn processor)
 *
 * Content generators are added in subsequent PRs:
 * - PR 5: Race coverage
 * - PR 6: Pre-season & analysis
 * - PR 7: Rumors & commentary
 */

import { randomUUID } from 'crypto';
import type {
  GameState,
  GameDate,
  CalendarEvent,
  CalendarEntry,
  NewsQuote,
  Driver,
  Chief,
  Team,
} from '../../shared/domain';
import {
  CalendarEventType,
  NewsSource,
  NewsCategory,
  GamePhase,
  ChiefRole,
} from '../../shared/domain';
import type { EventImportance } from '../../shared/domain/types';
import { daysBetween } from '../../shared/utils/date-utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context provided to news generators
 * Contains all information needed to generate contextual news
 */
export interface NewsGenerationContext {
  state: GameState;
  currentDate: GameDate;
  upcomingRaces: CalendarEntry[]; // Next 3 races
  recentRaces: CalendarEntry[]; // Last 3 completed races
  dayOfYear: number; // 1-365
  isPreSeason: boolean;
  isPostSeason: boolean;
  isRacingSeason: boolean;
  playerTeamId: string;
}

/**
 * Parameters for creating a news headline
 */
export interface CreateHeadlineParams {
  date: GameDate;
  source: NewsSource;
  category: NewsCategory;
  subject: string;
  body: string;
  quotes?: NewsQuote[];
  importance?: EventImportance;
}

// =============================================================================
// CONTEXT BUILDING
// =============================================================================

/**
 * Build the news generation context from current game state
 */
export function buildNewsContext(state: GameState): NewsGenerationContext {
  const currentDate = state.currentDate;
  const calendar = state.currentSeason.calendar;

  // Calculate day of year (1-365)
  const dayOfYear = getDayOfYear(currentDate);

  // Find upcoming races (not yet completed, sorted by week)
  const upcomingRaces = calendar
    .filter((entry) => !entry.completed)
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .slice(0, 3);

  // Find recent completed races (sorted by week descending)
  const recentRaces = calendar
    .filter((entry) => entry.completed)
    .sort((a, b) => b.weekNumber - a.weekNumber)
    .slice(0, 3);

  return {
    state,
    currentDate,
    upcomingRaces,
    recentRaces,
    dayOfYear,
    isPreSeason: state.phase === GamePhase.PreSeason,
    isPostSeason: state.phase === GamePhase.PostSeason,
    isRacingSeason: state.phase === GamePhase.BetweenRaces || state.phase === GamePhase.RaceWeekend,
    playerTeamId: state.player.teamId,
  };
}

/**
 * Get day of year (1-365) from a GameDate
 */
function getDayOfYear(date: GameDate): number {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let dayOfYear = date.day;
  for (let m = 0; m < date.month - 1; m++) {
    dayOfYear += daysInMonth[m];
  }
  return dayOfYear;
}

// =============================================================================
// HEADLINE CREATION
// =============================================================================

/**
 * Create a news headline CalendarEvent
 */
export function createNewsHeadline(params: CreateHeadlineParams): CalendarEvent {
  return {
    id: randomUUID(),
    date: params.date,
    type: CalendarEventType.Headline,
    subject: params.subject,
    body: params.body,
    critical: false, // News never stops simulation
    newsSource: params.source,
    newsCategory: params.category,
    quotes: params.quotes,
    importance: params.importance ?? 'medium',
  };
}

// =============================================================================
// QUOTE CREATION
// =============================================================================

/**
 * Create a named quote from a known person (driver, chief, principal)
 */
export function createNamedQuote(
  text: string,
  person: { firstName: string; lastName: string },
  role: string
): NewsQuote {
  return {
    text,
    attribution: `${person.firstName} ${person.lastName}`,
    attributionRole: role,
    isNamed: true,
  };
}

/**
 * Create a quote from a driver
 */
export function createDriverQuote(text: string, driver: Driver, team: Team): NewsQuote {
  return createNamedQuote(text, driver, `${team.shortName} Driver`);
}

/**
 * Create a quote from a team principal
 * Uses the team's shortName as the role since we don't have individual principals
 */
export function createPrincipalQuote(text: string, team: Team): NewsQuote {
  // Use team name as attribution since principals aren't modeled separately
  return {
    text,
    attribution: `${team.shortName} Team Principal`,
    isNamed: true,
  };
}

/**
 * Create a quote from a department chief
 */
export function createChiefQuote(text: string, chief: Chief, team: Team): NewsQuote {
  const roleTitle = getChiefRoleTitle(chief.role);
  return createNamedQuote(text, chief, `${team.shortName} ${roleTitle}`);
}

/**
 * Get display title for a chief role
 */
function getChiefRoleTitle(role: ChiefRole): string {
  switch (role) {
    case ChiefRole.Designer:
      return 'Chief Designer';
    case ChiefRole.Mechanic:
      return 'Chief Mechanic';
    case ChiefRole.Commercial:
      return 'Commercial Director';
    default:
      return 'Chief';
  }
}

/**
 * Create an anonymous source quote
 */
export function createAnonymousQuote(
  text: string,
  sourceDescription: string = 'sources close to the team'
): NewsQuote {
  return {
    text,
    attribution: sourceDescription,
    isNamed: false,
  };
}

// =============================================================================
// DAILY NEWS GENERATION
// =============================================================================

/**
 * Generate daily news for the current game state
 * Called by turn processor after each day advances
 *
 * Returns array of CalendarEvents to add to state.calendarEvents
 */
export function generateDailyNews(state: GameState): CalendarEvent[] {
  // Build context for news generators
  // @agent: Context will be used when content generators are added in PRs 5-7
  const _context = buildNewsContext(state);
  const news: CalendarEvent[] = [];

  // Content generators will be added in subsequent PRs:
  // - PR 5: Race coverage (preview, predictions, local media)
  // - PR 6: Pre-season & analysis (season preview, rankings, hot seat)
  // - PR 7: Rumors & commentary (transfer rumors, netizen roundups)
  //
  // Generators will use: news.push(...generateRaceCoverage(_context));

  return news;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if today is N days before a race
 * Useful for triggering pre-race content
 */
export function isDaysBeforeRace(
  context: NewsGenerationContext,
  race: CalendarEntry,
  daysBefore: number
): boolean {
  const raceDate = getRaceDate(context.state.currentDate.year, race.weekNumber);
  const diff = daysBetween(context.currentDate, raceDate);
  return diff === daysBefore;
}

/**
 * Get the race date (Sunday) from week number
 */
function getRaceDate(year: number, weekNumber: number): GameDate {
  // Race is on Sunday of the given week
  // Week 1 starts on Jan 1, so week N starts on day (N-1)*7 + 1
  const startDay = (weekNumber - 1) * 7 + 1;
  // Sunday is day 7 of the week
  const raceDayOfYear = startDay + 6;

  // Convert day of year to month/day
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let remaining = raceDayOfYear;

  for (let m = 0; m < 12; m++) {
    if (remaining <= daysInMonth[m]) {
      return { year, month: m + 1, day: remaining };
    }
    remaining -= daysInMonth[m];
  }

  // Shouldn't reach here for valid week numbers
  return { year, month: 12, day: 31 };
}

/**
 * Pick a random item from an array
 */
export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Check probability (0-1 range)
 */
export function checkProbability(probability: number): boolean {
  return Math.random() < probability;
}
