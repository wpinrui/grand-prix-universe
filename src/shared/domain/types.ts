/**
 * Core domain types for Grand Prix Universe
 * All rating attributes use 0-100 scale unless otherwise noted
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum Department {
  Commercial = 'commercial',
  Design = 'design',
  Mechanics = 'mechanics',
}

export enum StaffQuality {
  Trainee = 'trainee',
  Average = 'average',
  Good = 'good',
  VeryGood = 'very-good',
  Excellent = 'excellent',
}

export enum TyreCompound {
  Soft = 'soft',
  Medium = 'medium',
  Hard = 'hard',
  Intermediate = 'intermediate',
  Wet = 'wet',
}

export enum DriverRole {
  First = 'first',
  Second = 'second',
  Equal = 'equal',
  Test = 'test',
}

export enum ChiefRole {
  Designer = 'designer',
  Mechanic = 'mechanic',
  Commercial = 'commercial',
}

export enum SponsorTier {
  Title = 'title', // Name prefixed to team name (e.g., "Oracle Red Bull Racing")
  Major = 'major', // Significant logo placement, good money
  Minor = 'minor', // Small cash sponsors, logo on car
}

export enum ManufacturerType {
  Engine = 'engine',
  Tyre = 'tyre',
  Fuel = 'fuel',
}

export enum ManufacturerDealType {
  Customer = 'customer', // You pay for supplies
  Partner = 'partner', // Free supplies, no cash
  Works = 'works', // Free supplies + cash + R&D priority
}

// =============================================================================
// DESIGN SYSTEM TYPES
// =============================================================================

/**
 * ChassisDesignStage - The 4 stages of designing a new chassis
 * Each stage requires completion (0-10 progress) before moving to next
 * GPW-faithful: Design → CFD → Model → Wind Tunnel
 */
export enum ChassisDesignStage {
  Design = 'design', // Computer model "blueprint"
  CFD = 'cfd', // Computational Fluid Dynamics simulation
  Model = 'model', // Physical scale model construction
  WindTunnel = 'wind-tunnel', // Real wind tunnel testing (requires facility)
}

/**
 * TechnologyComponent - The 7 internal car components that can be improved
 * Each has Performance and Reliability attributes (0-100 scale)
 */
export enum TechnologyComponent {
  Brakes = 'brakes',
  Clutch = 'clutch',
  Electronics = 'electronics',
  Gearbox = 'gearbox',
  Hydraulics = 'hydraulics',
  Suspension = 'suspension',
  Throttle = 'throttle',
}

/**
 * TechnologyAttribute - What aspect of a component is being improved
 */
export enum TechnologyAttribute {
  Performance = 'performance', // Speed/function improvement
  Reliability = 'reliability', // Failure rate reduction
}

/**
 * HandlingProblem - The 8 chassis handling problems that can be discovered
 * Revealed through Development Testing, each has a solution to design
 */
export enum HandlingProblem {
  OversteerFast = 'oversteer-fast', // Less grip on high-speed circuits
  OversteerSlow = 'oversteer-slow', // Less grip on low-speed circuits
  UndersteerFast = 'understeer-fast', // Increased tyre wear on high-speed circuits
  UndersteerSlow = 'understeer-slow', // Increased tyre wear on low-speed circuits
  HighDrag = 'high-drag', // Increased fuel consumption and engine heat
  PoorBalance = 'poor-balance', // Increased brake wear, harder to control
  LowDownforce = 'low-downforce', // Less grip overall
  HighPitchSensitivity = 'high-pitch-sensitivity', // Less grip in wind, suspension wear
}

/**
 * ChassisStageProgress - Progress for a single chassis design stage
 * Max 10 points per stage, 40 total for a perfect chassis
 */
export interface ChassisStageProgress {
  stage: ChassisDesignStage;
  progress: number; // 0-10
  completed: boolean;
}

/**
 * ChassisDesign - State of a chassis being designed (next year's car)
 * Tracks progress through all 4 stages and overall efficiency
 */
export interface ChassisDesign {
  targetSeason: number; // Which season this chassis is for
  stages: ChassisStageProgress[];
  designersAssigned: number; // Staff currently working on this
  efficiencyRating: number; // 0-100, calculated from stage progress + chief ability
  isLegal: boolean; // Meets FIA regulations (can become illegal if regs change)
  startedAt: GameDate | null; // When design work began
  accumulatedWorkUnits: number; // Partial progress toward next stage point
}

/**
 * TechnologyLevel - Current level of a technology component
 * Both attributes range 0-100 (10 = worst on grid, 60 = best on grid after normalization)
 */
export interface TechnologyLevel {
  component: TechnologyComponent;
  performance: number; // 0-100
  reliability: number; // 0-100
}

/**
 * TechnologyProjectPhase - Phase of a technology improvement project
 * Discovery: Waiting for breakthrough (daily probability check)
 * Development: Working toward completion (known payoff/timeframe)
 */
export enum TechnologyProjectPhase {
  Discovery = 'discovery',
  Development = 'development',
}

/**
 * TechnologyDesignProject - An in-progress technology improvement
 * Multiple projects can be active simultaneously per team
 *
 * Phase flow:
 * 1. Discovery: Designers assigned, daily probability check for breakthrough
 * 2. Development: Breakthrough discovered, working toward completion with known payoff/timeframe
 */
export interface TechnologyDesignProject {
  component: TechnologyComponent;
  attribute: TechnologyAttribute;
  phase: TechnologyProjectPhase;
  designersAssigned: number; // Percentage of designer capacity (0-100)
  startedAt: GameDate;

  // Development phase fields (set when breakthrough is discovered)
  payoff: number | null; // How much the stat will increase (e.g., +8)
  workUnitsRequired: number | null; // Total work units needed to complete
  workUnitsCompleted: number; // Progress toward workUnitsRequired
}

/**
 * HandlingProblemState - State of a discovered handling problem
 * Problems are discovered through testing, then solutions are designed
 */
export interface HandlingProblemState {
  problem: HandlingProblem;
  discovered: boolean; // Found through development testing
  solutionProgress: number; // 0-10 for designing the fix
  solutionDesigned: boolean; // Ready for construction
  solutionInstalled: boolean; // Upgrade applied to cars
}

/**
 * CurrentYearChassisState - State of current season's chassis improvements
 * Tracks handling revelation and problem solutions
 */
export interface CurrentYearChassisState {
  handlingRevealed: number | null; // null = not revealed, number = revealed handling %
  problems: HandlingProblemState[];
  activeDesignProblem: HandlingProblem | null; // Which problem is being worked on
  designersAssigned: number;
  accumulatedSolutionWorkUnits: number; // Partial progress toward next solution point
}

// =============================================================================
// DEVELOPMENT TESTING TYPES
// =============================================================================

/**
 * TestSession - State of an active development testing session
 *
 * Development testing discovers handling problems in the current year's chassis:
 * - First test completion reveals the overall Handling % (0-100)
 * - Subsequent tests reveal one specific handling problem each
 *
 * Mechanics are allocated to testing (similar to designers for design work).
 * Work units accumulate daily based on mechanic capacity × allocation.
 */
export interface TestSession {
  /** Whether a test session is currently active */
  active: boolean;

  /** Driver performing the testing (any team driver can test) */
  driverId: string | null;

  /** Percentage of mechanic department allocated to testing (0-100) */
  mechanicsAllocated: number;

  /** Progress toward test completion (0-10, 10 = complete) */
  progress: number;

  /** Partial work units accumulated toward next progress point */
  accumulatedWorkUnits: number;

  /** Number of development tests completed this season */
  testsCompleted: number;
}

/**
 * DesignState - Complete design department state for a team
 * Contains all chassis, technology, and improvement tracking
 */
export interface DesignState {
  /** Next year's chassis design (null if not started) */
  nextYearChassis: ChassisDesign | null;

  /** Current technology levels for all 7 components (0-100 scale) */
  technologyLevels: TechnologyLevel[];

  /** Active technology design projects (multiple can run in parallel) */
  activeTechnologyProjects: TechnologyDesignProject[];

  /** Current year chassis state (handling problems/solutions) */
  currentYearChassis: CurrentYearChassisState;
}

// =============================================================================
// FACTORY TYPES
// =============================================================================

/**
 * FacilityType - Types of facilities in the factory
 * Each facility has quality levels 0-5 (0 = not owned)
 */
export enum FacilityType {
  WindTunnel = 'wind-tunnel', // Required for chassis design stage 4
  CAD = 'cad', // Computer-Aided Design - speeds chassis/upgrade design
  CAM = 'cam', // Computer-Aided Manufacturing - speeds chassis/upgrade design
  Supercomputer = 'supercomputer', // Speeds chassis/upgrade design
  Workshop = 'workshop', // Speeds technology and driving aid design
  TestRig = 'test-rig', // Speeds all testing (quality 1-5)
}

/**
 * Facility - A single facility in the factory
 * Quality 0 = not owned, 1-5 = quality level
 */
export interface Facility {
  type: FacilityType;
  quality: number; // 0-5 (0 = not owned)
}

/**
 * FactoryLimits - Capacity constraints for the factory
 * Expanding the factory increases these limits
 */
export interface FactoryLimits {
  staffLimit: number; // Max total staff (excluding chiefs and drivers)
  departmentLimit: number; // Max staff per department
  facilityLimit: number; // Max number of facilities
}

/**
 * Factory - Complete factory state for a team
 * Contains facilities and capacity limits
 */
export interface Factory {
  facilities: Facility[];
  limits: FactoryLimits;
}

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * StaffCounts - Anonymous staff pool tracked by quality level
 * GPW-style: staff are not named individuals, just counts per quality tier
 */
export type StaffCounts = Record<StaffQuality, number>;

/**
 * DepartmentStaffCounts - Staff counts for all departments
 * Keyed by Department enum value
 */
export type DepartmentStaffCounts = Record<Department, StaffCounts>;

/**
 * Team - The central entity representing an F1 team
 */
export interface Team {
  id: string; // kebab-case slug, e.g. "phoenix-racing"
  name: string;
  shortName: string; // 3-letter abbreviation, e.g. "PHX"
  primaryColor: string; // hex color for UI theming
  secondaryColor: string;
  headquarters: string; // country/location
  principal: string; // team principal/boss name, e.g. "Frank Williams"
  description: string; // 2-4 sentence team bio/history for team selection screen
  logoUrl: string | null; // URL to team logo image, null = use color swatches as fallback
  budget: number; // current balance in dollars
  factory: Factory; // Factory facilities and limits
  initialEngineManufacturerId: string; // engine supplier at game start
  initialSponsorIds: string[]; // sponsor IDs for game start
  initialStaffCounts: DepartmentStaffCounts; // staff counts at game start
  initialChassisHandling: number; // 0-100, starting chassis handling quality
}

/**
 * Driver attributes - all 0-100 scale
 */
export interface DriverAttributes {
  pace: number; // 1-lap qualifying speed
  consistency: number; // smaller gap between worst/best variation
  focus: number; // ability to avoid mistakes (incl. terminal crashes)
  overtaking: number; // overtake success rate relative to pace advantage
  wetWeather: number; // performance in rain conditions
  smoothness: number; // lower tyre/component wear per push level
  defending: number; // defense success rate relative to pace disadvantage
}

/**
 * HistoricalRaceResult - Individual race result for career history
 */
export interface HistoricalRaceResult {
  round: number; // Race number in the season (1, 2, 3...)
  name: string; // Race name (e.g., "Bahrain Grand Prix")
  circuitId: string; // Circuit identifier
  position: number | null; // Finishing position, null if DNF/DNS
  points: number; // Points scored
  status: string; // "Finished", "+1 Lap", "Collision", etc.
}

/**
 * CareerSeasonRecord - Historical season performance for perceived market value calculation
 * Used to calculate a driver's contribution ratio (driver points / team points) over time
 */
export interface CareerSeasonRecord {
  season: number; // Calendar year (e.g., 2024)
  teamId: string; // Team they drove for that season
  races: HistoricalRaceResult[]; // Individual race results
  totalPoints: number; // Driver's total WDC points that season
  teamTotalPoints: number; // Team's total WCC points that season
  championshipPosition?: number; // Final WDC position
}

/**
 * Driver - A racing driver or test driver
 */
export interface Driver {
  id: string; // kebab-case slug
  firstName: string;
  lastName: string;
  nationality: string; // country code, e.g. "GB", "DE"
  dateOfBirth: string; // ISO date string
  photoUrl: string | null; // URL to driver photo, null = use faces.js procedural generation
  raceNumber?: number; // Car number (e.g., 1, 44, 33), optional for free agents
  teamId: string | null; // null if free agent
  role: DriverRole;
  attributes: DriverAttributes;
  reputation: number; // 0-100, market value (results-biased, recency-biased)
  salary: number; // per-season salary in dollars
  contractEnd: number; // season number when contract expires
  careerHistory?: CareerSeasonRecord[]; // Past 5 years max, for perceived market value
}

/**
 * Chief - Department head with significant impact on team performance
 */
export interface Chief {
  id: string;
  firstName: string;
  lastName: string;
  role: ChiefRole;
  ability: number; // 0-100, critical to department performance
  teamId: string | null;
  salary: number;
  contractEnd: number;
}

/**
 * TeamPrincipal - The team boss/manager
 * Responsible for overall team strategy, negotiations, and leadership
 */
export interface TeamPrincipal {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  ability: number; // 0-100, management/leadership skill
  teamId: string | null; // null = available for hire
  salary: number;
  contractEnd: number;
}

// =============================================================================
// TECHNICAL TYPES
// =============================================================================

/**
 * Engine stats - the 5 attributes of an engine
 * All values 0-100, normalized to max 70 at season start
 */
export interface EngineStats {
  power: number; // Raw speed/lap time
  fuelEfficiency: number; // Fuel usage per lap
  reliability: number; // DNF probability per race (higher = more reliable)
  heat: number; // Performance in hot races (higher = better heat management)
  predictability: number; // Driver error rate modifier (higher = more predictable)
}

/**
 * Manufacturer costs - what it costs the manufacturer to provide each product
 * Used to determine pricing and profitability constraints
 */
export interface ManufacturerCosts {
  baseEngine: number; // Cost to manufacture a single engine
  upgrade: number; // Cost per spec upgrade
  customisationPoint: number; // Cost per allocation point granted
  optimisation: number; // Cost for the optimisation package
}

/**
 * Manufacturer - A company that supplies engines, tyres, or fuel
 */
export interface Manufacturer {
  id: string; // kebab-case slug, e.g. "honda-racing"
  name: string; // display name, e.g. "Honda Racing Development"
  type: ManufacturerType;
  reputation: number; // 0-100, affects attractiveness to teams
  annualCost: number; // yearly base contract cost in dollars (2 engines)
  engineStats: EngineStats; // Base engine stats for this manufacturer
  costs: ManufacturerCosts; // Manufacturer's internal costs (for profitability)
  worksTeamId: string | null; // Factory team (historical/display only)
  partnerTeamIds: string[]; // Partner teams (historical/display only)
}

/**
 * Car - A physical racing car owned by a team
 */
export interface Car {
  id: string;
  teamId: string;
  chassisId: string; // reference to chassis design
  condition: number; // 0-100, degrades with use/damage
  mileage: number; // total miles driven
  isRaceCar: boolean; // false = R&D car
}

// =============================================================================
// CIRCUIT TYPES
// =============================================================================

/**
 * Circuit characteristics - affect car setup and strategy
 */
export interface CircuitCharacteristics {
  speedRating: number; // 0-100, average circuit speed
  downforceRequirement: number; // 0-100, aero needs
  brakingDemand: number; // 0-100, brake stress
  tyreWear: number; // 0-100, surface abrasiveness
  overtakingOpportunity: number; // 0-100, passing ease
  wetWeatherLikelihood: number; // 0-100, rain probability
}

/**
 * Circuit - A racing track on the calendar
 */
export interface Circuit {
  id: string; // e.g. "monaco"
  name: string; // e.g. "Monte Carlo Street Circuit"
  location: string; // city
  country: string;
  lengthKm: number; // lap length in kilometers
  laps: number; // race distance in laps
  characteristics: CircuitCharacteristics;
}

// =============================================================================
// COMMERCIAL TYPES
// =============================================================================

/**
 * Sponsor - A commercial sponsor (team/cash sponsors, not technical suppliers)
 */
export interface Sponsor {
  id: string; // kebab-case slug, e.g. "globex-corp"
  name: string; // display name, e.g. "Globex Corporation"
  industry: string; // e.g. "technology", "finance", "automotive"
  tier: SponsorTier;
  baseMonthlyPayment: number; // base monthly payment (negotiable)
  minReputation: number; // 0-100, team must have at least this reputation
  rivalGroup: string | null; // sponsors in same group are mutually exclusive
  logoUrl: string | null; // URL to sponsor logo, null = use industry icon fallback
}

// =============================================================================
// CONFIG TYPES (Game Rules)
// =============================================================================

export enum QualifyingFormat {
  Knockout = 'knockout', // Q1/Q2/Q3 elimination style
  SingleLap = 'single-lap', // One-shot qualifying
  Aggregate = 'aggregate', // Best time from multiple sessions
}

export interface PointsConfig {
  system: number[]; // Points by position (index 0 = 1st place)
  fastestLapBonus: {
    enabled: boolean;
    points: number;
    requiresTopN: number; // Must finish in top N to get bonus
  };
}

export interface GridConfig {
  teamsCount: number;
  carsPerTeam: number;
}

export interface PracticeConfig {
  sessions: number;
  durationMinutes: number;
}

export interface QualifyingConfig {
  format: QualifyingFormat;
  eliminationsPerSession: number[]; // How many eliminated in each session
}

export interface RaceConfig {
  distanceMultiplier: number; // Multiplier for circuit-defined laps
  mandatoryPitStops: boolean;
  requireCompoundChange: boolean;
}

export interface RaceWeekendConfig {
  practice: PracticeConfig;
  qualifying: QualifyingConfig;
  race: RaceConfig;
}

export interface GameRules {
  points: PointsConfig;
  grid: GridConfig;
  raceWeekend: RaceWeekendConfig;
}

// =============================================================================
// REGULATIONS TYPES (In-universe FIA rules, vary by season)
// =============================================================================

export interface TestingRegulations {
  maxMilesPerWeek: number;
  preSeasonDays: number;
}

export interface EngineRegulations {
  unitsPerSeason: number;
  gridPenaltyPerUnit: number;
}

export interface GearboxRegulations {
  racesPerUnit: number;
  gridPenalty: number;
}

export interface TyreRegulations {
  compoundsPerWeekend: number;
  drySetsPerWeekend: number;
}

export interface SeasonRegulations {
  season: number;
  testing: TestingRegulations;
  engines: EngineRegulations;
  gearbox: GearboxRegulations;
  tyres: TyreRegulations;
  technologyCarryover: string[]; // Component IDs that carry over between seasons
}

export interface Regulations {
  seasons: SeasonRegulations[];
  default: SeasonRegulations;
}

// =============================================================================
// COMPOUND CONFIG TYPES (Tyre compound definitions)
// =============================================================================

/**
 * TyreCompoundConfig - Defines properties of a tyre compound type
 * Used by the race engine to determine grip, wear, and conditions
 */
export interface TyreCompoundConfig {
  id: TyreCompound; // Must match TyreCompound enum value
  name: string; // Display name, e.g. "Soft"
  shortName: string; // 1-letter abbreviation for UI, e.g. "S"
  color: string; // Hex color for UI visualization
  baseGrip: number; // 0-100, relative grip level
  baseDurability: number; // 0-100, how quickly it degrades
  isWetCompound: boolean; // True for intermediate/wet compounds
}

export interface CompoundsConfig {
  compounds: TyreCompoundConfig[];
}

// =============================================================================
// GAME CREATION TYPES
// =============================================================================

/**
 * NewGameParams - Parameters for creating a new game
 * Used by both IPC layer and GameStateManager service
 */
export interface NewGameParams {
  playerName: string;
  teamId: string;
  seasonNumber?: number;
}

// =============================================================================
// EVENTS INFRASTRUCTURE
// =============================================================================

/**
 * EntityType - Types of entities that can be involved in game events
 * Used for filtering and querying events by participant type
 */
export enum EntityType {
  Driver = 'driver',
  Team = 'team',
  Manager = 'manager', // The player
  Circuit = 'circuit',
  Sponsor = 'sponsor',
  Staff = 'staff', // Chiefs
}

/**
 * EntityRef - Reference to an entity involved in an event
 * Enables querying events by any participant
 */
export interface EntityRef {
  type: EntityType;
  id: string;
}

/**
 * EventImportance - Significance level for filtering and display
 * - high: Major events (championships, first wins, signings)
 * - medium: Notable events (race results, contract renewals)
 * - low: Minor events (routine updates, small changes)
 */
export type EventImportance = 'high' | 'medium' | 'low';

/**
 * GameEventType - Discriminated union of all event types
 * Add new event types here as features are built.
 * Each category groups related events for easier filtering.
 */
export type GameEventType =
  // Career events
  | 'CAREER_STARTED'
  | 'TEAM_CHANGED'
  // Racing events (added when race engine emits events)
  | 'RACE_FINISH'
  | 'QUALIFYING_RESULT'
  | 'RACE_RETIREMENT'
  | 'CRASH_INCIDENT'
  // Championship events (added when season processor emits events)
  | 'CHAMPIONSHIP_WON'
  | 'POSITION_IMPROVED'
  | 'POINTS_MILESTONE'
  // Contract events (added when staff/contract systems emit events)
  | 'DRIVER_SIGNED'
  | 'DRIVER_RELEASED'
  | 'STAFF_HIRED'
  | 'STAFF_FIRED'
  | 'CONTRACT_EXPIRED'
  // Commercial events (added when financial systems emit events)
  | 'SPONSOR_SIGNED'
  | 'SPONSOR_LOST'
  | 'PRIZE_MONEY_RECEIVED'
  // Technical events (added when engineering systems emit events)
  | 'CAR_DESIGNED'
  | 'UPGRADE_COMPLETED'
  | 'TEST_SESSION_RUN'
  // Media events (future)
  | 'MEDIA_STATEMENT'
  | 'PRESS_CONFERENCE';

/**
 * EventQuery - Parameters for filtering and retrieving events
 * Used by queryEvents() to find events matching specific criteria
 */
export interface EventQuery {
  /** Filter by entity IDs (OR logic - must involve ANY of these entities) */
  entityIds?: string[];

  /** Filter by entity types (OR logic - must involve ANY of these types) */
  entityTypes?: EntityType[];

  /** Filter by event types (OR logic - must match ANY of these types) */
  types?: GameEventType[];

  /** Filter by date range (inclusive) */
  dateRange?: { from: GameDate; to: GameDate };

  /** Filter by minimum importance level (low includes all, high only high) */
  minImportance?: EventImportance;

  /** Maximum number of events to return */
  limit?: number;

  /** Number of events to skip (for pagination) */
  offset?: number;

  /** Sort order by date (default: 'desc' = newest first) */
  order?: 'asc' | 'desc';
}

/**
 * GameEvent - A recorded in-game occurrence
 *
 * Events are the source of truth for game history. They are:
 * - Immutable once created
 * - Append-only (no deletion in normal gameplay)
 * - Queryable by entity, type, date, importance
 *
 * Used by: Player Wiki, News, Emails, Engine simulations, Commentary
 */
export interface GameEvent {
  /** Unique identifier (UUID) */
  id: string;

  /** Event type - determines the structure of data payload */
  type: GameEventType;

  /** In-game date when event occurred */
  date: GameDate;

  /** All entities involved in this event (for querying) */
  involvedEntities: EntityRef[];

  /**
   * Event-specific payload
   * Structure varies by event type. Examples:
   * - CAREER_STARTED: { teamId, playerName }
   * - RACE_FINISH: { position, points, circuitId }
   * - DRIVER_SIGNED: { contractLength, salary }
   */
  data: Record<string, unknown>;

  /** Significance level for filtering/display */
  importance: EventImportance;

  /** Real-world timestamp for ordering same-day events */
  createdAt: number;
}

// =============================================================================
// GAME STATE TYPES
// =============================================================================

// -----------------------------------------------------------------------------
// Game Session & Time
// -----------------------------------------------------------------------------

/**
 * GamePhase - Current phase of the game loop
 * Determines what actions are available to the player
 */
export enum GamePhase {
  PreSeason = 'pre-season', // Before first race - testing, prep
  BetweenRaces = 'between-races', // Normal turn - management, negotiation
  RaceWeekend = 'race-weekend', // At a race - practice, quali, race
  PostSeason = 'post-season', // After final race - end-of-year processing
}

/**
 * GameDate - Current position in the game timeline
 * Day-by-day progression with sliding calendar UI
 */
export interface GameDate {
  year: number;  // Calendar year (e.g., 2025)
  month: number; // Month (1-12)
  day: number;   // Day of month (1-31)
}

/**
 * SimulationState - Controls for time progression
 * Manages play/pause and speed of day advancement
 */
export interface SimulationState {
  isSimulating: boolean; // True when time is actively advancing
  speed: number;         // Days per second (default 1)
}

/**
 * CalendarEventType - Types of events that appear on the calendar
 */
export enum CalendarEventType {
  Email = 'email',
  Headline = 'headline',
  Projection = 'projection', // Estimated future completion (updates daily)
}

/**
 * NewsSource - Fictional news outlets with distinct tones
 * Used for news articles to create variety and authentic journalism feel
 */
export enum NewsSource {
  F1Official = 'f1-official', // Formal, press release style
  TheRace = 'the-race', // Opinionated, analytical sports journalism
  LocalMedia = 'local-media', // Regional race coverage, local angle
  PitlaneInsider = 'pitlane-insider', // Insider rumors and speculation
  TechAnalysis = 'tech-analysis', // Technical deep dives
}

/**
 * NewsCategory - Categorizes news articles by topic
 * Used for filtering and styling in the News screen
 */
export enum NewsCategory {
  PreSeason = 'pre-season', // Season previews, predictions
  RacePreview = 'race-preview', // Before each race
  RaceResult = 'race-result', // Post-race coverage
  Transfer = 'transfer', // Driver/staff moves
  Technical = 'technical', // Design and development
  Championship = 'championship', // Standings analysis
  Rumor = 'rumor', // Speculation and gossip
  Commentary = 'commentary', // Opinion pieces, roundups
}

/**
 * NewsQuote - A quote from a person in a news article
 * Can be named (real character) or anonymous (sources close to...)
 */
export interface NewsQuote {
  text: string;
  attribution: string; // "Christian Horner" or "sources close to the team"
  attributionRole?: string; // "Red Bull Team Principal" (only for named quotes)
  isNamed: boolean; // true = named person, false = anonymous source
}

// =============================================================================
// NEWS EVENT TYPES (Event-Driven News System)
// =============================================================================
// Events are pushed when things happen in the game (races, contracts, upgrades)
// and the news generator consumes them to create reactive news articles.

/**
 * NewsEventType - Types of events that can trigger news generation
 * Each event type creates specific news content based on what happened
 */
export enum NewsEventType {
  // Race events
  RaceResult = 'race-result', // Full race result with winner, podium, drama
  QualifyingResult = 'qualifying-result', // Quali results, surprises
  RetirementDrama = 'retirement-drama', // DNFs, crashes, collisions

  // Championship events
  ChampionshipLead = 'championship-lead', // Driver/team takes WDC/WCC lead
  ChampionshipDecided = 'championship-decided', // Title mathematically won
  ChampionshipMilestone = 'championship-milestone', // First win, 100 points, etc.

  // Contract/Transfer events
  DriverSigned = 'driver-signed', // Driver signs with team
  DriverReleased = 'driver-released', // Driver leaves team
  StaffHired = 'staff-hired', // Chief hired
  StaffDeparture = 'staff-departure', // Chief leaves

  // Technical events
  SpecReleased = 'spec-released', // Engine manufacturer releases new spec
  MajorUpgrade = 'major-upgrade', // Team completes significant upgrade

  // Season events
  SeasonStart = 'season-start', // Pre-season begins
  SeasonPreview = 'season-preview', // Before first race
  MidSeasonAnalysis = 'mid-season-analysis', // Halfway through season
}

/**
 * NewsEvent - An event pushed to the queue when something newsworthy happens
 * The news generator consumes these to create reactive articles
 *
 * @agent: When emitting events, include all relevant data needed to write
 * a full news article. Don't make the news generator look things up.
 */
export interface NewsEvent {
  /** Unique event ID */
  id: string;
  /** What type of event this is */
  type: NewsEventType;
  /** When the event occurred */
  date: GameDate;
  /** Event importance (affects news priority and card size) */
  importance: EventImportance;
  /** Whether this event has been processed into a news article */
  processed: boolean;
  /**
   * Event-specific payload with all data needed to generate the article.
   * Structure varies by type. Examples:
   * - RaceResult: { raceNumber, circuitName, winnerId, winnerName, winnerTeam, podium, drama[] }
   * - DriverSigned: { driverId, driverName, teamId, teamName, previousTeamName, contractYears }
   * - SpecReleased: { manufacturerId, manufacturerName, specVersion, statImprovements }
   */
  data: Record<string, unknown>;
}

/**
 * EmailCategory - Categorizes emails by source/type
 * Used to style and filter emails appropriately
 */
export enum EmailCategory {
  ChassisStageComplete = 'chassis-stage-complete',
  TechBreakthrough = 'tech-breakthrough',
  TechDevelopmentComplete = 'tech-development-complete',
  HandlingSolutionComplete = 'handling-solution-complete',
  TestComplete = 'test-complete',
  PartReady = 'part-ready',
  PostRaceRepair = 'post-race-repair',
  SpecRelease = 'spec-release',
}

/**
 * EmailData - Structured data for rich email detail rendering
 * Each email category has its own data shape for category-specific UI
 *
 * @agent: When adding new email categories, add a corresponding EmailData type
 * and update the EmailDataMap. The Mail detail panel uses this for rich rendering.
 */
export interface ChassisStageCompleteData {
  category: EmailCategory.ChassisStageComplete;
  chassisYear: number; // e.g., 2026
  completedStageIndex: number; // 0-3 (Design, CFD, Model, Wind Tunnel)
  stageName: string; // Display name of completed stage
  efficiency: number; // Current chassis efficiency (0-100)
  chiefId?: string; // For EntityLink to chief
}

export interface TechBreakthroughData {
  category: EmailCategory.TechBreakthrough;
  component: TechnologyComponent;
  attribute: TechnologyAttribute;
  componentName: string; // Display name
  attributeName: string; // "Performance" or "Reliability"
  statIncrease: number; // e.g., +5
  estimatedDays: number; // Development time estimate
  chiefId?: string;
}

export interface TechDevelopmentCompleteData {
  category: EmailCategory.TechDevelopmentComplete;
  component: TechnologyComponent;
  attribute: TechnologyAttribute;
  componentName: string;
  attributeName: string;
  statIncrease: number;
  newValue: number; // Final stat value after increase
  chiefId?: string;
}

export interface HandlingSolutionCompleteData {
  category: EmailCategory.HandlingSolutionComplete;
  problem: HandlingProblem;
  problemName: string; // Display name
  handlingImprovement: number;
  chiefId?: string;
}

export interface TestCompleteData {
  category: EmailCategory.TestComplete;
  testsCompleted: number; // Total tests completed
  handlingRevealed: number | null; // Set on first test
  problemDiscovered: HandlingProblem | null; // Set on subsequent tests
  problemName: string | null; // Display name of discovered problem
  chiefMechanicId?: string;
}

export interface PartReadyData {
  category: EmailCategory.PartReady;
  pendingPartId: string; // ID of the pending part for installation
  item: string; // Display name e.g. "Brakes Performance +6"
  payoff: number; // Stat improvement amount
  baseCost: number; // Cost to install on one car
  recommendedCar: 1 | 2; // Which car to recommend (based on driver roles)
  recommendedDriverId: string; // Driver ID for EntityLink
  recommendedDriverName: string; // For display
  otherDriverId: string; // The other driver
  otherDriverName: string;
  chiefId?: string;
}

/** Repair cost breakdown for a single car */
export interface CarRepairCost {
  carNumber: 1 | 2;
  driverId: string;
  driverName: string;
  baseCost: number; // Routine maintenance
  incidentCost: number; // Additional cost from DNF/crash
  totalCost: number;
  wasRetired: boolean; // True if driver retired from race
}

export interface PostRaceRepairData {
  category: EmailCategory.PostRaceRepair;
  raceNumber: number;
  circuitName: string;
  car1: CarRepairCost;
  car2: CarRepairCost;
  totalCost: number;
}

/** Stat improvement included in a spec release */
export interface SpecReleaseStatChange {
  stat: keyof SpecBonus;
  statName: string; // Display name (e.g., "Power")
  improvement: number; // e.g., +3
}

export interface SpecReleaseData {
  category: EmailCategory.SpecRelease;
  manufacturerId: string;
  manufacturerName: string;
  newSpecVersion: number; // e.g., 2 for "Spec 2.0"
  statChanges: SpecReleaseStatChange[];
  /** True if the player's team uses this manufacturer */
  affectsPlayer: boolean;
}

export type EmailData =
  | ChassisStageCompleteData
  | TechBreakthroughData
  | TechDevelopmentCompleteData
  | HandlingSolutionCompleteData
  | TestCompleteData
  | PartReadyData
  | PostRaceRepairData
  | SpecReleaseData;

/**
 * CalendarEvent - An event displayed on the calendar strip
 * Shows brief text on the relevant day; full content via Mail/News screens
 */
export interface CalendarEvent {
  id: string;
  date: GameDate;
  type: CalendarEventType;
  subject: string;   // Brief text shown on calendar
  critical: boolean; // If true, auto-stops simulation
  emailCategory?: EmailCategory; // Only set when type is Email
  sender?: string;   // Email sender name (e.g., "Adrian Newey (Chief Designer)")
  senderId?: string; // Chief ID for face generation lookup
  body?: string;     // Full email body text
  data?: EmailData;  // Structured data for rich detail panel rendering
  // News-specific fields (only set when type is Headline)
  newsSource?: NewsSource; // Which fictional outlet published this
  newsCategory?: NewsCategory; // Topic category for filtering
  quotes?: NewsQuote[]; // Embedded quotes in the article
  importance?: EventImportance; // Affects card size in News UI
}

// -----------------------------------------------------------------------------
// Parts & Repairs Log
// -----------------------------------------------------------------------------

/**
 * PartsLogEntryType - Type of entry in the parts log
 */
export enum PartsLogEntryType {
  Upgrade = 'upgrade',
  Repair = 'repair',
}

/**
 * PartsLogEntry - A single entry in the parts & repairs history log
 *
 * Records all part installations and repair costs for the Construction screen.
 * Each part installation creates one or two entries (depending on rush option).
 * Each post-race repair creates two entries (one per car).
 */
export interface PartsLogEntry {
  id: string;
  date: GameDate;
  seasonNumber: number;
  type: PartsLogEntryType;
  /** Display name: "Brakes Performance +6" or "Post-Race Repair" */
  item: string;
  cost: number;
  /** Driver assigned to this car at time of entry (for EntityLink) */
  driverId: string;
  /** Which car received the part/repair */
  carNumber: 1 | 2;
  /** True for "BOTH" installations (rush) */
  rushed?: boolean;
  /** For repairs: "Minor collision", "Routine", "DNF (crash)", etc. */
  repairDetails?: string;
}

/**
 * PendingPartSource - Where the pending part originated from
 */
export enum PendingPartSource {
  Technology = 'technology',
  HandlingSolution = 'handling-solution',
}

/**
 * PendingPart - A part that is being built (1-week build time)
 *
 * When a design project completes (technology breakthrough or handling solution),
 * a PendingPart is created. After 1 week, the player receives an email to choose
 * which car(s) to install it on.
 */
export interface PendingPart {
  id: string;
  /** Where this part came from */
  source: PendingPartSource;
  /** Display name for the part (e.g., "Brakes Performance +6") */
  item: string;
  /** Stat improvement amount (e.g., +6) */
  payoff: number;
  /** Cost to install on one car */
  baseCost: number;
  /** Date when design completed and build started */
  buildStartDate: GameDate;
  /** Date when build completes and part is ready for installation */
  readyDate: GameDate;
  /** Which car(s) this has been installed on (empty = not yet installed) */
  installedOnCars: (1 | 2)[];
  /** For technology parts: which component */
  component?: TechnologyComponent;
  /** For technology parts: which attribute */
  attribute?: TechnologyAttribute;
  /** For handling parts: which problem this fixes */
  handlingProblem?: HandlingProblem;
}

/**
 * PlayerInfo - Information about the human player
 */
export interface PlayerInfo {
  name: string;
  teamId: string; // Which team the player manages
  careerStartSeason: number; // For career stats tracking
}

// -----------------------------------------------------------------------------
// Calendar & Season
// -----------------------------------------------------------------------------

/**
 * CalendarEntry - A single race on the season calendar
 */
export interface CalendarEntry {
  raceNumber: number; // Position in championship (1-based)
  circuitId: string;
  weekNumber: number; // Which week this race occurs (1-52)
  completed: boolean;
  cancelled: boolean; // Rare, but possible
  result?: RaceWeekendResult; // Populated after race completes
}

/**
 * SeasonData - All data for a single season
 * Stored in currentSeason and pastSeasons[]
 */
export interface SeasonData {
  seasonNumber: number;
  calendar: CalendarEntry[];
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  regulations: SeasonRegulations; // Active regulations for this season
}

// -----------------------------------------------------------------------------
// Championship Standings
// -----------------------------------------------------------------------------

/**
 * DriverStanding - A driver's position in the championship
 */
export interface DriverStanding {
  driverId: string;
  teamId: string;
  points: number;
  position: number; // Championship position (1-based)
  wins: number;
  podiums: number;
  polePositions: number;
  fastestLaps: number;
  dnfs: number; // Did Not Finish count
}

/**
 * ConstructorStanding - A team's position in the championship
 */
export interface ConstructorStanding {
  teamId: string;
  points: number;
  position: number; // Championship position (1-based)
  wins: number;
  podiums: number; // Any driver on podium counts
  polePositions: number;
}

// -----------------------------------------------------------------------------
// Race Results
// -----------------------------------------------------------------------------

/**
 * RaceFinishStatus - How a driver's race ended
 */
export enum RaceFinishStatus {
  Finished = 'finished',
  Lapped = 'lapped', // Finished but lapped by winner
  Retired = 'retired', // Mechanical/accident DNF
  Disqualified = 'disqualified',
  DidNotStart = 'dns',
  DidNotQualify = 'dnq', // Failed 107% rule
}

/**
 * WeatherCondition - Weather state during a session
 */
export enum WeatherCondition {
  Dry = 'dry',
  Cloudy = 'cloudy',
  LightRain = 'light-rain',
  HeavyRain = 'heavy-rain',
}

/**
 * DriverQualifyingResult - A driver's qualifying performance
 */
export interface DriverQualifyingResult {
  driverId: string;
  teamId: string;
  gridPosition: number; // Grid position earned (1-based)
  bestLapTime: number; // in ms
  gapToPole: number; // in ms (0 for pole sitter)
  knockedOutInSession?: number; // Q1=1, Q2=2, undefined if made Q3
}

/**
 * DriverRaceResult - A driver's race result
 */
export interface DriverRaceResult {
  driverId: string;
  teamId: string;
  finishPosition: number | null; // Final position (1-based), null if not classified
  gridPosition: number; // Where they started
  lapsCompleted: number;
  totalTime?: number; // in ms, undefined if DNF
  gapToWinner?: number; // Time gap in ms (only for same-lap finishers)
  lapsBehind?: number; // Laps behind leader (only for lapped finishers)
  points: number; // Points earned this race
  fastestLap: boolean; // Did they set fastest lap?
  fastestLapTime?: number; // Their fastest lap in ms
  status: RaceFinishStatus;
  pitStops: number;
}

/**
 * RaceWeekendResult - Complete results for a race weekend
 * Attached to CalendarEntry after race completes
 */
export interface RaceWeekendResult {
  raceNumber: number;
  circuitId: string;
  seasonNumber: number;
  qualifying: DriverQualifyingResult[];
  race: DriverRaceResult[];
  weather: WeatherCondition; // Dominant weather during race
  fastestLapDriverId: string;
  fastestLapTime: number; // in ms
}

// -----------------------------------------------------------------------------
// Runtime State (extends base entity types with live game data)
// -----------------------------------------------------------------------------

/**
 * DriverRuntimeState - Mutable state for a driver during gameplay
 * Keyed by driverId in GameState.driverStates
 */
export interface DriverRuntimeState {
  morale: number; // 0-100, affects performance
  fitness: number; // 0-100, reduced by injury
  fatigue: number; // 0-100, increases over season
  injuryWeeksRemaining: number; // >0 means injured
  banRacesRemaining: number; // >0 means banned from racing
  isAngry: boolean; // From contract disputes, refuses to test
  // Regulation tracking
  engineUnitsUsed: number; // For grid penalty tracking
  gearboxRaceCount: number; // Races since last gearbox change
  // Negotiation personality (persistent per driver, randomized on game start)
  desperationMultiplier: number; // 0.7-1.0, lower = more willing to accept worse offers
}

/**
 * DepartmentMorale - Morale state for all departments
 * GPW uses 1-5 blocks, we use 0-100 scale.
 * Keyed by Department enum value, each value is 0-100.
 */
export type DepartmentMorale = Record<Department, number>;

/**
 * EngineCustomisation - Tuning adjustments applied to an engine
 * Each value can be -10 to +10 (capped to prevent unrealistic min-maxing)
 * Total reallocation is limited by customisation points owned
 */
export interface EngineCustomisation {
  power: number; // -10 to +10
  fuelEfficiency: number;
  reliability: number;
  heat: number;
  predictability: number;
}

/**
 * CarEngineState - Per-car engine state
 * Tracks the current spec version and any customisation applied
 */
export interface CarEngineState {
  specVersion: number; // Current spec (1, 2, 3...) - 1 is base spec at season start
  customisation: EngineCustomisation; // Applied tuning adjustments
}

/**
 * SpecBonus - Stat bonuses provided by a spec version upgrade
 * All values are positive numbers representing stat improvements
 */
export interface SpecBonus {
  power: number;
  fuelEfficiency: number;
  reliability: number;
  heat: number;
  predictability: number;
}

/**
 * ManufacturerSpecState - Tracks spec versions and bonuses for a manufacturer
 * Used globally in GameState to track what specs are available from each supplier
 */
export interface ManufacturerSpecState {
  manufacturerId: string;
  /** Current latest spec version (1 = base spec at season start) */
  latestSpecVersion: number;
  /** Cumulative bonuses for each spec version (index 0 = spec 2 bonuses, etc.) */
  specBonuses: SpecBonus[];
}

// =============================================================================
// ENGINE ANALYTICS TYPES
// =============================================================================

/**
 * EngineAnalyticsDataPoint - A single estimated power reading from a race
 *
 * Each data point has ±8% independent error from the true calculated power.
 * This creates information asymmetry - early season data is sparse and unreliable,
 * but improves as more races are completed.
 */
export interface EngineAnalyticsDataPoint {
  /** Race number where this data was collected */
  raceNumber: number;
  /** Estimated power value (true power ± 8% random error) */
  estimatedPower: number;
}

/**
 * TeamEngineAnalytics - Collected engine analytics data for a team
 *
 * Used to estimate competitor engine performance throughout the season.
 * Data accumulates after each race, with running average shown in UI.
 * More data points = more confidence in the estimate.
 */
export interface TeamEngineAnalytics {
  teamId: string;
  /** Data points collected after each race (one per completed race) */
  dataPoints: EngineAnalyticsDataPoint[];
}

// =============================================================================
// GENERIC CONTRACT NEGOTIATION TYPES
// =============================================================================
// Universal negotiation system for all stakeholder types (drivers, staff,
// sponsors, engine suppliers). Each stakeholder shares the same state machine
// but has unique contract terms and evaluation criteria.
// See proposal.md → "Contract Negotiations System" for full specification.

/**
 * StakeholderType - The type of entity being negotiated with
 * Each type has different contract terms and evaluation criteria
 */
export enum StakeholderType {
  /** Engine manufacturer (power units) */
  Manufacturer = 'manufacturer',
  /** Racing driver */
  Driver = 'driver',
  /** Key personnel (chiefs, engineers) */
  Staff = 'staff',
  /** Financial sponsor */
  Sponsor = 'sponsor',
}

/**
 * NegotiationPhase - The current phase of a negotiation
 * Represents the state machine for all contract negotiations
 */
export enum NegotiationPhase {
  /** Player has initiated contact, waiting for counterparty response */
  AwaitingResponse = 'awaiting-response',
  /** Counterparty has responded, player can act */
  ResponseReceived = 'response-received',
  /** Negotiation complete, deal signed */
  Completed = 'completed',
  /** Negotiation ended without deal (rejected or expired) */
  Failed = 'failed',
}

/**
 * ResponseType - How the counterparty responds to an offer
 */
export enum ResponseType {
  /** Accepts the terms as offered */
  Accept = 'accept',
  /** Proposes modified terms */
  Counter = 'counter',
  /** Declines to continue negotiating */
  Reject = 'reject',
  /** Needs more time to consider (delays response) */
  NeedTime = 'need-time',
}

/**
 * ResponseTone - The emotional tone of a response (affects relationship)
 */
export enum ResponseTone {
  /** Very positive, excited about the opportunity */
  Enthusiastic = 'enthusiastic',
  /** Neutral, businesslike */
  Professional = 'professional',
  /** Unhappy with the offer, but still engaged */
  Disappointed = 'disappointed',
  /** Offended by the offer, relationship damaged */
  Insulted = 'insulted',
}

// -----------------------------------------------------------------------------
// Stakeholder-Specific Contract Terms
// -----------------------------------------------------------------------------

/**
 * DriverContractTerms - Contract terms for signing a driver
 */
export interface DriverContractTerms {
  /** Annual salary */
  salary: number;
  /** Contract duration in seasons (1-5) */
  duration: number;
  /** One-time signing bonus */
  signingBonus: number;
  /** Percentage of prize money as performance bonus (0-100) */
  performanceBonusPercent: number;
  /** Buyout clause amount (paid to release driver early) */
  releaseClause: number;
  /** Guaranteed driver status (Lead/Equal/Support role) */
  driverStatus: DriverRole;
}

/**
 * StaffContractTerms - Contract terms for hiring key personnel
 */
export interface StaffContractTerms {
  /** Annual salary */
  salary: number;
  /** Contract duration in seasons (1-4) */
  duration: number;
  /** One-time signing bonus */
  signingBonus: number;
  /** Buyout clause to poach from another team (if applicable) */
  buyoutRequired: number;
  /** Performance bonus (percentage of salary tied to results) */
  bonusPercent: number;
}

/**
 * SponsorPlacement - Where sponsor branding appears
 */
export enum SponsorPlacement {
  /** Title sponsor - name in team name */
  Primary = 'primary',
  /** Major sponsor - prominent logo placement */
  Secondary = 'secondary',
  /** Minor sponsor - small logo */
  Tertiary = 'tertiary',
}

/**
 * SponsorContractTerms - Contract terms for sponsor deals
 */
export interface SponsorContractTerms {
  /** One-time signing bonus paid when contract is signed */
  signingBonus: number;
  /** Monthly payment to team */
  monthlyPayment: number;
  /** Contract duration in seasons (1-3) */
  duration: number;
  /** Branding placement level */
  placement: SponsorPlacement;
  /** Championship position below which sponsor can exit early */
  exitClausePosition?: number;
}

/**
 * EngineContractTerms - Contract terms for engine supply
 * Type alias for existing ContractTerms (legacy type defined below)
 */
export type EngineContractTerms = ContractTerms;

/**
 * AnyContractTerms - Union of all stakeholder-specific contract terms
 */
export type AnyContractTerms =
  | DriverContractTerms
  | StaffContractTerms
  | SponsorContractTerms
  | EngineContractTerms;

// -----------------------------------------------------------------------------
// Negotiation Round & State
// -----------------------------------------------------------------------------

/**
 * NegotiationRound - A single round of back-and-forth in a negotiation
 * Each offer/counter-offer creates a new round
 */
export interface NegotiationRound<T extends AnyContractTerms = AnyContractTerms> {
  /** Round number (1-based) */
  roundNumber: number;
  /** Who made this offer */
  offeredBy: 'player' | 'counterparty';
  /** The contract terms offered in this round */
  terms: T;
  /** Date the offer was made */
  offeredDate: GameDate;
  /** Date offer expires (counterparty won't wait forever) */
  expiresDate: GameDate;
  /** Response received (if any) */
  responseType?: ResponseType;
  /** Tone of the response (affects relationship) */
  responseTone?: ResponseTone;
  /** Date response was received */
  responseDate?: GameDate;
  /** If true, this is a "take it or leave it" final offer */
  isUltimatum?: boolean;
}

/**
 * BaseNegotiation - Common fields for all negotiation types
 * Extended by stakeholder-specific negotiation interfaces
 */
export interface BaseNegotiation<T extends AnyContractTerms = AnyContractTerms> {
  /** Unique negotiation ID */
  id: string;
  /** Type of stakeholder being negotiated with */
  stakeholderType: StakeholderType;
  /** Team initiating/participating in negotiation */
  teamId: string;
  /** Current phase of the negotiation */
  phase: NegotiationPhase;
  /** Which season this contract would apply to */
  forSeason: number;
  /** Date negotiation started */
  startedDate: GameDate;
  /** Date of last activity (offer/response) */
  lastActivityDate: GameDate;
  /** All rounds of this negotiation */
  rounds: NegotiationRound<T>[];
  /** Current round number */
  currentRound: number;
  /** Maximum rounds before counterparty walks away (personality-driven) */
  maxRounds: number;
  /** Relationship score at start of negotiation (0-100) */
  relationshipScoreBefore: number;
  /** Whether counterparty mentioned competing interest */
  hasCompetingOffer: boolean;
  /** Whether this was initiated by counterparty (proactive outreach) */
  isProactiveOutreach: boolean;
}

/**
 * DriverNegotiation - Negotiation for signing a driver
 */
export interface DriverNegotiation extends BaseNegotiation<DriverContractTerms> {
  stakeholderType: StakeholderType.Driver;
  /** ID of the driver being negotiated with */
  driverId: string;
}

/**
 * StaffNegotiation - Negotiation for hiring key personnel
 */
export interface StaffNegotiation extends BaseNegotiation<StaffContractTerms> {
  stakeholderType: StakeholderType.Staff;
  /** ID of the staff member being negotiated with */
  staffId: string;
  /** Role being offered */
  role: ChiefRole;
}

/**
 * SponsorNegotiation - Negotiation for sponsor deal
 */
export interface SponsorNegotiation extends BaseNegotiation<SponsorContractTerms> {
  stakeholderType: StakeholderType.Sponsor;
  /** ID of the sponsor being negotiated with */
  sponsorId: string;
}

/**
 * ManufacturerNegotiation - Negotiation for engine supply contract
 */
export interface ManufacturerNegotiation extends BaseNegotiation<EngineContractTerms> {
  stakeholderType: StakeholderType.Manufacturer;
  /** ID of the manufacturer being negotiated with */
  manufacturerId: string;
}

/**
 * Negotiation - Discriminated union of all negotiation types
 * Use stakeholderType to narrow the type
 */
export type Negotiation =
  | DriverNegotiation
  | StaffNegotiation
  | SponsorNegotiation
  | ManufacturerNegotiation;

// =============================================================================
// ENGINE CONTRACT TERMS
// =============================================================================

/**
 * ContractTerms - The negotiable terms of an engine contract
 * Used by the generic negotiation system via EngineContractTerms alias
 */
export interface ContractTerms {
  /** Annual fee (positive = team pays, negative = works deal pays team) */
  annualCost: number;
  /** Contract duration in seasons */
  duration: number;
  /** Pre-paid engine upgrades included per season */
  upgradesIncluded: number;
  /** Customisation points included */
  customisationPointsIncluded: number;
  /** Whether optimisation package is included */
  optimisationIncluded: boolean;
}

/**
 * TeamEngineState - Team-level engine state
 * Tracks both cars' engines plus team-wide engine resources
 */
export interface TeamEngineState {
  car1Engine: CarEngineState;
  car2Engine: CarEngineState;
  customisationPointsOwned: number; // Purchased flexibility points (persist across customisations)
  optimisationPurchasedForNextSeason: boolean; // Pre-season purchase for next year
  preNegotiatedUpgrades: number; // Number of pre-paid upgrades remaining this season
}

/**
 * TeamRuntimeState - Mutable state for a team during gameplay
 * Keyed by teamId in GameState.teamStates
 */
export interface TeamRuntimeState {
  morale: DepartmentMorale;
  // Sponsor satisfaction: sponsorId -> 0-100
  // GPW uses 1-5 blocks (20/40/60/80/100 mapping)
  sponsorSatisfaction: Record<string, number>;
  // Staff counts by department and quality (GPW-style anonymous pools)
  staffCounts: DepartmentStaffCounts;
  // Set-up Testing progress (setup points for race car setup)
  setupPoints: number; // Accumulated from set-up testing
  // Development Testing session (discovers handling problems)
  testSession: TestSession;
  // Design department state (chassis, technology, improvements, handling)
  designState: DesignState;
  // Parts being built (1-week build time after design completes)
  pendingParts: PendingPart[];
  // Engine state (per-car specs and team-wide resources)
  engineState: TeamEngineState;
}

/**
 * ActiveSponsorDeal - A sponsor contract currently in effect
 */
export interface ActiveSponsorDeal {
  sponsorId: string;
  teamId: string;
  tier: SponsorTier;
  signingBonus: number; // One-time payment at contract start
  monthlyPayment: number; // Negotiated monthly payment
  guaranteed: boolean; // If true, payment continues even if team underperforms
  startSeason: number;
  endSeason: number; // Last season of contract
}

/**
 * ActiveManufacturerContract - Engine/Tyre/Fuel supplier contract
 */
export interface ActiveManufacturerContract {
  manufacturerId: string;
  teamId: string;
  type: ManufacturerType;
  dealType: ManufacturerDealType;
  annualCost: number; // Negative = they pay you (works deal)
  bonusLevel: number; // 0-3, affects R&D access
  startSeason: number;
  endSeason: number;
}

// -----------------------------------------------------------------------------
// Appointment News (shown on game start / team change)
// -----------------------------------------------------------------------------

/**
 * Driver summary info for appointment news modal
 * Contains key stats shown on the "meet your drivers" banner
 */
export interface AppointmentDriverSummary {
  driverId: string;
  firstName: string;
  lastName: string;
  nationality: string;
  raceNumber?: number;
  /** Driver photo URL */
  photoUrl?: string;
  /** Last season's championship position (if available) */
  lastSeasonPosition?: number;
  /** Last season's points total (if available) */
  lastSeasonPoints?: number;
  /** Contract end season number */
  contractEnd: number;
  /** Annual salary */
  salary: number;
  /** Driver reputation (0-100) */
  reputation: number;
}

/**
 * AppointmentNews - Data for the "You've been appointed" news modal
 * Shown when player joins a team (game start or team change)
 */
export interface AppointmentNews {
  /** Player's name */
  playerName: string;
  /** Team the player is joining */
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamPrimaryColor: string;
  teamSecondaryColor: string;
  teamLogoUrl: string | null;
  /** Outgoing team principal being replaced */
  outgoingPrincipalName: string;
  /** News headline (e.g., "John Smith appointed as McLaren Team Principal") */
  headline: string;
  /** Full article body text */
  articleBody: string;
  /** The two drivers the player will manage */
  drivers: [AppointmentDriverSummary, AppointmentDriverSummary];
  /** Year this is happening (for display) */
  year: number;
}

// -----------------------------------------------------------------------------
// Main Game State Container
// -----------------------------------------------------------------------------

/**
 * GameState - The complete state of a running game
 * This is what gets saved/loaded and passed to engines
 */
export interface GameState {
  // Meta
  version: string; // Save format version for migrations
  gameId: string; // Unique identifier for this playthrough (UUID)
  createdAt: string; // ISO date string
  lastSavedAt: string; // ISO date string

  // Player
  player: PlayerInfo;

  // Time & Phase
  currentDate: GameDate;
  phase: GamePhase;
  simulation: SimulationState;

  // Calendar Events (emails/headlines for calendar strip)
  calendarEvents: CalendarEvent[];

  // Current Season
  currentSeason: SeasonData;

  // Live Entities (mutable copies from config)
  // These start as copies of config data and evolve during play
  teams: Team[];
  drivers: Driver[];
  chiefs: Chief[];
  principals: TeamPrincipal[];
  sponsors: Sponsor[]; // Available sponsors (not all have deals)
  manufacturers: Manufacturer[];
  circuits: Circuit[];
  cars: Car[]; // Team cars (2 per team in modern F1)

  // Runtime State (keyed by entity ID)
  driverStates: Record<string, DriverRuntimeState>;
  teamStates: Record<string, TeamRuntimeState>;

  // Active Contracts
  sponsorDeals: ActiveSponsorDeal[];
  manufacturerContracts: ActiveManufacturerContract[];

  // Engine Manufacturer Spec Versions (global tracking per manufacturer)
  manufacturerSpecs: ManufacturerSpecState[];

  // Engine Analytics (estimated power per team, updated after each race)
  engineAnalytics: TeamEngineAnalytics[];

  // Contract Negotiations (active negotiations - manufacturers, drivers, staff, sponsors)
  negotiations: Negotiation[];

  // Historical Data (for career stats, Player Wiki)
  pastSeasons: SeasonData[];

  // Events (for Player Wiki, News, relationships, engine simulations)
  // See proposal.md > Events Infrastructure for full documentation
  events: GameEvent[];

  // News Events Queue (event-driven news generation)
  // Events are pushed here when things happen, consumed by news generator
  newsEvents: NewsEvent[];

  // Parts & Repairs Log (for Construction screen history)
  partsLog: PartsLogEntry[];

  // Game Rules (copied from config, could theoretically change)
  rules: GameRules;

  // Pending appointment news (shown on game start / team change)
  // Cleared after player dismisses the modal
  pendingAppointmentNews: AppointmentNews | null;
}
