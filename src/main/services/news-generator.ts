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
  Circuit,
} from '../../shared/domain';
import {
  CalendarEventType,
  NewsSource,
  NewsCategory,
  GamePhase,
} from '../../shared/domain';
import type { EventImportance } from '../../shared/domain/types';
import { daysBetween } from '../../shared/utils/date-utils';
import { getFullName, CHIEF_ROLE_LABELS } from '../../shared/utils/format';

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
    attribution: getFullName(person),
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
  const roleTitle = CHIEF_ROLE_LABELS[chief.role];
  return createNamedQuote(text, chief, `${team.shortName} ${roleTitle}`);
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
  const context = buildNewsContext(state);
  const news: CalendarEvent[] = [];

  // Race coverage (PR 5)
  news.push(...generateRaceCoverage(context));

  // Pre-season & analysis content (PR 6)
  news.push(...generatePreSeasonAnalysis(context));

  // Content generators to be added in subsequent PRs:
  // - PR 7: Rumors & commentary (transfer rumors, netizen roundups)

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
 * @throws Error if array is empty
 */
export function pickRandom<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error('pickRandom called with empty array');
  }
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Check probability (0-1 range)
 */
export function checkProbability(probability: number): boolean {
  return Math.random() < probability;
}

// =============================================================================
// RACE COVERAGE GENERATORS (PR 5)
// =============================================================================

/**
 * Generate all race-related coverage for the day
 */
function generateRaceCoverage(context: NewsGenerationContext): CalendarEvent[] {
  const news: CalendarEvent[] = [];

  // Only generate during racing season
  if (!context.isRacingSeason) return news;

  const nextRace = context.upcomingRaces[0];
  if (!nextRace) return news;

  const circuit = context.state.circuits.find((c) => c.id === nextRace.circuitId);
  if (!circuit) return news;

  // Race preview - 2 days before race (Friday before Sunday)
  if (isDaysBeforeRace(context, nextRace, 2)) {
    const preview = generateRacePreview(context, nextRace, circuit);
    if (preview) news.push(preview);

    // Race predictions - also on Friday, different source
    const predictions = generateRacePredictions(context, nextRace, circuit);
    if (predictions) news.push(predictions);
  }

  // Local media coverage - 3 days before race (Thursday)
  if (isDaysBeforeRace(context, nextRace, 3)) {
    const localCoverage = generateLocalCoverage(context, nextRace, circuit);
    if (localCoverage) news.push(localCoverage);
  }

  return news;
}

/**
 * Generate race preview article (TheRace style)
 */
function generateRacePreview(
  context: NewsGenerationContext,
  race: CalendarEntry,
  circuit: Circuit
): CalendarEvent | null {
  const { state, currentDate } = context;
  const standings = state.currentSeason.driverStandings;

  // Get championship leader
  const leader = standings[0];
  const leaderDriver = state.drivers.find((d) => d.id === leader?.driverId);
  const leaderTeam = state.teams.find((t) => t.id === leader?.teamId);

  // Get second place for gap
  const second = standings[1];
  const gap = leader && second ? leader.points - second.points : 0;

  // Pick a template based on circuit characteristics
  const { subject, body } = pickRacePreviewContent(circuit, race, leaderDriver, gap);

  // Add a driver quote about the upcoming race
  const quotes: NewsQuote[] = [];
  if (leaderDriver && leaderTeam) {
    const quoteText = pickRandom(DRIVER_PREVIEW_QUOTES);
    quotes.push(createDriverQuote(quoteText, leaderDriver, leaderTeam));
  }

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.TheRace,
    category: NewsCategory.RacePreview,
    subject,
    body,
    quotes,
    importance: 'medium',
  });
}

/**
 * Generate race predictions article (TheRace opinionated style)
 */
function generateRacePredictions(
  context: NewsGenerationContext,
  _race: CalendarEntry, // @agent: unused but kept for consistency with other generators
  circuit: Circuit
): CalendarEvent | null {
  const { state, currentDate } = context;
  const standings = state.currentSeason.driverStandings;

  // Get top 3 for predictions
  const top3 = standings.slice(0, 3);
  const drivers = top3
    .map((s) => state.drivers.find((d) => d.id === s.driverId))
    .filter((d): d is Driver => d !== undefined);

  if (drivers.length < 3) return null;

  const { subject, body } = pickRacePredictionsContent(circuit, drivers);

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.TheRace,
    category: NewsCategory.RacePreview,
    subject,
    body,
    importance: 'low',
  });
}

/**
 * Generate local media coverage (regional flavor)
 */
function generateLocalCoverage(
  context: NewsGenerationContext,
  race: CalendarEntry,
  circuit: Circuit
): CalendarEvent | null {
  const { currentDate } = context;

  const { subject, body, senderName } = pickLocalCoverageContent(circuit, race.raceNumber);

  // Prepend the local paper name to the body for authenticity
  const bodyWithSource = `*${senderName}*\n\n${body}`;

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.LocalMedia,
    category: NewsCategory.RacePreview,
    subject,
    body: bodyWithSource,
    importance: 'low',
  });
}

// =============================================================================
// RACE COVERAGE TEMPLATES
// =============================================================================

type CircuitType = 'highspeed' | 'street' | 'technical' | 'balanced';

const DRIVER_PREVIEW_QUOTES = [
  "I'm feeling confident heading into this weekend. The car has been performing well and we've made some good progress.",
  "It's always a challenging circuit but one I really enjoy. We'll be pushing hard from FP1.",
  "The team has done a fantastic job preparing for this race. I think we can have a strong result.",
  "Every race is an opportunity. We're focused on maximizing our potential this weekend.",
  "The championship is tight but we're taking it one race at a time. This is a circuit that suits us.",
];

function pickRacePreviewContent(
  circuit: Circuit,
  race: CalendarEntry,
  leader: Driver | undefined,
  gap: number
): { subject: string; body: string } {
  const circuitType = getCircuitType(circuit);
  const leaderName = leader ? getFullName(leader) : 'The championship leader';

  const subjects = [
    `${circuit.name} Preview: All eyes on the ${circuit.country} GP`,
    `${circuit.country} GP Preview: ${leaderName} looks to extend lead`,
    `Race ${race.raceNumber} Preview: Can anyone challenge at ${circuit.location}?`,
  ];

  const bodyIntros = [
    `Formula One heads to ${circuit.location} this weekend for Round ${race.raceNumber} of the championship.`,
    `The paddock descends on ${circuit.country} this weekend as the championship battle continues.`,
    `${circuit.name} plays host to the next chapter of the ${circuit.country} Grand Prix.`,
  ];

  const circuitDescriptions: Record<CircuitType, string> = {
    street: `The tight and twisty street circuit will test driver precision, with overtaking at a premium.`,
    highspeed: `The high-speed layout will reward brave drivers, with several flat-out sections separating the brave from the cautious.`,
    technical: `The technical nature of the circuit means setup and driver skill will be crucial to finding lap time.`,
    balanced: `A balanced layout that rewards both straight-line speed and cornering ability awaits the drivers.`,
  };

  const championshipContext = gap > 0
    ? `${leaderName} arrives with a ${gap}-point advantage, looking to strengthen their championship position.`
    : `The championship is finely balanced heading into this crucial race weekend.`;

  return {
    subject: pickRandom(subjects),
    body: `${pickRandom(bodyIntros)}\n\n${circuitDescriptions[circuitType]}\n\n${championshipContext}`,
  };
}

function pickRacePredictionsContent(
  circuit: Circuit,
  topDrivers: Driver[]
): { subject: string; body: string } {
  const subjects = [
    `${circuit.country} GP Predictions: Who will top the podium?`,
    `Our ${circuit.name} predictions: Here's who we think will win`,
    `${circuit.country} GP: Three to watch this weekend`,
  ];

  const [d1, d2, d3] = topDrivers;
  const body = `As we approach race day at ${circuit.name}, here are our predictions for the weekend.\n\n` +
    `**Race Winner:** ${getFullName(d1)} - Current form and championship momentum make them the favorite.\n\n` +
    `**Podium Contender:** ${getFullName(d2)} - Has shown strong pace and will be pushing hard.\n\n` +
    `**Dark Horse:** ${getFullName(d3)} - Could spring a surprise if conditions play into their hands.`;

  return {
    subject: pickRandom(subjects),
    body,
  };
}

function pickLocalCoverageContent(
  circuit: Circuit,
  raceNumber: number
): { subject: string; body: string; senderName: string } {
  const localPapers: Record<string, string> = {
    'Monaco': 'Monaco Tribune',
    'Italy': 'Gazzetta dello Sport',
    'United Kingdom': 'The Guardian',
    'Spain': 'Marca',
    'Australia': 'The Herald Sun',
    'Japan': 'Nikkan Sports',
    'Brazil': 'Globo Esporte',
    'Mexico': 'Récord',
    'USA': 'ESPN',
    'default': `${circuit.country} Sports Daily`,
  };

  const senderName = localPapers[circuit.country] ?? localPapers['default'];

  const subjects = [
    `${circuit.location} prepares for Formula One's return`,
    `${circuit.country} GP: City buzzing with anticipation`,
    `Local excitement builds ahead of ${circuit.name} race weekend`,
  ];

  const bodies = [
    `The streets of ${circuit.location} are buzzing with excitement as Formula One prepares to visit for Round ${raceNumber} of the championship.\n\n` +
    `Hotels are reporting near-capacity bookings, with fans from around the world descending on the city. Local businesses are expecting a significant boost from the influx of visitors.\n\n` +
    `"It's always special when Formula One comes to town," said a local event organizer. "The atmosphere is electric and the whole city comes alive."`,

    `${circuit.location} is gearing up for what promises to be an exciting weekend of racing at ${circuit.name}.\n\n` +
    `The circuit has undergone preparations in recent weeks, with organizers promising an improved experience for spectators. The grandstands are expected to be packed for Sunday's main event.\n\n` +
    `Local authorities have confirmed traffic management plans will be in place throughout the weekend.`,
  ];

  return {
    subject: pickRandom(subjects),
    body: pickRandom(bodies),
    senderName,
  };
}

/**
 * Determine circuit type based on characteristics
 */
function getCircuitType(circuit: Circuit): CircuitType {
  const { speedRating, downforceRequirement, overtakingOpportunity } = circuit.characteristics;

  if (speedRating > 70 && overtakingOpportunity > 60) return 'highspeed';
  if (downforceRequirement > 70 && overtakingOpportunity < 40) return 'street';
  if (speedRating < 60 && downforceRequirement > 60) return 'technical';
  return 'balanced';
}

// =============================================================================
// PRE-SEASON & ANALYSIS GENERATORS (PR 6)
// =============================================================================

/**
 * Generate pre-season and analysis content for the day
 */
function generatePreSeasonAnalysis(context: NewsGenerationContext): CalendarEvent[] {
  const news: CalendarEvent[] = [];

  // Pre-season content
  if (context.isPreSeason) {
    // Season preview - once at start of pre-season (day 15 = mid-January)
    if (context.dayOfYear === 15) {
      const preview = generateSeasonPreview(context);
      if (preview) news.push(preview);
    }

    // Driver power rankings - later in pre-season (day 45 = mid-February)
    if (context.dayOfYear === 45) {
      const rankings = generateDriverRankings(context);
      if (rankings) news.push(rankings);
    }
  }

  // Mid-season analysis (during racing season)
  if (context.isRacingSeason) {
    const completedRaces = context.recentRaces.length;

    // Hot seat analysis - after race 5 and every 5 races thereafter
    if (completedRaces > 0 && completedRaces % 5 === 0) {
      // Only generate on specific day to avoid duplicates
      if (context.dayOfYear % 7 === 0) {
        const hotSeat = generateHotSeatAnalysis(context);
        if (hotSeat) news.push(hotSeat);
      }
    }

    // Team performance analysis - every ~30 days during season
    if (context.dayOfYear % 30 === 0 && completedRaces >= 3) {
      const performance = generateTeamPerformanceAnalysis(context);
      if (performance) news.push(performance);
    }
  }

  return news;
}

/**
 * Generate season preview article (F1 Official style)
 */
function generateSeasonPreview(context: NewsGenerationContext): CalendarEvent | null {
  const { state, currentDate } = context;
  const year = currentDate.year;

  // Get defending champion (if any)
  const prevSeasonStandings = state.currentSeason.driverStandings;
  const defendingChampion = prevSeasonStandings[0];
  const championDriver = defendingChampion
    ? state.drivers.find((d) => d.id === defendingChampion.driverId)
    : null;
  const championTeam = defendingChampion
    ? state.teams.find((t) => t.id === defendingChampion.teamId)
    : null;

  const { subject, body } = pickSeasonPreviewContent(year, championDriver, championTeam);

  const quotes: NewsQuote[] = [];
  if (championDriver && championTeam) {
    quotes.push(createDriverQuote(
      pickRandom(CHAMPION_PREVIEW_QUOTES),
      championDriver,
      championTeam
    ));
  }

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.F1Official,
    category: NewsCategory.PreSeason,
    subject,
    body,
    quotes,
    importance: 'high',
  });
}

/**
 * Generate driver power rankings (TheRace style)
 */
function generateDriverRankings(context: NewsGenerationContext): CalendarEvent | null {
  const { state, currentDate } = context;

  // Get top 10 drivers by overall rating
  const rankedDrivers = [...state.drivers]
    .filter((d) => d.teamId) // Only contracted drivers
    .sort((a, b) => {
      const aRating = (a.stats.speed + a.stats.racecraft + a.stats.awareness + a.stats.consistency) / 4;
      const bRating = (b.stats.speed + b.stats.racecraft + b.stats.awareness + b.stats.consistency) / 4;
      return bRating - aRating;
    })
    .slice(0, 10);

  if (rankedDrivers.length < 10) return null;

  const { subject, body } = pickDriverRankingsContent(currentDate.year, rankedDrivers, state.teams);

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.TheRace,
    category: NewsCategory.PreSeason,
    subject,
    body,
    importance: 'high',
  });
}

/**
 * Generate hot seat analysis (PitlaneInsider style)
 */
function generateHotSeatAnalysis(context: NewsGenerationContext): CalendarEvent | null {
  const { state, currentDate } = context;
  const standings = state.currentSeason.driverStandings;

  // Find drivers in the bottom half of standings who might be under pressure
  const bottomHalf = standings.slice(Math.floor(standings.length / 2));

  // Look for drivers with poor recent performance
  const hotSeatCandidates = bottomHalf.filter((entry) => {
    const driver = state.drivers.find((d) => d.id === entry.driverId);
    // Drivers with contract ending soon or poor points
    return driver && entry.points < 20;
  });

  if (hotSeatCandidates.length === 0) return null;

  const targetEntry = pickRandom(hotSeatCandidates);
  const targetDriver = state.drivers.find((d) => d.id === targetEntry.driverId);
  const targetTeam = state.teams.find((t) => t.id === targetEntry.teamId);

  if (!targetDriver || !targetTeam) return null;

  const { subject, body } = pickHotSeatContent(targetDriver, targetTeam, targetEntry.points);

  const quotes: NewsQuote[] = [
    createAnonymousQuote(
      pickRandom(HOT_SEAT_ANONYMOUS_QUOTES),
      'a paddock insider'
    ),
  ];

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.PitlaneInsider,
    category: NewsCategory.Commentary,
    subject,
    body,
    quotes,
    importance: 'medium',
  });
}

/**
 * Generate team performance analysis (TechAnalysis style)
 */
function generateTeamPerformanceAnalysis(context: NewsGenerationContext): CalendarEvent | null {
  const { state, currentDate } = context;
  const teamStandings = state.currentSeason.teamStandings;

  if (teamStandings.length < 2) return null;

  // Find a team that's over or under performing
  // Compare current position to expected based on car performance
  const teamsWithPerformance = teamStandings.map((entry, index) => {
    const team = state.teams.find((t) => t.id === entry.teamId);
    const teamState = state.teamStates[entry.teamId];
    const carPerformance = teamState?.carPerformance?.overall ?? 50;
    // Expected position based on car (higher performance = lower position number)
    const expectedPosition = Math.ceil((100 - carPerformance) / 10);
    const actualPosition = index + 1;
    const delta = expectedPosition - actualPosition; // Positive = overperforming

    return { entry, team, delta, actualPosition, carPerformance };
  });

  // Find biggest over/under performer
  const sorted = [...teamsWithPerformance].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const featured = sorted[0];

  if (!featured?.team || Math.abs(featured.delta) < 2) return null;

  const isOverperforming = featured.delta > 0;
  const { subject, body } = pickPerformanceAnalysisContent(
    featured.team,
    featured.actualPosition,
    isOverperforming,
    featured.entry.points
  );

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.TechAnalysis,
    category: NewsCategory.Technical,
    subject,
    body,
    importance: 'medium',
  });
}

// =============================================================================
// PRE-SEASON & ANALYSIS TEMPLATES
// =============================================================================

const CHAMPION_PREVIEW_QUOTES = [
  "We're not resting on our laurels. The team has worked incredibly hard over the winter and we're ready to defend our title.",
  "Every season is a fresh start. We know the competition will be fierce, but we're confident in our preparation.",
  "The target is simple - win the championship again. We have the team to do it.",
];

const HOT_SEAT_ANONYMOUS_QUOTES = [
  "The team is definitely looking at their options for next year. Performance hasn't been where it needs to be.",
  "There's been discussions at board level about the driver situation. Nothing is decided yet, but changes could be coming.",
  "Let's just say the pressure is mounting. Results need to improve quickly.",
];

function pickSeasonPreviewContent(
  year: number,
  champion: Driver | null,
  championTeam: Team | null
): { subject: string; body: string } {
  const subjects = [
    `${year} Season Preview: A new era begins`,
    `Formula One ${year}: Everything you need to know`,
    `The countdown begins: ${year} season preview`,
  ];

  let body = `The ${year} Formula One season is almost upon us, and anticipation is building across the paddock.\n\n`;

  if (champion && championTeam) {
    body += `${getFullName(champion)} enters the season as the driver to beat, with ${championTeam.name} ` +
      `looking to defend their title against a hungry field of challengers.\n\n`;
  }

  body += `Teams have been working tirelessly during the off-season, with significant development ` +
    `expected across the grid. The new regulations have given engineers fresh challenges to solve, ` +
    `and the results of that work will soon become apparent.\n\n` +
    `Pre-season testing begins shortly, giving us our first glimpse of the new machinery.`;

  return { subject: pickRandom(subjects), body };
}

function pickDriverRankingsContent(
  year: number,
  drivers: Driver[],
  teams: Team[]
): { subject: string; body: string } {
  const subjects = [
    `Power Rankings: Our top 10 drivers heading into ${year}`,
    `${year} Driver Rankings: Who's on top?`,
    `Rating the grid: Pre-season driver power rankings`,
  ];

  let body = `As we approach the new season, here are our rankings of the current grid.\n\n`;

  drivers.slice(0, 5).forEach((driver, index) => {
    const team = teams.find((t) => t.id === driver.teamId);
    const teamName = team?.shortName ?? 'Unknown';
    body += `**${index + 1}. ${getFullName(driver)}** (${teamName})\n`;
  });

  body += `\n...and the rest of our top 10 continues with some exciting young talent ` +
    `looking to make their mark this season.`;

  return { subject: pickRandom(subjects), body };
}

function pickHotSeatContent(
  driver: Driver,
  team: Team,
  points: number
): { subject: string; body: string } {
  const driverName = getFullName(driver);

  const subjects = [
    `${driverName}'s seat under threat?`,
    `Pressure mounting on ${driverName} at ${team.shortName}`,
    `Hot seat watch: ${driverName}'s future uncertain`,
  ];

  const body = `${driverName}'s position at ${team.name} is reportedly under scrutiny ` +
    `following a challenging start to the season.\n\n` +
    `With just ${points} points on the board so far, the ${team.shortName} driver ` +
    `has failed to meet expectations. Sources within the paddock suggest the team ` +
    `is actively considering its options for the future.\n\n` +
    `Several young drivers have been linked with the seat, though the team has ` +
    `publicly stated its commitment to the current lineup.`;

  return { subject: pickRandom(subjects), body };
}

function pickPerformanceAnalysisContent(
  team: Team,
  position: number,
  isOverperforming: boolean,
  points: number
): { subject: string; body: string } {
  const subjects = isOverperforming
    ? [
        `${team.shortName}'s remarkable season: How are they doing it?`,
        `Punching above their weight: ${team.name}'s success story`,
        `Technical analysis: ${team.shortName}'s overperformance explained`,
      ]
    : [
        `What's gone wrong at ${team.shortName}?`,
        `Underperforming: ${team.name}'s season struggles`,
        `Technical analysis: Why ${team.shortName} is falling short`,
      ];

  const body = isOverperforming
    ? `${team.name} currently sits P${position} in the constructors' standings with ${points} points, ` +
      `exceeding many pre-season predictions.\n\n` +
      `The team's success can be attributed to several factors: strong operational performance, ` +
      `excellent driver execution, and clever development choices. Their engineers have maximized ` +
      `the potential of their package.\n\n` +
      `The question now is whether they can maintain this level of performance as the season progresses.`
    : `${team.name} finds itself P${position} in the constructors' standings with just ${points} points, ` +
      `well below expectations heading into the season.\n\n` +
      `Sources suggest the team's struggles stem from correlation issues between wind tunnel data ` +
      `and on-track performance. Development updates have not delivered the expected gains.\n\n` +
      `The team has acknowledged the need for a reset and is working on solutions for upcoming races.`;

  return { subject: pickRandom(subjects), body };
}
