/**
 * EngineManager - Central manager for all simulation engines
 *
 * Holds all engine instances and provides access to them.
 * Initializes with stub implementations by default.
 * Engines can be swapped at runtime for testing or upgrading to full simulations.
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
} from '../../shared/domain/engines';

import {
  StubRaceEngine,
  StubDesignEngine,
  StubConstructionEngine,
  StubDevelopmentEngine,
  StubStaffEngine,
  StubFinancialEngine,
  StubMarketEngine,
  StubWeatherEngine,
  StubCarPerformanceEngine,
  StubDriverPerformanceEngine,
  StubRegulationEngine,
} from './stubs';

export class EngineManager {
  race: IRaceEngine = new StubRaceEngine();
  design: IDesignEngine = new StubDesignEngine();
  construction: IConstructionEngine = new StubConstructionEngine();
  development: IDevelopmentEngine = new StubDevelopmentEngine();
  staff: IStaffEngine = new StubStaffEngine();
  financial: IFinancialEngine = new StubFinancialEngine();
  market: IMarketEngine = new StubMarketEngine();
  weather: IWeatherEngine = new StubWeatherEngine();
  carPerformance: ICarPerformanceEngine = new StubCarPerformanceEngine();
  driverPerformance: IDriverPerformanceEngine = new StubDriverPerformanceEngine();
  regulation: IRegulationEngine = new StubRegulationEngine();
}
