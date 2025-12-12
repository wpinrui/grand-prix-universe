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
function generateRaceResultArticle(_state: GameState, event: NewsEvent): CalendarEvent | null {
  // @agent: _state kept for API consistency - future handlers may need to look up additional data
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
function generateChampionshipLeadArticle(_state: GameState, event: NewsEvent): CalendarEvent | null {
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
function generateDriverSignedArticle(_state: GameState, event: NewsEvent): CalendarEvent | null {
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
function generateSpecReleasedArticle(_state: GameState, event: NewsEvent): CalendarEvent | null {
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

  // 3. Pre-season content (season preview, driver rankings)
  news.push(...generatePreSeasonNews(context));

  // 4. Mid-season analysis (hot seat, over/under performers)
  news.push(...generateAnalysisNews(context));

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
// PRE-SEASON NEWS GENERATORS (PR 6)
// =============================================================================

/**
 * Generate pre-season news content
 * Runs only during PreSeason phase
 */
function generatePreSeasonNews(context: NewsGenerationContext): CalendarEvent[] {
  const news: CalendarEvent[] = [];

  if (!context.isPreSeason) return news;

  // Season preview - generate once on specific day (day 15 of year = mid-January)
  if (context.dayOfYear === 15) {
    const preview = generateSeasonPreview(context);
    if (preview) news.push(preview);
  }

  // Driver rankings - generate once on specific day (day 30 = late January)
  if (context.dayOfYear === 30) {
    const rankings = generateDriverRankings(context);
    if (rankings) news.push(rankings);
  }

  return news;
}

/**
 * Generate season preview article
 */
function generateSeasonPreview(context: NewsGenerationContext): CalendarEvent | null {
  const { state, currentDate } = context;
  const teams = state.teams;

  // Get constructor standings from last season (if any)
  const lastSeasonStandings = state.currentSeason.constructorStandings;
  const defendingChampTeam = lastSeasonStandings.length > 0
    ? state.teams.find((t) => t.id === lastSeasonStandings[0].teamId)
    : null;

  const totalRaces = state.currentSeason.calendar.length;

  const subject = `${currentDate.year} Season Preview: ${totalRaces} races, infinite possibilities`;

  const introTemplates = [
    `The ${currentDate.year} Formula One World Championship is almost upon us, and the anticipation in the paddock is palpable.`,
    `As the new season dawns, teams have been working tirelessly over the winter to find those crucial tenths of a second.`,
    `Formula One enters a new chapter in ${currentDate.year}, with ${teams.length} teams ready to battle for glory.`,
  ];

  const championContext = defendingChampTeam
    ? `${defendingChampTeam.name} enter the season as defending champions, but the competition is hungry to dethrone them.`
    : `With no clear favorite emerging from testing, the season promises to be one of the most open in years.`;

  const body = `${pickRandom(introTemplates)}\n\n` +
    `${championContext}\n\n` +
    `With ${totalRaces} races scheduled across five continents, the ${currentDate.year} championship will test the endurance, skill, and strategy of every team on the grid.\n\n` +
    `"Pre-season testing has been encouraging but we know the real challenge begins when the lights go out," said one team principal. "Every team believes this is their year."`;

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
 * Generate driver power rankings article
 */
function generateDriverRankings(context: NewsGenerationContext): CalendarEvent | null {
  const { state, currentDate } = context;

  // Get all race drivers sorted by rating
  const raceDrivers = state.drivers
    .filter((d) => d.teamId && d.role !== 'test')
    .sort((a, b) => {
      const aRating = (a.stats.speed + a.stats.consistency + a.stats.racecraft) / 3;
      const bRating = (b.stats.speed + b.stats.consistency + b.stats.racecraft) / 3;
      return bRating - aRating;
    });

  if (raceDrivers.length < 5) return null;

  const top5 = raceDrivers.slice(0, 5);
  const subject = `Our Top 5 Drivers Heading Into ${currentDate.year}`;

  const rankings = top5.map((driver, index) => {
    const team = state.teams.find((t) => t.id === driver.teamId);
    const teamName = team?.shortName ?? 'Unknown';
    const avgRating = Math.round((driver.stats.speed + driver.stats.consistency + driver.stats.racecraft) / 3);
    return `**${index + 1}. ${getFullName(driver)}** (${teamName}) - Rating: ${avgRating}`;
  });

  const body = `As we approach the season opener, we've ranked the drivers we think will make the biggest impact in ${currentDate.year}.\n\n` +
    `${rankings.join('\n\n')}\n\n` +
    `Of course, raw talent is only part of the equation - machinery, team support, and luck all play their part. But these five have the tools to fight at the front.`;

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.TheRace,
    category: NewsCategory.PreSeason,
    subject,
    body,
    importance: 'high',
  });
}

// =============================================================================
// MID-SEASON ANALYSIS GENERATORS (PR 6)
// =============================================================================

/**
 * Generate mid-season analysis news
 * Hot seat analysis, over/under performers
 */
function generateAnalysisNews(context: NewsGenerationContext): CalendarEvent[] {
  const news: CalendarEvent[] = [];

  if (!context.isRacingSeason) return news;

  const completedRaces = context.recentRaces.length > 0
    ? context.state.currentSeason.calendar.filter((r) => r.completed).length
    : 0;

  // Hot seat analysis - check every 3 races after race 3
  if (completedRaces >= 3 && completedRaces % 3 === 0) {
    // Only generate on the day after a race completes (check if we just completed a race)
    const justCompletedRace = context.recentRaces[0];
    if (justCompletedRace && isDaysBeforeRace(context, justCompletedRace, -1)) {
      const hotSeat = generateHotSeatAnalysis(context);
      if (hotSeat) news.push(hotSeat);
    }
  }

  // Over/under performers - generate after race 5, then every 5 races
  if (completedRaces >= 5 && completedRaces % 5 === 0) {
    const justCompletedRace = context.recentRaces[0];
    if (justCompletedRace && isDaysBeforeRace(context, justCompletedRace, -1)) {
      const performers = generatePerformanceAnalysis(context);
      if (performers) news.push(performers);
    }
  }

  return news;
}

/**
 * Generate hot seat analysis when a driver is underperforming
 */
function generateHotSeatAnalysis(context: NewsGenerationContext): CalendarEvent | null {
  const { state, currentDate } = context;
  const standings = state.currentSeason.driverStandings;

  // Find drivers significantly behind their teammates
  const hotSeatCandidates: Array<{
    driver: Driver;
    teammate: Driver;
    pointsGap: number;
    team: Team;
  }> = [];

  for (const team of state.teams) {
    const teamDrivers = standings.filter((s) => s.teamId === team.id);
    if (teamDrivers.length < 2) continue;

    const [first, second] = teamDrivers.sort((a, b) => b.points - a.points);
    const gap = first.points - second.points;

    // Significant gap (more than 20 points behind teammate)
    if (gap >= 20) {
      const underperformer = state.drivers.find((d) => d.id === second.driverId);
      const leader = state.drivers.find((d) => d.id === first.driverId);

      if (underperformer && leader) {
        hotSeatCandidates.push({
          driver: underperformer,
          teammate: leader,
          pointsGap: gap,
          team,
        });
      }
    }
  }

  if (hotSeatCandidates.length === 0) return null;

  // Pick the worst underperformer
  const worst = hotSeatCandidates.sort((a, b) => b.pointsGap - a.pointsGap)[0];
  const { driver, teammate, pointsGap, team } = worst;

  const subject = `Hot Seat: Is ${getFullName(driver)}'s future at ${team.shortName} in doubt?`;

  const body = `Questions are being asked about ${getFullName(driver)}'s future at ${team.name} following a difficult start to the season.\n\n` +
    `After ${context.state.currentSeason.calendar.filter((r) => r.completed).length} races, ${getFullName(driver)} sits ${pointsGap} points behind teammate ${getFullName(teammate)}, raising eyebrows in the paddock.\n\n` +
    `While ${team.shortName} have publicly backed their driver, sources suggest the team hierarchy is monitoring the situation closely.`;

  const quotes: NewsQuote[] = [
    createAnonymousQuote(
      "There's definitely pressure. The team invested heavily and they expect results.",
      'sources close to the team'
    ),
  ];

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.TheRace,
    category: NewsCategory.Commentary,
    subject,
    body,
    quotes,
    importance: 'medium',
  });
}

/**
 * Generate over/under performers analysis
 */
function generatePerformanceAnalysis(context: NewsGenerationContext): CalendarEvent | null {
  const { state, currentDate } = context;
  const constructorStandings = state.currentSeason.constructorStandings;

  if (constructorStandings.length < 4) return null;

  // Find teams whose position differs significantly from expected (based on budget/prestige)
  // For simplicity, we'll compare current position to a rough expectation
  const teamsWithPerformance = constructorStandings.map((standing, index) => {
    const team = state.teams.find((t) => t.id === standing.teamId);
    if (!team) return null;

    // Simple expectation: sort teams by prestige
    const expectedPosition = state.teams
      .sort((a, b) => b.prestige - a.prestige)
      .findIndex((t) => t.id === team.id) + 1;

    const actualPosition = index + 1;
    const positionDelta = expectedPosition - actualPosition; // Positive = overperforming

    return { team, actualPosition, expectedPosition, positionDelta, points: standing.points };
  }).filter((t): t is NonNullable<typeof t> => t !== null);

  // Find biggest over and under performers
  const overperformer = teamsWithPerformance
    .filter((t) => t.positionDelta >= 2)
    .sort((a, b) => b.positionDelta - a.positionDelta)[0];

  const underperformer = teamsWithPerformance
    .filter((t) => t.positionDelta <= -2)
    .sort((a, b) => a.positionDelta - b.positionDelta)[0];

  if (!overperformer && !underperformer) return null;

  const completedRaces = state.currentSeason.calendar.filter((r) => r.completed).length;
  const subject = `Season Analysis: Who's exceeding expectations?`;

  let body = `After ${completedRaces} races, the championship picture is becoming clearer. Here's our analysis of who's exceeding - and falling short of - expectations.\n\n`;

  if (overperformer) {
    body += `**Overperformer: ${overperformer.team.name}**\n` +
      `Currently P${overperformer.actualPosition} with ${overperformer.points} points. ` +
      `Expected to be around P${overperformer.expectedPosition} based on their resources, they've been punching well above their weight.\n\n`;
  }

  if (underperformer) {
    body += `**Underperformer: ${underperformer.team.name}**\n` +
      `Currently P${underperformer.actualPosition} with ${underperformer.points} points. ` +
      `Expected to challenge for P${underperformer.expectedPosition}, they've struggled to find consistent pace.`;
  }

  return createNewsHeadline({
    date: currentDate,
    source: NewsSource.TheRace,
    category: NewsCategory.Commentary,
    subject,
    body,
    importance: 'medium',
  });
}
