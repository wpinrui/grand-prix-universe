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
  private raceEngine: IRaceEngine;
  private designEngine: IDesignEngine;
  private constructionEngine: IConstructionEngine;
  private developmentEngine: IDevelopmentEngine;
  private staffEngine: IStaffEngine;
  private financialEngine: IFinancialEngine;
  private marketEngine: IMarketEngine;
  private weatherEngine: IWeatherEngine;
  private carPerformanceEngine: ICarPerformanceEngine;
  private driverPerformanceEngine: IDriverPerformanceEngine;
  private regulationEngine: IRegulationEngine;

  constructor() {
    this.raceEngine = new StubRaceEngine();
    this.designEngine = new StubDesignEngine();
    this.constructionEngine = new StubConstructionEngine();
    this.developmentEngine = new StubDevelopmentEngine();
    this.staffEngine = new StubStaffEngine();
    this.financialEngine = new StubFinancialEngine();
    this.marketEngine = new StubMarketEngine();
    this.weatherEngine = new StubWeatherEngine();
    this.carPerformanceEngine = new StubCarPerformanceEngine();
    this.driverPerformanceEngine = new StubDriverPerformanceEngine();
    this.regulationEngine = new StubRegulationEngine();
  }

  getRaceEngine(): IRaceEngine {
    return this.raceEngine;
  }

  setRaceEngine(engine: IRaceEngine): void {
    this.raceEngine = engine;
  }

  getDesignEngine(): IDesignEngine {
    return this.designEngine;
  }

  setDesignEngine(engine: IDesignEngine): void {
    this.designEngine = engine;
  }

  getConstructionEngine(): IConstructionEngine {
    return this.constructionEngine;
  }

  setConstructionEngine(engine: IConstructionEngine): void {
    this.constructionEngine = engine;
  }

  getDevelopmentEngine(): IDevelopmentEngine {
    return this.developmentEngine;
  }

  setDevelopmentEngine(engine: IDevelopmentEngine): void {
    this.developmentEngine = engine;
  }

  getStaffEngine(): IStaffEngine {
    return this.staffEngine;
  }

  setStaffEngine(engine: IStaffEngine): void {
    this.staffEngine = engine;
  }

  getFinancialEngine(): IFinancialEngine {
    return this.financialEngine;
  }

  setFinancialEngine(engine: IFinancialEngine): void {
    this.financialEngine = engine;
  }

  getMarketEngine(): IMarketEngine {
    return this.marketEngine;
  }

  setMarketEngine(engine: IMarketEngine): void {
    this.marketEngine = engine;
  }

  getWeatherEngine(): IWeatherEngine {
    return this.weatherEngine;
  }

  setWeatherEngine(engine: IWeatherEngine): void {
    this.weatherEngine = engine;
  }

  getCarPerformanceEngine(): ICarPerformanceEngine {
    return this.carPerformanceEngine;
  }

  setCarPerformanceEngine(engine: ICarPerformanceEngine): void {
    this.carPerformanceEngine = engine;
  }

  getDriverPerformanceEngine(): IDriverPerformanceEngine {
    return this.driverPerformanceEngine;
  }

  setDriverPerformanceEngine(engine: IDriverPerformanceEngine): void {
    this.driverPerformanceEngine = engine;
  }

  getRegulationEngine(): IRegulationEngine {
    return this.regulationEngine;
  }

  setRegulationEngine(engine: IRegulationEngine): void {
    this.regulationEngine = engine;
  }
}
