/**
 * Stub Engine Implementations
 *
 * Simple/random implementations of all engine interfaces for MVP.
 * These return placeholder results and will be replaced with full
 * simulation logic in later phases.
 */

import type {
  IRaceEngine,
  IDesignEngine,
  IConstructionEngine,
  IDevelopmentEngine,
  IStaffEngine,
  IFinancialEngine,
  IMarketEngine,
  IWeatherEngine,
  ICarPerformanceEngine,
  IDriverPerformanceEngine,
  IRegulationEngine,
  QualifyingInput,
  QualifyingResult,
  RaceInput,
  RaceResult,
  DesignInput,
  DesignResult,
  ConstructionInput,
  ConstructionResult,
  DevelopmentInput,
  DevelopmentResult,
  StaffInput,
  StaffResult,
  FinancialInput,
  FinancialResult,
  MarketInput,
  MarketResult,
  WeatherInput,
  WeatherResult,
  CarPerformanceInput,
  CarPerformanceResult,
  DriverPerformanceInput,
  DriverPerformanceResult,
  RegulationInput,
  RegulationResult,
} from '../../shared/domain/engines';

/**
 * Stub implementation of IRaceEngine
 * Returns empty placeholder results for qualifying and race simulation
 */
export class StubRaceEngine implements IRaceEngine {
  simulateQualifying(_input: QualifyingInput): QualifyingResult {
    return {};
  }

  simulateRace(_input: RaceInput): RaceResult {
    return {};
  }
}

/**
 * Stub implementation of IDesignEngine
 * Returns empty placeholder results for design processing
 */
export class StubDesignEngine implements IDesignEngine {
  processDesign(_input: DesignInput): DesignResult {
    return {};
  }
}

/**
 * Stub implementation of IConstructionEngine
 * Returns empty placeholder results for construction processing
 */
export class StubConstructionEngine implements IConstructionEngine {
  processConstruction(_input: ConstructionInput): ConstructionResult {
    return {};
  }
}

/**
 * Stub implementation of IDevelopmentEngine
 * Returns empty placeholder results for development processing
 */
export class StubDevelopmentEngine implements IDevelopmentEngine {
  processDevelopment(_input: DevelopmentInput): DevelopmentResult {
    return {};
  }
}

/**
 * Stub implementation of IStaffEngine
 * Returns empty placeholder results for staff processing
 */
export class StubStaffEngine implements IStaffEngine {
  processStaff(_input: StaffInput): StaffResult {
    return {};
  }
}

/**
 * Stub implementation of IFinancialEngine
 * Returns empty placeholder results for financial processing
 */
export class StubFinancialEngine implements IFinancialEngine {
  processFinancials(_input: FinancialInput): FinancialResult {
    return {};
  }
}

/**
 * Stub implementation of IMarketEngine
 * Returns empty placeholder results for market processing
 */
export class StubMarketEngine implements IMarketEngine {
  processMarket(_input: MarketInput): MarketResult {
    return {};
  }
}

/**
 * Stub implementation of IWeatherEngine
 * Returns empty placeholder results for weather generation
 */
export class StubWeatherEngine implements IWeatherEngine {
  generateWeather(_input: WeatherInput): WeatherResult {
    return {};
  }
}

/**
 * Stub implementation of ICarPerformanceEngine
 * Returns empty placeholder results for car performance calculation
 */
export class StubCarPerformanceEngine implements ICarPerformanceEngine {
  calculatePerformance(_input: CarPerformanceInput): CarPerformanceResult {
    return {};
  }
}

/**
 * Stub implementation of IDriverPerformanceEngine
 * Returns empty placeholder results for driver performance calculation
 */
export class StubDriverPerformanceEngine implements IDriverPerformanceEngine {
  calculatePerformance(_input: DriverPerformanceInput): DriverPerformanceResult {
    return {};
  }
}

/**
 * Stub implementation of IRegulationEngine
 * Returns empty placeholder results for regulation processing
 */
export class StubRegulationEngine implements IRegulationEngine {
  processRegulations(_input: RegulationInput): RegulationResult {
    return {};
  }
}
