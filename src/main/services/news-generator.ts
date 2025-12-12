/**
 * News Generator Service
 *
 * Generates daily news headlines for the News screen using an event-driven architecture.
 * Events are pushed to state.newsEvents when things happen (races, contracts, upgrades),
 * and this service consumes them to create reactive news articles.
 *
 * This module provides:
 * - Event consumption and article generation
 * - Helper functions for creating news headlines and quotes
 * - Event pushing utility for other modules
 *
 * Event emission is added in subsequent PRs:
 * - Race events from race-processor
 * - Contract events from negotiation-processor
 * - Technical events from design-processor
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
  NewsEvent,
} from '../../shared/domain';
import {
  CalendarEventType,
  NewsSource,
  NewsCategory,
  NewsEventType,
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
// EVENT QUEUE MANAGEMENT
// =============================================================================

/**
 * Push a news event to the queue (mutates state)
 * Called by other modules when newsworthy things happen
 */
export function pushNewsEvent(
  state: GameState,
  type: NewsEventType,
  importance: EventImportance,
  data: Record<string, unknown>
): void {
  const event: NewsEvent = {
    id: randomUUID(),
    type,
    date: state.currentDate,
    importance,
    processed: false,
    data,
  };
  state.newsEvents.push(event);
}

/**
 * Process all unprocessed news events and generate articles
 * Returns array of CalendarEvents to add to state.calendarEvents
 */
export function processNewsEvents(state: GameState): CalendarEvent[] {
  const news: CalendarEvent[] = [];

  for (const event of state.newsEvents) {
    if (event.processed) continue;

    const article = generateArticleFromEvent(state, event);
    if (article) {
      news.push(article);
    }

    // Mark as processed even if no article was generated
    // (some events may not warrant coverage)
    event.processed = true;
  }

  return news;
}

/**
 * Generate a news article from a specific event
 * Returns null if no article should be generated for this event
 */
function generateArticleFromEvent(state: GameState, event: NewsEvent): CalendarEvent | null {
  // Event type handlers - each creates appropriate article content
  // Additional handlers will be added as event types are implemented
  switch (event.type) {
    case NewsEventType.RaceResult:
      return generateRaceResultArticle(state, event);

    case NewsEventType.ChampionshipLead:
      return generateChampionshipLeadArticle(state, event);

    case NewsEventType.DriverSigned:
      return generateDriverSignedArticle(state, event);

    case NewsEventType.SpecReleased:
      return generateSpecReleasedArticle(state, event);

    // Placeholder handlers - return null until implemented
    case NewsEventType.QualifyingResult:
    case NewsEventType.RetirementDrama:
    case NewsEventType.ChampionshipDecided:
    case NewsEventType.ChampionshipMilestone:
    case NewsEventType.DriverReleased:
    case NewsEventType.StaffHired:
    case NewsEventType.StaffDeparture:
    case NewsEventType.MajorUpgrade:
    case NewsEventType.SeasonStart:
    case NewsEventType.SeasonPreview:
    case NewsEventType.MidSeasonAnalysis:
      return null;

    default:
      return null;
  }
}

// =============================================================================
// EVENT ARTICLE GENERATORS
// =============================================================================

/**
 * Generate article for a race result event
 */
function generateRaceResultArticle(state: GameState, event: NewsEvent): CalendarEvent | null {
  const data = event.data as {
    raceNumber: number;
    circuitName: string;
    circuitCountry: string;
    winnerId: string;
    winnerName: string;
    winnerTeamName: string;
    secondName: string;
    thirdName: string;
    winnerMargin: string; // e.g., "+5.234s" or "+1 lap"
  };

  const subject = `${data.winnerName} wins ${data.circuitCountry} GP`;
  const body = `${data.winnerName} took victory at ${data.circuitName} in Round ${data.raceNumber} of the championship.\n\n` +
    `The ${data.winnerTeamName} driver crossed the line ${data.winnerMargin} ahead of ${data.secondName}, ` +
    `with ${data.thirdName} completing the podium.\n\n` +
    `Full race report and analysis to follow.`;

  return createNewsHeadline({
    date: event.date,
    source: NewsSource.F1Official,
    category: NewsCategory.RaceResult,
    subject,
    body,
    importance: event.importance,
  });
}

/**
 * Generate article for championship lead change
 */
function generateChampionshipLeadArticle(state: GameState, event: NewsEvent): CalendarEvent | null {
  const data = event.data as {
    newLeaderId: string;
    newLeaderName: string;
    newLeaderTeam: string;
    newLeaderPoints: number;
    previousLeaderName: string;
    pointsGap: number;
    raceNumber: number;
  };

  const subject = `${data.newLeaderName} takes championship lead`;
  const body = `${data.newLeaderName} has moved to the top of the Drivers' Championship standings after Round ${data.raceNumber}.\n\n` +
    `The ${data.newLeaderTeam} driver now leads by ${data.pointsGap} points from ${data.previousLeaderName}, ` +
    `with ${data.newLeaderPoints} points to their name.\n\n` +
    `"It's great to be leading but there's a long way to go," said ${data.newLeaderName}. "We'll take it one race at a time."`;

  return createNewsHeadline({
    date: event.date,
    source: NewsSource.TheRace,
    category: NewsCategory.Championship,
    subject,
    body,
    importance: event.importance,
  });
}

/**
 * Generate article for driver signing
 */
function generateDriverSignedArticle(state: GameState, event: NewsEvent): CalendarEvent | null {
  const data = event.data as {
    driverId: string;
    driverName: string;
    teamId: string;
    teamName: string;
    previousTeamName?: string;
    contractYears: number;
    forSeason: number;
  };

  const moveText = data.previousTeamName
    ? `makes the move from ${data.previousTeamName} to ${data.teamName}`
    : `joins ${data.teamName}`;

  const subject = `OFFICIAL: ${data.driverName} signs for ${data.teamName}`;
  const body = `${data.teamName} has confirmed the signing of ${data.driverName} on a ${data.contractYears}-year deal.\n\n` +
    `The driver ${moveText} starting from the ${data.forSeason} season.\n\n` +
    `"I'm thrilled to be joining ${data.teamName}," said ${data.driverName}. "This is an exciting opportunity and I can't wait to get started."`;

  return createNewsHeadline({
    date: event.date,
    source: NewsSource.F1Official,
    category: NewsCategory.Transfer,
    subject,
    body,
    importance: event.importance,
  });
}

/**
 * Generate article for spec release
 */
function generateSpecReleasedArticle(state: GameState, event: NewsEvent): CalendarEvent | null {
  const data = event.data as {
    manufacturerId: string;
    manufacturerName: string;
    specVersion: number;
    statImprovements: string; // e.g., "Power +3, Reliability +2"
  };

  const subject = `${data.manufacturerName} unveils Spec ${data.specVersion}.0 power unit`;
  const body = `${data.manufacturerName} has released their latest engine specification, bringing significant improvements to their power unit.\n\n` +
    `The Spec ${data.specVersion}.0 engine features upgrades to: ${data.statImprovements}.\n\n` +
    `Teams running ${data.manufacturerName} power units will have the option to upgrade at the next race.`;

  return createNewsHeadline({
    date: event.date,
    source: NewsSource.TechAnalysis,
    category: NewsCategory.Technical,
    subject,
    body,
    importance: event.importance,
  });
}

// =============================================================================
// DAILY NEWS GENERATION
// =============================================================================

/**
 * Generate daily news for the current game state
 * Called by turn processor after each day advances
 *
 * Two news sources:
 * 1. Event-driven: Process newsEvents queue for reactive articles (e.g., race results)
 * 2. Time-based: Generate scheduled content (e.g., race previews) based on calendar
 *
 * Returns array of CalendarEvents to add to state.calendarEvents
 */
export function generateDailyNews(state: GameState): CalendarEvent[] {
  const context = buildNewsContext(state);
  const news: CalendarEvent[] = [];

  // 1. Process event queue (race results, signings, etc.)
  // Events are pushed by other modules when newsworthy things happen
  news.push(...processNewsEvents(state));

  // 2. Time-based content (previews, analysis scheduled around race calendar)
  news.push(...generateRaceCoverage(context));

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
