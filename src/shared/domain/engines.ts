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
// ENGINE INTERFACES
// =============================================================================

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
