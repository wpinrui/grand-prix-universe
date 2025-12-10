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
  ITestingEngine,
  IDevelopmentEngine,
  IStaffEngine,
  IFinancialEngine,
  IMarketEngine,
  IWeatherEngine,
  ICarPerformanceEngine,
  IDriverPerformanceEngine,
  IRegulationEngine,
  ITurnEngine,
} from '../../shared/domain/engines';

import {
  StubRaceEngine,
  StubDesignEngine,
  StubTestingEngine,
  StubDevelopmentEngine,
  StubStaffEngine,
  StubFinancialEngine,
  StubMarketEngine,
  StubWeatherEngine,
  StubCarPerformanceEngine,
  StubDriverPerformanceEngine,
  StubRegulationEngine,
  StubTurnEngine,
} from './stubs';

export class EngineManager {
  race: IRaceEngine = new StubRaceEngine();
  design: IDesignEngine = new StubDesignEngine();
  testing: ITestingEngine = new StubTestingEngine();
  development: IDevelopmentEngine = new StubDevelopmentEngine();
  staff: IStaffEngine = new StubStaffEngine();
  financial: IFinancialEngine = new StubFinancialEngine();
  market: IMarketEngine = new StubMarketEngine();
  weather: IWeatherEngine = new StubWeatherEngine();
  carPerformance: ICarPerformanceEngine = new StubCarPerformanceEngine();
  driverPerformance: IDriverPerformanceEngine = new StubDriverPerformanceEngine();
  regulation: IRegulationEngine = new StubRegulationEngine();
  turn: ITurnEngine = new StubTurnEngine();
}
