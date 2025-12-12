/**
 * Game Initialization Module
 *
 * Handles creating new games and initial state setup.
 */

import { randomUUID } from 'crypto';
import { ConfigLoader } from './config-loader';
import { cloneDeep, assertNonEmpty } from './state-utils';
import {
  MIN_DESPERATION_MULTIPLIER,
  DESPERATION_MULTIPLIER_RANGE,
} from '../engines/evaluators';
import type {
  GameState,
  GameDate,
  PlayerInfo,
  SeasonData,
  CalendarEntry,
  DriverStanding,
  ConstructorStanding,
  DriverRuntimeState,
  TeamRuntimeState,
  DepartmentMorale,
  DepartmentStaffCounts,
  ActiveSponsorDeal,
  ActiveManufacturerContract,
  Driver,
  Team,
  Sponsor,
  Manufacturer,
  Circuit,
  Chief,
  TeamPrincipal,
  Car,
  GameRules,
  SeasonRegulations,
  NewGameParams,
  DesignState,
  TechnologyLevel,
  CurrentYearChassisState,
  HandlingProblemState,
  AppointmentNews,
  AppointmentDriverSummary,
} from '../../shared/domain';
import {
  GamePhase,
  Department,
  ManufacturerType,
  ManufacturerDealType,
  TechnologyComponent,
  HandlingProblem,
  DriverRole,
  CalendarEventType,
  hasRaceSeat,
  createDefaultTestSession,
} from '../../shared/domain';
import {
  getPreSeasonStartDate,
  DEFAULT_SIMULATION_STATE,
  seasonToYear,
} from '../../shared/utils/date-utils';
import {
  createDefaultTeamEngineState,
  createInitialSpecState,
  createInitialEngineAnalytics,
} from '../../shared/domain/engine-utils';

/** Current save format version */
export const SAVE_VERSION = '1.0.0';

/** Default contract duration in seasons */
export const DEFAULT_CONTRACT_DURATION = 3;

/** Default starting season for new games */
export const DEFAULT_STARTING_SEASON = 1;

/** Initial morale for drivers and departments (0-100 scale) */
const INITIAL_MORALE = 70;

/** Initial fitness for drivers (0-100 scale, 100 = fully fit) */
const INITIAL_FITNESS = 100;

/** Initial fatigue for drivers (0-100 scale, 0 = fresh) */
const INITIAL_FATIGUE = 0;

/** Initial sponsor satisfaction (0-100 scale, 60 = neutral-good) */
const INITIAL_SPONSOR_SATISFACTION = 60;

/** Initial bonus level for new contracts (0 = no bonus) */
const INITIAL_BONUS_LEVEL = 0;

/** Initial car condition for new cars (0-100, 100 = perfect) */
const INITIAL_CAR_CONDITION = 100;

/** Number of cars per team (modern F1) */
const CARS_PER_TEAM = 2;

/** First race typically in March (week 11) */
const FIRST_RACE_WEEK = 11;

/** Default gap between races when schedule data unavailable (bi-weekly) */
const DEFAULT_WEEKS_BETWEEN_RACES = 2;

/** Initial technology attribute level (0-100 scale, 35 = midpoint of 10-60 normalized range) */
const INITIAL_TECH_LEVEL = 35;

/** All entity arrays loaded from config */
export interface LoadedEntities {
  teams: Team[];
  drivers: Driver[];
  chiefs: Chief[];
  principals: TeamPrincipal[];
  sponsors: Sponsor[];
  manufacturers: Manufacturer[];
  circuits: Circuit[];
}

/** Parameters for building the complete game state */
export interface BuildGameStateParams {
  playerName: string;
  teamId: string;
  seasonNumber: number;
  entities: LoadedEntities;
  rules: GameRules;
  regulations: SeasonRegulations;
}

/**
 * Creates initial technology levels for all 7 components
 * All components start at midpoint (35) for both performance and reliability
 */
export function createInitialTechnologyLevels(): TechnologyLevel[] {
  return Object.values(TechnologyComponent).map((component) => ({
    component,
    performance: INITIAL_TECH_LEVEL,
    reliability: INITIAL_TECH_LEVEL,
  }));
}

/**
 * Creates initial handling problem state for all 8 problems
 * All problems start undiscovered (revealed through testing)
 */
export function createInitialHandlingProblems(): HandlingProblemState[] {
  return Object.values(HandlingProblem).map((problem) => ({
    problem,
    discovered: false,
    solutionProgress: 0,
    solutionDesigned: false,
    solutionInstalled: false,
  }));
}

/**
 * Creates initial design state for a team
 * No active design projects, average technology, no handling info revealed
 */
export function createInitialDesignState(): DesignState {
  const currentYearChassis: CurrentYearChassisState = {
    handlingRevealed: null,
    problems: createInitialHandlingProblems(),
    activeDesignProblem: null,
    designersAssigned: 0,
    accumulatedSolutionWorkUnits: 0,
  };

  return {
    nextYearChassis: null,
    technologyLevels: createInitialTechnologyLevels(),
    activeTechnologyProjects: [],
    currentYearChassis,
  };
}

/**
 * Creates initial runtime state for a driver
 * desperationMultiplier is randomized per driver (MIN to MIN+RANGE)
 * Lower values = more willing to accept worse contract offers
 */
export function createInitialDriverState(): DriverRuntimeState {
  // Random desperation multiplier using constants from driver-evaluator
  // Lower = more desperate, higher = more demanding
  const desperationMultiplier =
    MIN_DESPERATION_MULTIPLIER + Math.random() * DESPERATION_MULTIPLIER_RANGE;

  return {
    morale: INITIAL_MORALE,
    fitness: INITIAL_FITNESS,
    fatigue: INITIAL_FATIGUE,
    injuryWeeksRemaining: 0,
    banRacesRemaining: 0,
    isAngry: false,
    engineUnitsUsed: 0,
    gearboxRaceCount: 0,
    desperationMultiplier,
  };
}

/**
 * Creates initial morale for all departments
 */
export function createInitialDepartmentMorale(): DepartmentMorale {
  return {
    [Department.Commercial]: INITIAL_MORALE,
    [Department.Design]: INITIAL_MORALE,
    [Department.Mechanics]: INITIAL_MORALE,
  };
}

/**
 * Creates initial runtime state for a team
 */
export function createInitialTeamState(
  sponsorIds: string[],
  initialStaffCounts: DepartmentStaffCounts
): TeamRuntimeState {
  const sponsorSatisfaction: Record<string, number> = {};
  for (const sponsorId of sponsorIds) {
    sponsorSatisfaction[sponsorId] = INITIAL_SPONSOR_SATISFACTION;
  }

  return {
    morale: createInitialDepartmentMorale(),
    sponsorSatisfaction,
    staffCounts: cloneDeep(initialStaffCounts),
    setupPoints: 0,
    testSession: createDefaultTestSession(),
    designState: createInitialDesignState(),
    pendingParts: [],
    engineState: createDefaultTeamEngineState(),
  };
}

/**
 * Validates input parameters for new game creation.
 * Throws descriptive errors for invalid inputs.
 */
export function validateNewGameParams(params: NewGameParams): void {
  const { playerName, teamId, seasonNumber = DEFAULT_STARTING_SEASON } = params;

  if (!playerName.trim()) {
    throw new Error('Player name cannot be empty');
  }
  if (!teamId.trim()) {
    throw new Error('Team ID cannot be empty');
  }
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
    throw new Error('Season number must be a positive integer');
  }

  const team = ConfigLoader.getTeamById(teamId);
  if (!team) {
    throw new Error(`Team not found: ${teamId}`);
  }

  const rules = ConfigLoader.getRules();
  if (!rules) {
    throw new Error('Game rules not found');
  }

  const regulations = ConfigLoader.getRegulationsBySeason(seasonNumber);
  if (!regulations) {
    throw new Error(`Regulations not found for season ${seasonNumber}`);
  }
}

/**
 * Loads all entities from config and clones them for game state.
 * Cloning prevents mutations from corrupting the config cache.
 */
export function loadAndCloneEntities(): LoadedEntities {
  const teams = ConfigLoader.getTeams();
  const drivers = ConfigLoader.getDrivers();
  const chiefs = ConfigLoader.getChiefs();
  const principals = ConfigLoader.getPrincipals();
  const sponsors = ConfigLoader.getSponsors();
  const manufacturers = ConfigLoader.getManufacturers();
  const circuits = ConfigLoader.getCircuits();

  assertNonEmpty(teams, 'teams');
  assertNonEmpty(drivers, 'drivers');
  assertNonEmpty(circuits, 'circuits');
  assertNonEmpty(sponsors, 'sponsors');
  assertNonEmpty(manufacturers, 'manufacturers');
  assertNonEmpty(chiefs, 'chiefs');
  assertNonEmpty(principals, 'principals');

  return {
    teams: cloneDeep(teams),
    drivers: cloneDeep(drivers),
    chiefs: cloneDeep(chiefs),
    principals: cloneDeep(principals),
    sponsors: cloneDeep(sponsors),
    manufacturers: cloneDeep(manufacturers),
    circuits: cloneDeep(circuits),
  };
}

/**
 * Creates runtime states for all drivers
 */
export function createAllDriverStates(drivers: Driver[]): Record<string, DriverRuntimeState> {
  const states: Record<string, DriverRuntimeState> = {};
  for (const driver of drivers) {
    states[driver.id] = createInitialDriverState();
  }
  return states;
}

/**
 * Creates runtime states for all teams
 */
export function createAllTeamStates(teams: Team[]): Record<string, TeamRuntimeState> {
  const states: Record<string, TeamRuntimeState> = {};
  for (const team of teams) {
    states[team.id] = createInitialTeamState(
      team.initialSponsorIds,
      team.initialStaffCounts
    );
  }
  return states;
}

/**
 * Creates initial cars for all teams (2 race cars per team)
 * Uses team's engine manufacturer from initialEngineManufacturerId
 */
export function createInitialCars(teams: Team[]): Car[] {
  const cars: Car[] = [];

  for (const team of teams) {
    for (let i = 1; i <= CARS_PER_TEAM; i++) {
      cars.push({
        id: `${team.id}-car-${i}`,
        teamId: team.id,
        chassisId: `${team.id}-chassis-s1`, // Season 1 chassis placeholder
        condition: INITIAL_CAR_CONDITION,
        mileage: 0,
        isRaceCar: true,
      });
    }
  }

  return cars;
}

/**
 * Creates initial driver standings (all zeros, positions assigned by array order)
 * Only includes drivers with race seats (excludes test drivers and free agents)
 */
export function createInitialDriverStandings(drivers: Driver[]): DriverStanding[] {
  return drivers.filter(hasRaceSeat).map((driver, index) => ({
    driverId: driver.id,
    teamId: driver.teamId,
    points: 0,
    position: index + 1,
    wins: 0,
    podiums: 0,
    polePositions: 0,
    fastestLaps: 0,
    dnfs: 0,
  }));
}

/**
 * Creates initial constructor standings (all zeros, positions assigned by team order)
 */
export function createInitialConstructorStandings(teams: Team[]): ConstructorStanding[] {
  return teams.map((team, index) => ({
    teamId: team.id,
    points: 0,
    position: index + 1,
    wins: 0,
    podiums: 0,
    polePositions: 0,
  }));
}

/**
 * Creates the season calendar using the race schedule data.
 * Falls back to even spacing if schedule data is unavailable.
 */
export function createCalendar(circuitIds: string[]): CalendarEntry[] {
  const schedule = ConfigLoader.getRaceSchedule();
  const scheduleMap = new Map<string, number>(
    schedule.map((entry) => [entry.circuitId, entry.weekNumber])
  );

  return circuitIds.map((circuitId, index) => {
    // Use schedule week if available, otherwise fall back to even spacing
    const weekNumber =
      scheduleMap.get(circuitId) ?? FIRST_RACE_WEEK + index * DEFAULT_WEEKS_BETWEEN_RACES;

    return {
      raceNumber: index + 1,
      circuitId,
      weekNumber,
      completed: false,
      cancelled: false,
    };
  });
}

/**
 * Creates initial sponsor deals from team's initialSponsorIds
 */
export function createInitialSponsorDeals(
  teams: Team[],
  sponsors: Sponsor[],
  seasonNumber: number
): ActiveSponsorDeal[] {
  const deals: ActiveSponsorDeal[] = [];

  for (const team of teams) {
    for (const sponsorId of team.initialSponsorIds) {
      const sponsor = sponsors.find((s) => s.id === sponsorId);
      if (!sponsor) {
        throw new Error(
          `Data integrity error: sponsor "${sponsorId}" not found for team "${team.id}"`
        );
      }

      deals.push({
        sponsorId,
        teamId: team.id,
        tier: sponsor.tier,
        signingBonus: 0, // Initial deals have no signing bonus
        monthlyPayment: sponsor.baseMonthlyPayment,
        guaranteed: false,
        startSeason: seasonNumber,
        endSeason: seasonNumber + DEFAULT_CONTRACT_DURATION - 1,
      });
    }
  }

  return deals;
}

/**
 * Determines the deal type based on manufacturer-team relationship
 */
export function getDealType(manufacturer: Manufacturer, teamId: string): ManufacturerDealType {
  if (manufacturer.worksTeamId === teamId) {
    return ManufacturerDealType.Works;
  }
  if (manufacturer.partnerTeamIds.includes(teamId)) {
    return ManufacturerDealType.Partner;
  }
  return ManufacturerDealType.Customer;
}

/**
 * Creates initial manufacturer contracts from team's initialEngineManufacturerId
 */
export function createInitialManufacturerContracts(
  teams: Team[],
  manufacturers: Manufacturer[],
  seasonNumber: number
): ActiveManufacturerContract[] {
  const contracts: ActiveManufacturerContract[] = [];

  for (const team of teams) {
    const manufacturer = manufacturers.find(
      (m) => m.id === team.initialEngineManufacturerId
    );
    if (!manufacturer) {
      throw new Error(
        `Data integrity error: manufacturer "${team.initialEngineManufacturerId}" not found for team "${team.id}"`
      );
    }

    const dealType = getDealType(manufacturer, team.id);

    contracts.push({
      manufacturerId: manufacturer.id,
      teamId: team.id,
      type: ManufacturerType.Engine,
      dealType,
      annualCost: manufacturer.annualCost,
      bonusLevel: INITIAL_BONUS_LEVEL,
      startSeason: seasonNumber,
      endSeason: seasonNumber + DEFAULT_CONTRACT_DURATION - 1,
    });
  }

  return contracts;
}

/**
 * Gets driver role priority for sorting (first > second > equal > test)
 */
function getDriverRolePriority(role: DriverRole): number {
  switch (role) {
    case DriverRole.First: return 0;
    case DriverRole.Second: return 1;
    case DriverRole.Equal: return 2;
    case DriverRole.Test: return 3;
    default: return 4;
  }
}

/**
 * Generates the article body for an appointment news story
 * Creates believable, dynamic text based on team context
 */
function generateAppointmentArticleBody(
  playerName: string,
  team: Team,
  outgoingPrincipalName: string,
  year: number
): string {
  // Extract team context from description to inform the narrative
  const isTopTeam = team.budget >= 180000000;
  const isMidfield = team.budget >= 100000000 && team.budget < 180000000;

  // Build article paragraphs
  const paragraphs: string[] = [];

  // Opening paragraph - the announcement
  paragraphs.push(
    `${team.name} has announced the appointment of ${playerName} as their new Team Principal, ` +
    `effective immediately. The appointment sees ${outgoingPrincipalName} depart the ${team.headquarters}-based outfit ` +
    `ahead of the ${year} Formula One season.`
  );

  // Second paragraph - context about the outgoing principal
  if (isTopTeam) {
    paragraphs.push(
      `${outgoingPrincipalName}'s tenure at ${team.shortName} saw the team establish itself as one of the ` +
      `leading forces in the paddock. However, the team's ownership group has decided to bring in fresh ` +
      `leadership as they look to build on recent successes and push for championship glory.`
    );
  } else if (isMidfield) {
    paragraphs.push(
      `${outgoingPrincipalName} led ${team.shortName} through a period of steady development, though ` +
      `the team has yet to achieve a breakthrough to the front of the grid. The change in leadership ` +
      `signals the team's intent to accelerate their progress and challenge for podium positions.`
    );
  } else {
    paragraphs.push(
      `${outgoingPrincipalName}'s time at ${team.shortName} was marked by the challenges of operating ` +
      `at the back of the grid with limited resources. The team's stakeholders have opted for a change ` +
      `in direction, hoping ${playerName} can bring new ideas and energy to the struggling outfit.`
    );
  }

  // Third paragraph - expectations for the new principal
  if (isTopTeam) {
    paragraphs.push(
      `${playerName} takes the helm of a well-resourced operation with championship aspirations. ` +
      `The team's state-of-the-art facilities and talented driver lineup provide a strong foundation, ` +
      `but the pressure to deliver immediate results will be immense.`
    );
  } else if (isMidfield) {
    paragraphs.push(
      `${playerName} inherits a team with potential but in need of direction. The ${year} season ` +
      `presents an opportunity to make a mark, with the team's infrastructure and budget capable of ` +
      `supporting a push into the top five.`
    );
  } else {
    paragraphs.push(
      `${playerName} faces a significant challenge at ${team.shortName}, where limited resources ` +
      `have hampered progress in recent seasons. The new Team Principal will need to maximize every ` +
      `opportunity and build a culture of improvement if the team is to move up the grid.`
    );
  }

  // Closing paragraph - looking ahead
  paragraphs.push(
    `${playerName}'s first task will be to assess the team's current state and prepare for the ` +
    `upcoming season. With pre-season testing just around the corner, there is no time to waste ` +
    `as the new Team Principal looks to make their mark on Formula One.`
  );

  return paragraphs.join('\n\n');
}

/**
 * Creates appointment news data for when a player joins a team
 */
export function createAppointmentNews(
  playerName: string,
  team: Team,
  teamDrivers: Driver[],
  seasonNumber: number
): AppointmentNews {
  const year = seasonToYear(seasonNumber);

  // Sort drivers by role priority and take first two (should be race drivers)
  const sortedDrivers = [...teamDrivers]
    .filter((d) => d.role !== DriverRole.Test)
    .sort((a, b) => getDriverRolePriority(a.role) - getDriverRolePriority(b.role))
    .slice(0, 2);

  // Create driver summaries
  const driverSummaries: AppointmentDriverSummary[] = sortedDrivers.map((driver) => {
    // Get last season stats from career history if available
    const lastSeason = driver.careerHistory?.find((h) => h.season === year - 1);

    return {
      driverId: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      nationality: driver.nationality,
      raceNumber: driver.raceNumber,
      photoUrl: driver.photoUrl,
      lastSeasonPosition: lastSeason?.championshipPosition,
      lastSeasonPoints: lastSeason?.totalPoints,
      contractEnd: driver.contractEnd,
      salary: driver.salary,
      reputation: driver.reputation,
    };
  });

  // Ensure we have exactly 2 drivers (pad with empty if needed - shouldn't happen)
  while (driverSummaries.length < 2) {
    driverSummaries.push({
      driverId: '',
      firstName: 'TBA',
      lastName: '',
      nationality: '',
      contractEnd: seasonNumber,
      salary: 0,
      reputation: 0,
    });
  }

  const headline = `${playerName} appointed as ${team.shortName} Team Principal`;
  const articleBody = generateAppointmentArticleBody(
    playerName,
    team,
    team.principal,
    year
  );

  return {
    playerName,
    teamId: team.id,
    teamName: team.name,
    teamShortName: team.shortName,
    teamPrimaryColor: team.primaryColor,
    teamSecondaryColor: team.secondaryColor,
    teamLogoUrl: team.logoUrl,
    outgoingPrincipalName: team.principal,
    headline,
    articleBody,
    drivers: [driverSummaries[0], driverSummaries[1]],
    year,
  };
}

/**
 * Assembles all components into a complete GameState object
 */
export function buildGameState(params: BuildGameStateParams): GameState {
  const { playerName, teamId, seasonNumber, entities, rules, regulations } = params;
  const { teams, drivers, chiefs, principals, sponsors, manufacturers, circuits } = entities;

  // Create runtime states
  const driverStates = createAllDriverStates(drivers);
  const teamStates = createAllTeamStates(teams);

  // Create season data
  const currentSeason: SeasonData = {
    seasonNumber,
    calendar: createCalendar(circuits.map((c) => c.id)),
    driverStandings: createInitialDriverStandings(drivers),
    constructorStandings: createInitialConstructorStandings(teams),
    regulations,
  };

  // Create initial contracts
  const sponsorDeals = createInitialSponsorDeals(teams, sponsors, seasonNumber);
  const manufacturerContracts = createInitialManufacturerContracts(
    teams,
    manufacturers,
    seasonNumber
  );

  // Create initial manufacturer spec states (all start at spec 1 with no bonuses)
  const manufacturerSpecs = manufacturers
    .filter((m) => m.type === ManufacturerType.Engine)
    .map((m) => createInitialSpecState(m.id));

  // Create initial engine analytics (empty - data collected after each race)
  const engineAnalytics = createInitialEngineAnalytics(teams.map((t) => t.id));

  // Create initial cars (2 per team)
  const cars = createInitialCars(teams);

  // Create player info and date
  const player: PlayerInfo = {
    name: playerName,
    teamId,
    careerStartSeason: seasonNumber,
  };

  // Start at pre-season (January 1st of the season's year)
  const currentDate: GameDate = getPreSeasonStartDate(seasonNumber);

  // Generate appointment news for game start
  const playerTeam = teams.find((t) => t.id === teamId);
  const teamDrivers = drivers.filter((d) => d.teamId === teamId);
  const pendingAppointmentNews = playerTeam
    ? createAppointmentNews(playerName, playerTeam, teamDrivers, seasonNumber)
    : null;

  // Create initial calendar event for the appointment headline
  const initialCalendarEvents = pendingAppointmentNews
    ? [
        {
          id: randomUUID(),
          date: currentDate,
          type: CalendarEventType.Headline,
          subject: pendingAppointmentNews.headline,
          body: pendingAppointmentNews.articleBody,
          critical: false,
        },
      ]
    : [];

  // Assemble complete game state
  const now = new Date().toISOString();
  return {
    version: SAVE_VERSION,
    gameId: randomUUID(),
    createdAt: now,
    lastSavedAt: now,

    player,
    currentDate,
    phase: GamePhase.PreSeason,
    simulation: { ...DEFAULT_SIMULATION_STATE },
    calendarEvents: initialCalendarEvents,

    currentSeason,

    teams,
    drivers,
    chiefs,
    principals,
    sponsors,
    manufacturers,
    circuits,
    cars,

    driverStates,
    teamStates,

    sponsorDeals,
    manufacturerContracts,
    manufacturerSpecs,
    engineAnalytics,
    negotiations: [],

    pastSeasons: [],
    events: [],
    partsLog: [],
    rules,
    pendingAppointmentNews,
  };
}
