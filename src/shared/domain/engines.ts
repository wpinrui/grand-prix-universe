/**
 * Engine Interfaces for Grand Prix Universe
 *
 * All simulation logic lives behind these interfaces. The game core NEVER
 * contains simulation math directly - it delegates to engines.
 *
 * Engine Rules:
 * 1. Receive ALL needed data as input (no reaching into game state)
 * 2. Return results as output (no side effects)
 * 3. Stateless (state lives in Game State)
 * 4. Swappable at runtime (MVP uses stubs, later replaced with full sims)
 */

import type {
  GameDate,
  GamePhase,
  CalendarEntry,
  Driver,
  Chief,
  Team,
  Circuit,
  DriverRuntimeState,
  TeamRuntimeState,
  ActiveSponsorDeal,
  ActiveManufacturerContract,
  DriverStanding,
  ConstructorStanding,
  RaceWeekendResult,
  DriverAttributes,
  DepartmentMorale,
} from './types';

// =============================================================================
// PLACEHOLDER TYPES (to be expanded when implementing each engine)
// Using type aliases to avoid empty interface lint errors
// Convert to interfaces with real properties when implementing
// =============================================================================

/** Base placeholder - all stubs extend this for future type-safety */
type Placeholder = Record<string, unknown>;

// Race Engine Types
export type QualifyingInput = Placeholder;
export type QualifyingResult = Placeholder;
export type RaceInput = Placeholder;
export type RaceResult = Placeholder;

// Design Engine Types
export type DesignInput = Placeholder;
export type DesignResult = Placeholder;

// Construction Engine Types
export type ConstructionInput = Placeholder;
export type ConstructionResult = Placeholder;

// Development Engine Types
export type DevelopmentInput = Placeholder;
export type DevelopmentResult = Placeholder;

// Staff Engine Types
export type StaffInput = Placeholder;
export type StaffResult = Placeholder;

// Financial Engine Types
export type FinancialInput = Placeholder;
export type FinancialResult = Placeholder;

// Market Engine Types
export type MarketInput = Placeholder;
export type MarketResult = Placeholder;

// Weather Engine Types
export type WeatherInput = Placeholder;
export type WeatherResult = Placeholder;

// Car Performance Engine Types
export type CarPerformanceInput = Placeholder;
export type CarPerformanceResult = Placeholder;

// Driver Performance Engine Types
export type DriverPerformanceInput = Placeholder;
export type DriverPerformanceResult = Placeholder;

// Regulation Engine Types
export type RegulationInput = Placeholder;
export type RegulationResult = Placeholder;

// =============================================================================
// TURN ENGINE TYPES (Concrete types for time progression)
// =============================================================================

/**
 * TurnBlockedReason - Why turn processing was blocked
 * Extensible for future blocking conditions
 */
export type TurnBlockedReason = 'post-season';

/**
 * TurnBlocked - Indicates turn was blocked and why
 */
export interface TurnBlocked {
  reason: TurnBlockedReason;
  message: string;
}

/**
 * ChampionshipStandings - Driver and constructor standings together
 * Used whenever both standings are needed as a pair
 */
export interface ChampionshipStandings {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

/**
 * TurnProcessingInput - All data needed to process a weekly turn
 */
export interface TurnProcessingInput {
  currentDate: GameDate;
  phase: GamePhase;
  calendar: CalendarEntry[];
  drivers: Driver[];
  chiefs: Chief[];
  teams: Team[];
  driverStates: Record<string, DriverRuntimeState>;
  teamStates: Record<string, TeamRuntimeState>;
  sponsorDeals: ActiveSponsorDeal[];
  manufacturerContracts: ActiveManufacturerContract[];
}

/**
 * DriverStateChange - Changes to a driver's runtime state
 * All fields optional - only include fields that changed
 *
 * Fields with "*Change" suffix are DELTAS to apply.
 * Fields with "set*" prefix are ABSOLUTE values to set directly.
 */
export interface DriverStateChange {
  driverId: string;
  fatigueChange?: number;
  fitnessChange?: number;
  moraleChange?: number;
  reputationChange?: number;
  setInjuryWeeks?: number; // Absolute: set injury weeks remaining
  setBanRaces?: number; // Absolute: set ban races remaining
  engineUnitsUsedChange?: number;
  gearboxRaceCountChange?: number;
}

/**
 * DriverAttributeChange - Changes to a driver's permanent attributes
 * Used for aging effects and development
 */
export interface DriverAttributeChange {
  driverId: string;
  attribute: keyof DriverAttributes;
  change: number; // Delta to apply (can be negative)
}

/**
 * ChiefChange - Changes to a chief's state
 */
export interface ChiefChange {
  chiefId: string;
  abilityChange?: number; // Delta to apply
  retired?: boolean; // If true, chief should be removed from active roster
}

/**
 * TeamStateChange - Changes to a team's runtime state
 * All fields optional - only include fields that changed
 */
export interface TeamStateChange {
  teamId: string;
  budgetChange?: number; // Delta to apply
  moraleChanges?: Partial<DepartmentMorale>; // Deltas per department
  sponsorSatisfactionChanges?: Record<string, number>; // Deltas per sponsor
}

/**
 * TurnProcessingResult - Result of processing a weekly turn
 */
export interface TurnProcessingResult {
  newDate: GameDate;
  newPhase: GamePhase;
  driverStateChanges: DriverStateChange[];
  driverAttributeChanges: DriverAttributeChange[];
  chiefChanges: ChiefChange[];
  teamStateChanges: TeamStateChange[];
  isRaceWeek: boolean;
  raceCircuitId?: string; // Set if isRaceWeek is true
  blocked?: TurnBlocked;
}

/**
 * RaceProcessingInput - Data needed to process race results
 */
export interface RaceProcessingInput {
  raceResult: RaceWeekendResult;
  drivers: Driver[];
  teams: Team[];
  driverStates: Record<string, DriverRuntimeState>;
  teamStates: Record<string, TeamRuntimeState>;
  currentStandings: ChampionshipStandings;
}

/**
 * RaceProcessingResult - Result of processing a race
 */
export interface RaceProcessingResult {
  driverStateChanges: DriverStateChange[];
  teamStateChanges: TeamStateChange[];
  updatedStandings: ChampionshipStandings;
}

/**
 * SeasonEndInput - Data needed to process end of season
 */
export interface SeasonEndInput {
  drivers: Driver[];
  chiefs: Chief[];
  teams: Team[];
  driverStates: Record<string, DriverRuntimeState>;
  teamStates: Record<string, TeamRuntimeState>;
  currentSeason: number;
  circuits: Circuit[];
}

/**
 * SeasonEndResult - Result of processing season end
 */
export interface SeasonEndResult {
  driverAttributeChanges: DriverAttributeChange[];
  chiefChanges: ChiefChange[];
  retiredDriverIds: string[];
  retiredChiefIds: string[];
  newCalendar: CalendarEntry[];
  resetDriverStates: Record<string, Partial<DriverRuntimeState>>;
}

// =============================================================================
// ENGINE INTERFACES
// =============================================================================

/**
 * ITurnEngine - Core game loop engine for time progression
 * Responsible for processing weekly turns, race results, and season transitions
 *
 * This is the heart of the simulation - it determines what changes each week,
 * how race results affect state, and how seasons transition.
 */
export interface ITurnEngine {
  /**
   * Process a weekly turn (advance time by one week)
   * Handles fatigue, fitness, morale, budget, injuries, etc.
   */
  processWeek(input: TurnProcessingInput): TurnProcessingResult;

  /**
   * Process race results and update standings/state
   * Called after a race weekend completes
   */
  processRace(input: RaceProcessingInput): RaceProcessingResult;

  /**
   * Process end of season (aging, retirements, resets)
   * Called when transitioning from PostSeason to new PreSeason
   */
  processSeasonEnd(input: SeasonEndInput): SeasonEndResult;
}

/**
 * IRaceEngine - Simulates qualifying sessions and races
 * Responsible for lap times, positions, incidents, pit stops
 */
export interface IRaceEngine {
  simulateQualifying(input: QualifyingInput): QualifyingResult;
  simulateRace(input: RaceInput): RaceResult;
}

/**
 * IDesignEngine - Handles chassis and technology design progress
 * Responsible for R&D advancement, design completion timelines
 */
export interface IDesignEngine {
  processDesign(input: DesignInput): DesignResult;
}

/**
 * IConstructionEngine - Manages building cars, parts, and upgrades
 * Responsible for build queues, resource allocation, completion times
 */
export interface IConstructionEngine {
  processConstruction(input: ConstructionInput): ConstructionResult;
}

/**
 * IDevelopmentEngine - Handles testing and R&D progress
 * Responsible for test session outcomes, data gathering, improvements
 */
export interface IDevelopmentEngine {
  processDevelopment(input: DevelopmentInput): DevelopmentResult;
}

/**
 * IStaffEngine - Manages staff morale and performance
 * Responsible for morale changes, performance modifiers, fatigue
 */
export interface IStaffEngine {
  processStaff(input: StaffInput): StaffResult;
}

/**
 * IFinancialEngine - Handles sponsor satisfaction and payments
 * Responsible for income calculations, sponsor happiness, bonuses/penalties
 */
export interface IFinancialEngine {
  processFinancials(input: FinancialInput): FinancialResult;
}

/**
 * IMarketEngine - Manages driver and staff availability
 * Responsible for transfer market, contract negotiations, availability windows
 */
export interface IMarketEngine {
  processMarket(input: MarketInput): MarketResult;
}

/**
 * IWeatherEngine - Generates race weekend weather conditions
 * Responsible for weather forecasts, condition changes during sessions
 */
export interface IWeatherEngine {
  generateWeather(input: WeatherInput): WeatherResult;
}

/**
 * ICarPerformanceEngine - Calculates car speed from components
 * Responsible for aggregating chassis, engine, aero into performance rating
 */
export interface ICarPerformanceEngine {
  calculatePerformance(input: CarPerformanceInput): CarPerformanceResult;
}

/**
 * IDriverPerformanceEngine - Calculates driver performance
 * Responsible for applying driver attributes, conditions, fatigue to output
 */
export interface IDriverPerformanceEngine {
  calculatePerformance(input: DriverPerformanceInput): DriverPerformanceResult;
}

/**
 * IRegulationEngine - Handles yearly regulation changes
 * Responsible for rule changes between seasons, compliance checking
 */
export interface IRegulationEngine {
  processRegulations(input: RegulationInput): RegulationResult;
}
