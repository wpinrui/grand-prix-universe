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

export class StubRaceEngine implements IRaceEngine {
  simulateQualifying(_input: QualifyingInput): QualifyingResult {
    return {};
  }

  simulateRace(_input: RaceInput): RaceResult {
    return {};
  }
}

export class StubDesignEngine implements IDesignEngine {
  processDesign(_input: DesignInput): DesignResult {
    return {};
  }
}

export class StubConstructionEngine implements IConstructionEngine {
  processConstruction(_input: ConstructionInput): ConstructionResult {
    return {};
  }
}

export class StubDevelopmentEngine implements IDevelopmentEngine {
  processDevelopment(_input: DevelopmentInput): DevelopmentResult {
    return {};
  }
}

export class StubStaffEngine implements IStaffEngine {
  processStaff(_input: StaffInput): StaffResult {
    return {};
  }
}

export class StubFinancialEngine implements IFinancialEngine {
  processFinancials(_input: FinancialInput): FinancialResult {
    return {};
  }
}

export class StubMarketEngine implements IMarketEngine {
  processMarket(_input: MarketInput): MarketResult {
    return {};
  }
}

export class StubWeatherEngine implements IWeatherEngine {
  generateWeather(_input: WeatherInput): WeatherResult {
    return {};
  }
}

export class StubCarPerformanceEngine implements ICarPerformanceEngine {
  calculatePerformance(_input: CarPerformanceInput): CarPerformanceResult {
    return {};
  }
}

export class StubDriverPerformanceEngine implements IDriverPerformanceEngine {
  calculatePerformance(_input: DriverPerformanceInput): DriverPerformanceResult {
    return {};
  }
}

export class StubRegulationEngine implements IRegulationEngine {
  processRegulations(_input: RegulationInput): RegulationResult {
    return {};
  }
}
