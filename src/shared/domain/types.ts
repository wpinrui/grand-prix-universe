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
  Engineering = 'engineering',
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
  Engineer = 'engineer',
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
 * Each has Performance and Reliability attributes (1-5 scale)
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
}

/**
 * TechnologyLevel - Current level of a technology component
 * Both attributes range 1-5 (1 = basic, 5 = cutting edge)
 */
export interface TechnologyLevel {
  component: TechnologyComponent;
  performance: number; // 1-5
  reliability: number; // 1-5
}

/**
 * TechnologyDesignProject - An in-progress technology improvement
 * Only one can be active at a time per team
 */
export interface TechnologyDesignProject {
  component: TechnologyComponent;
  attribute: TechnologyAttribute;
  targetLevel: number; // What level we're designing to (current + 1)
  progress: number; // 0-10
  designersAssigned: number;
  startedAt: GameDate;
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
  handlingRevealed: number; // 0-100, how much handling info is known
  problems: HandlingProblemState[];
  activeDesignProblem: HandlingProblem | null; // Which problem is being worked on
  designersAssigned: number;
}

/**
 * DesignState - Complete design department state for a team
 * Contains all chassis, technology, and improvement tracking
 */
export interface DesignState {
  /** Next year's chassis design (null if not started) */
  nextYearChassis: ChassisDesign | null;

  /** Current technology levels for all 7 components */
  technologyLevels: TechnologyLevel[];

  /** Active technology design project (null if none) */
  activeTechnologyProject: TechnologyDesignProject | null;

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
 * Manufacturer - A company that supplies engines, tyres, or fuel
 */
export interface Manufacturer {
  id: string; // kebab-case slug, e.g. "honda-racing"
  name: string; // display name, e.g. "Honda Racing Development"
  type: ManufacturerType;
  reputation: number; // 0-100, affects attractiveness to teams
  annualCost: number; // yearly contract cost in dollars
  quality: number; // 0-100, base quality of products
  worksTeamId: string | null; // factory team (at most one)
  partnerTeamIds: string[]; // priority customer teams
}

/**
 * Engine specification - supplied by engine manufacturer
 */
export interface Engine {
  id: string; // e.g. "phoenix-v10-01a"
  manufacturerId: string;
  name: string;
  fuelEfficiency: number; // 0-100, lower fuel consumption
  power: number; // 0-100, straight-line speed
  reliability: number; // 0-100, resistance to failure
  lightness: number; // 0-100, lighter engines improve performance
}

/**
 * Tyre specification - supplied by tyre manufacturer
 */
export interface Tyre {
  id: string;
  manufacturerId: string;
  compound: TyreCompound;
  grip: number; // 0-100
  durability: number; // 0-100, resistance to wear
  temperatureRange: number; // 0-100, optimal operating range width
}

/**
 * Fuel specification - supplied by fuel manufacturer
 */
export interface Fuel {
  id: string;
  manufacturerId: string;
  name: string;
  performance: number; // 0-100, combustion efficiency
  engineTolerance: number; // 0-100, compatibility across engine types
}

/**
 * Car - A physical racing car owned by a team
 */
export interface Car {
  id: string;
  teamId: string;
  chassisId: string; // reference to chassis design
  engineId: string;
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
  payment: number; // annual payment in dollars
  minReputation: number; // 0-100, team must have at least this reputation
  rivalGroup: string | null; // sponsors in same group are mutually exclusive
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
}

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
}

/**
 * DepartmentMorale - Morale state for all departments
 * GPW uses 1-5 blocks, we use 0-100 scale.
 * Keyed by Department enum value, each value is 0-100.
 */
export type DepartmentMorale = Record<Department, number>;

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
  // Testing progress (setup points for Set-Up Testing)
  setupPoints: number; // Accumulated from set-up testing
  // Design department state (chassis, technology, improvements, handling)
  designState: DesignState;
}

/**
 * ActiveSponsorDeal - A sponsor contract currently in effect
 */
export interface ActiveSponsorDeal {
  sponsorId: string;
  teamId: string;
  tier: SponsorTier;
  annualPayment: number; // Negotiated payment
  bonusLevel: number; // 0-3, affects payment multiplier
  guaranteed: boolean; // If true, payment never drops
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

  // Historical Data (for career stats, Player Wiki)
  pastSeasons: SeasonData[];

  // Events (for Player Wiki, News, relationships, engine simulations)
  // See proposal.md > Events Infrastructure for full documentation
  events: GameEvent[];

  // Game Rules (copied from config, could theoretically change)
  rules: GameRules;
}
