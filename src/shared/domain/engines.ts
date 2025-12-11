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
  Department,
  DriverRuntimeState,
  TeamRuntimeState,
  ActiveSponsorDeal,
  ActiveManufacturerContract,
  DriverStanding,
  ConstructorStanding,
  RaceWeekendResult,
  DriverAttributes,
  DesignState,
  DepartmentStaffCounts,
  Facility,
  TechnologyComponent,
  TechnologyAttribute,
  ChassisDesignStage,
  HandlingProblem,
  TestSession,
  CurrentYearChassisState,
  StaffCounts,
  // Negotiation types
  ResponseType,
  ResponseTone,
  AnyContractTerms,
  Negotiation,
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

// Design Engine Types - See IDesignEngine interface for documentation

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
 * BaseGameStateSnapshot - Common fields needed by most engine inputs
 * Contains the core runtime state that engines need to read
 */
interface BaseGameStateSnapshot {
  drivers: Driver[];
  teams: Team[];
  driverStates: Record<string, DriverRuntimeState>;
  teamStates: Record<string, TeamRuntimeState>;
}

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
export interface TurnProcessingInput extends BaseGameStateSnapshot {
  currentDate: GameDate;
  phase: GamePhase;
  calendar: CalendarEntry[];
  chiefs: Chief[];
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
 *
 * Fields with "*Change" suffix are DELTAS to apply.
 * Fields with "set*" prefix are ABSOLUTE values to set directly.
 */
export interface ChiefChange {
  chiefId: string;
  abilityChange?: number; // Delta to apply
  setRetired?: boolean; // Absolute: if true, chief should be removed from active roster
}

/**
 * TeamStateChange - Changes to a team's runtime state
 * All fields optional - only include fields that changed
 */
export interface TeamStateChange {
  teamId: string;
  budgetChange?: number; // Delta to apply
  moraleChanges?: Partial<Record<Department, number>>; // Deltas per department
  sponsorSatisfactionChanges?: Record<string, number>; // sponsorId -> delta
}

/**
 * StateChanges - Common state change arrays shared across engine results
 * Groups driver and team state changes that multiple results need
 */
interface StateChanges {
  driverStateChanges: DriverStateChange[];
  teamStateChanges: TeamStateChange[];
}

/**
 * ProgressionChanges - Long-term changes to drivers and chiefs
 * Groups attribute/ability changes that affect permanent stats
 */
interface ProgressionChanges {
  driverAttributeChanges: DriverAttributeChange[];
  chiefChanges: ChiefChange[];
}

/**
 * RaceWeekInfo - Details about an upcoming race week
 * Present when the next week is a race week, null otherwise
 */
export interface RaceWeekInfo {
  circuitId: string;
}

/**
 * DayStopReason - Why the simulation should auto-stop
 */
export type DayStopReason = 'race-weekend-friday' | 'critical-event' | 'design-milestone';

/**
 * TurnProcessingResult - Result of processing a daily turn
 *
 * If `blocked` is set, the turn could not progress and the caller should:
 * - NOT apply any state changes (all change arrays will be empty)
 * - Display the blocked message to the player
 * - `newDate` and `newPhase` will match the input (no time progression)
 *
 * If `shouldStopSimulation` is true, auto-advancing should pause but
 * the player can still manually advance or take other actions.
 */
export interface TurnProcessingResult extends StateChanges, ProgressionChanges {
  newDate: GameDate;
  newPhase: GamePhase;
  raceWeek: RaceWeekInfo | null;
  blocked?: TurnBlocked;
  shouldStopSimulation?: boolean;
  stopReason?: DayStopReason;
  /** Design updates for all teams (updated states and milestones) */
  designUpdates: DesignUpdate[];
  /** Testing updates for teams with active tests */
  testingUpdates: TestingUpdate[];
}

/**
 * RaceProcessingInput - Data needed to process race results
 */
export interface RaceProcessingInput extends BaseGameStateSnapshot {
  raceResult: RaceWeekendResult;
  currentStandings: ChampionshipStandings;
}

/**
 * RaceProcessingResult - Result of processing a race
 */
export interface RaceProcessingResult extends StateChanges {
  updatedStandings: ChampionshipStandings;
}

/**
 * SeasonEndInput - Data needed to process end of season
 */
export interface SeasonEndInput extends BaseGameStateSnapshot {
  chiefs: Chief[];
  currentSeason: number;
  circuits: Circuit[];
}

/**
 * SeasonEndResult - Result of processing season end
 */
export interface SeasonEndResult extends ProgressionChanges {
  retiredDriverIds: string[];
  retiredChiefIds: string[];
  newCalendar: CalendarEntry[];
  resetDriverStates: Record<string, Partial<DriverRuntimeState>>;
}

// =============================================================================
// DESIGN ENGINE TYPES
// =============================================================================

/**
 * DesignProcessingInput - All data needed to process a day of design work
 * Called once per team per day during time simulation
 */
export interface DesignProcessingInput {
  /** Team being processed */
  teamId: string;

  /** Current design state (chassis, technology, projects) */
  designState: DesignState;

  /** Staff counts by department and quality (for work capacity calculation) */
  staffCounts: DepartmentStaffCounts;

  /** Chief Designer (null if position vacant) - provides ability bonus */
  chiefDesigner: Chief | null;

  /** Factory facilities (for multipliers and stage unlocks) */
  facilities: Facility[];

  /** Current game date */
  currentDate: GameDate;
}

/**
 * TechnologyBreakthrough - A technology breakthrough discovered during processing
 * Emitted when a project transitions from Discovery to Development phase
 */
export interface TechnologyBreakthrough {
  /** Which technology component */
  component: TechnologyComponent;

  /** Which attribute (performance or reliability) */
  attribute: TechnologyAttribute;

  /** How much the stat will increase when complete (e.g., +8) */
  statIncrease: number;

  /** Total work units needed to complete development */
  workUnitsRequired: number;

  /** Estimated completion date based on current allocation */
  estimatedCompletionDate: GameDate;
}

/**
 * TechnologyCompletion - A technology design project completed
 * Emitted when technology development finishes (ready for construction)
 */
export interface TechnologyCompletion {
  type: 'technology';
  component: TechnologyComponent;
  attribute: TechnologyAttribute;
  /** How much the stat will increase */
  statIncrease: number;
}

/**
 * HandlingSolutionCompletion - A handling problem solution completed
 * Emitted when handling solution design finishes (ready for construction)
 */
export interface HandlingSolutionCompletion {
  type: 'handling-solution';
  problem: HandlingProblem;
  /** How much handling will improve */
  statIncrease: number;
}

/**
 * DesignCompletion - A design project completed during processing
 * Discriminated union ensures type-safe access to completion-specific fields
 */
export type DesignCompletion = TechnologyCompletion | HandlingSolutionCompletion;

/**
 * ChassisStageCompletion - A chassis design stage completed during processing
 * Emitted when a stage reaches 10/10 progress
 */
export interface ChassisStageCompletion {
  /** Which stage was completed */
  stage: ChassisDesignStage;

  /** Updated efficiency rating after stage completion */
  newEfficiencyRating: number;
}

/**
 * DesignProcessingResult - Result of processing a day of design work
 * Contains updated state and events that occurred
 */
export interface DesignProcessingResult {
  /** Updated design state (caller merges into team state) */
  updatedDesignState: DesignState;

  /** Breakthroughs discovered this day (Discovery → Development transitions) */
  breakthroughs: TechnologyBreakthrough[];

  /** Projects completed this day (Development complete, ready for construction) */
  completions: DesignCompletion[];

  /** Chassis stages completed this day */
  chassisStageCompletions: ChassisStageCompletion[];
}

/**
 * DesignUpdate - Design processing result for a single team
 * Wraps DesignProcessingResult with team identification
 */
export interface DesignUpdate extends DesignProcessingResult {
  /** Team this update applies to */
  teamId: string;
}

// =============================================================================
// ENGINE INTERFACES
// =============================================================================

/**
 * ITurnEngine - Core game loop engine for time progression
 * Responsible for processing daily turns, race results, and season transitions
 *
 * This is the heart of the simulation - it determines what changes each day,
 * how race results affect state, and how seasons transition.
 */
export interface ITurnEngine {
  /**
   * Process a daily turn (advance time by one day)
   * Handles fatigue, fitness, morale, budget, injuries, etc.
   * Returns stop flags for race weekends and critical events.
   */
  processDay(input: TurnProcessingInput): TurnProcessingResult;

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
 *
 * Responsible for:
 * - Technology breakthrough discovery (daily probability checks)
 * - Technology development progress (work unit accumulation)
 * - Next year chassis progression (4-stage design process)
 * - Current year chassis improvements (handling problem solutions)
 *
 * Called once per team per day during time simulation.
 * Returns updated design state and any events that occurred.
 */
export interface IDesignEngine {
  /**
   * Process a single day of design work for one team
   *
   * @param input - Team's design state, staff, facilities, and current date
   * @returns Updated design state and events (breakthroughs, completions)
   */
  processDay(input: DesignProcessingInput): DesignProcessingResult;
}

// =============================================================================
// TESTING ENGINE TYPES
// =============================================================================

/**
 * TestingProcessingInput - All data needed to process a day of testing
 * Called once per team per day during time simulation (if test is active)
 */
export interface TestingProcessingInput {
  /** Team being processed */
  teamId: string;

  /** Current test session state */
  testSession: TestSession;

  /** Staff counts for mechanics department */
  mechanicCounts: StaffCounts;

  /** Factory facilities (for test rig multiplier) */
  facilities: Facility[];

  /** Current year chassis state (for problem discovery) */
  currentYearChassis: CurrentYearChassisState;

  /** Team's initial chassis handling value (revealed on first test) */
  initialChassisHandling: number;

  /** Current game date */
  currentDate: GameDate;
}

/**
 * TestCompletion - Result when a test reaches completion
 * Contains discovered handling or problem information
 */
export interface TestCompletion {
  /** Updated tests completed count */
  testsCompleted: number;

  /** Handling percentage (set on first test, null otherwise) */
  handlingRevealed: number | null;

  /** Problem discovered (set on subsequent tests, null if first or no more problems) */
  problemDiscovered: HandlingProblem | null;
}

/**
 * TestingProcessingResult - Result of processing a day of testing
 */
export interface TestingProcessingResult {
  /** Updated test session state */
  updatedTestSession: TestSession;

  /** Test completion data (null if test not complete this day) */
  completion: TestCompletion | null;
}

/**
 * TestingUpdate - Testing processing result for a single team
 * Wraps TestingProcessingResult with team identification
 */
export interface TestingUpdate extends TestingProcessingResult {
  /** Team this update applies to */
  teamId: string;
}

// =============================================================================
// TESTING ENGINE INTERFACE
// =============================================================================

/**
 * ITestingEngine - Handles development testing progress
 *
 * Responsible for:
 * - Daily work unit accumulation
 * - Test progress tracking (0-10 scale)
 * - First test: reveal chassis handling percentage
 * - Subsequent tests: discover handling problems
 *
 * Called once per team per day during time simulation (if test is active).
 */
export interface ITestingEngine {
  /**
   * Process a single day of testing work for one team
   *
   * @param input - Team's test session, staff, facilities, and chassis state
   * @returns Updated test session and completion data if test finished
   */
  processDay(input: TestingProcessingInput): TestingProcessingResult;
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

// =============================================================================
// NEGOTIATION ENGINE TYPES
// =============================================================================

/**
 * NegotiationEvaluationInput - All data needed to evaluate an offer
 * Passed to the negotiation engine to generate a response
 */
export interface NegotiationEvaluationInput {
  /** The negotiation being evaluated */
  negotiation: Negotiation;

  /** Current game date */
  currentDate: GameDate;

  /** Team making the offer (for context) */
  team: Team;

  /** All teams (for comparing competitiveness) */
  allTeams: Team[];

  /** Relationship score (0-100) */
  relationshipScore: number;
}

/**
 * NegotiationEvaluationResult - Result of evaluating an offer
 * Contains the counterparty's response and any state changes
 */
export interface NegotiationEvaluationResult {
  /** How the counterparty responds */
  responseType: ResponseType;

  /** Counter-offer terms (only if responseType is Counter) */
  counterTerms: AnyContractTerms | null;

  /** Emotional tone of the response */
  responseTone: ResponseTone;

  /** Days until response arrives (1-7, personality-driven) */
  responseDelayDays: number;

  /** Whether this negotiation should generate a news headline */
  isNewsworthy: boolean;

  /** Relationship score change from this interaction */
  relationshipChange: number;

  /** If true, this is a "take it or leave it" final offer - no more counters allowed */
  isUltimatum?: boolean;
}

/**
 * NegotiationProcessingInput - Input for processing all active negotiations
 * Called once per day during time simulation
 */
export interface NegotiationProcessingInput {
  /** All active negotiations */
  negotiations: Negotiation[];

  /** Current game date */
  currentDate: GameDate;

  /** All teams (for context) */
  teams: Team[];

  /** All drivers (for driver negotiations) */
  drivers: Driver[];

  /** All chiefs (for staff negotiations) */
  chiefs: Chief[];
}

/**
 * NegotiationUpdate - Update to a single negotiation
 */
export interface NegotiationUpdate {
  /** ID of the negotiation being updated */
  negotiationId: string;

  /** Updated negotiation state (null if no update needed today) */
  updatedNegotiation: Negotiation | null;

  /** Whether a sim-stopping email should be sent */
  shouldStopSimulation: boolean;

  /** Whether to generate a news headline */
  isNewsworthy: boolean;
}

/**
 * NegotiationProcessingResult - Result of processing all negotiations for a day
 */
export interface NegotiationProcessingResult {
  /** Updates to apply to negotiations */
  updates: NegotiationUpdate[];
}

// =============================================================================
// NEGOTIATION ENGINE INTERFACE
// =============================================================================

/**
 * INegotiationEngine - Handles contract negotiations for all stakeholder types
 *
 * Responsible for:
 * - Evaluating offers and generating responses (Accept/Counter/Reject)
 * - Calculating response delays based on personality
 * - Determining response tone (affects relationship)
 * - Processing daily negotiation state (checking for responses due)
 *
 * The engine is stakeholder-agnostic - specific evaluation logic lives in
 * evaluators (ManufacturerEvaluator, DriverEvaluator, etc.) called by this engine.
 *
 * See proposal.md → "Contract Negotiations System" for full specification.
 */
export interface INegotiationEngine {
  /**
   * Evaluate a single offer and generate a response
   *
   * @param input - Negotiation state, team context, relationship
   * @returns Response type, counter terms (if any), tone, delay
   */
  evaluateOffer(input: NegotiationEvaluationInput): NegotiationEvaluationResult;

  /**
   * Process all active negotiations for a single day
   * Checks if any responses are due and generates them
   *
   * @param input - All active negotiations and context
   * @returns Updates to apply to negotiations
   */
  processDay(input: NegotiationProcessingInput): NegotiationProcessingResult;
}
