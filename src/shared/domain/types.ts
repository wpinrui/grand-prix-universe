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
// CORE TYPES
// =============================================================================

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
  budget: number; // current balance in dollars
  factoryLevel: number; // 0-100, affects staff/facility limits
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
  teamId: string | null; // null if free agent
  role: DriverRole;
  attributes: DriverAttributes;
  reputation: number; // 0-100, market value (results-biased, recency-biased)
  salary: number; // per-season salary in dollars
  contractEnd: number; // season number when contract expires
}

/**
 * Staff - General team personnel (non-chief, non-driver)
 */
export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  department: Department;
  quality: StaffQuality;
  teamId: string | null;
  salary: number;
  contractEnd: number;
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
 * Week-by-week progression (GPW style)
 */
export interface GameDate {
  season: number; // Season/year number (1-based)
  week: number; // Week within season (1-52)
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
 * Named to avoid conflict with engine placeholder type
 */
export interface DriverQualifyingResult {
  driverId: string;
  teamId: string;
  position: number; // Grid position (1-based)
  bestLapTime: number; // in ms
  gapToFirst: number; // Gap to pole in ms (0 for pole sitter)
  knockedOutInSession?: number; // Q1=1, Q2=2, undefined if made Q3
}

/**
 * RacePositionResult - A driver's race result
 */
export interface RacePositionResult {
  driverId: string;
  teamId: string;
  finishPosition: number | null; // Final position (1-based), null if not classified
  gridPosition: number; // Where they started
  lapsCompleted: number;
  totalTime: number; // In ms (0 if DNF)
  gapToWinnerMs?: number; // Time gap in ms (only for same-lap finishers)
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
  race: RacePositionResult[];
  weather: WeatherCondition; // Dominant weather during race
  fastestLapDriverId: string;
  fastestLapTime: number; // In ms
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
  isInjured: boolean;
  injuryWeeksRemaining: number;
  isBanned: boolean; // Race ban
  banRacesRemaining: number;
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
  // Testing progress
  setupPoints: number; // Accumulated from set-up testing
  // Development testing state
  handlingRevealed: boolean;
  handlingPercentage: number; // 0-100, revealed by dev testing
  handlingProblemsFound: string[]; // Problem IDs discovered
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
  createdAt: string; // ISO date string
  lastSavedAt: string; // ISO date string

  // Player
  player: PlayerInfo;

  // Time & Phase
  currentDate: GameDate;
  phase: GamePhase;

  // Current Season
  currentSeason: SeasonData;

  // Live Entities (mutable copies from config)
  // These start as copies of config data and evolve during play
  teams: Team[];
  drivers: Driver[];
  staff: Staff[];
  chiefs: Chief[];
  sponsors: Sponsor[]; // Available sponsors (not all have deals)
  manufacturers: Manufacturer[];
  circuits: Circuit[];

  // Runtime State (keyed by entity ID)
  driverStates: Record<string, DriverRuntimeState>;
  teamStates: Record<string, TeamRuntimeState>;

  // Active Contracts
  sponsorDeals: ActiveSponsorDeal[];
  manufacturerContracts: ActiveManufacturerContract[];

  // Historical Data (for career stats, Player Wiki)
  pastSeasons: SeasonData[];

  // Game Rules (copied from config, could theoretically change)
  rules: GameRules;
}
