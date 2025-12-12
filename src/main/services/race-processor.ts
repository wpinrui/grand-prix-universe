/**
 * Race Processor Module
 *
 * Handles race weekend processing, repairs, results, and engine analytics.
 */

import { randomUUID } from 'crypto';
import { EngineManager } from '../engines/engine-manager';
import { generateStubRaceResult } from '../engines/stubs';
import { clampPercentage } from './state-utils';
import { pushNewsEvent } from './news-generator';
import type {
  GameState,
  CalendarEntry,
  Driver,
  RaceWeekendResult,
} from '../../shared/domain';
import type {
  RaceProcessingInput,
  RaceProcessingResult,
  DriverStateChange,
  TeamStateChange,
  ChampionshipStandings,
} from '../../shared/domain/engines';
import {
  CalendarEventType,
  EmailCategory,
  Department,
  ManufacturerType,
  hasRaceSeat,
  DriverRole,
  NewsEventType,
} from '../../shared/domain';
import {
  RaceFinishStatus,
  PartsLogEntryType,
  type CarRepairCost,
  type PostRaceRepairData,
  type DriverRaceResult,
  type DriverStanding,
} from '../../shared/domain/types';
import {
  getEffectiveEngineStats,
  getSpecBonusesAsEngineStats,
  calculateTruePower,
  generateEstimatedPower,
} from '../../shared/domain/engine-utils';
import { getWeekNumber } from '../../shared/utils/date-utils';
import { getFullName } from '../../shared/utils/format';

/** Post-Race Repair Costs - values per proposal.md, simplified for MVP */
const REPAIR_COST_BASE = 50000; // Routine maintenance after every race
const REPAIR_COST_DNF = 400000; // Additional cost when driver retires from race

/** Shared engine manager instance */
const engineManager = new EngineManager();

// =============================================================================
// STATE CHANGE APPLICATION
// =============================================================================

/**
 * Apply driver state changes to game state (mutates state)
 */
export function applyDriverStateChanges(
  state: GameState,
  changes: DriverStateChange[]
): void {
  for (const change of changes) {
    const driverState = state.driverStates[change.driverId];
    if (!driverState) continue;

    if (change.fatigueChange !== undefined) {
      driverState.fatigue = clampPercentage(driverState.fatigue + change.fatigueChange);
    }
    if (change.fitnessChange !== undefined) {
      driverState.fitness = clampPercentage(driverState.fitness + change.fitnessChange);
    }
    if (change.moraleChange !== undefined) {
      driverState.morale = clampPercentage(driverState.morale + change.moraleChange);
    }
    if (change.setInjuryWeeks !== undefined) {
      driverState.injuryWeeksRemaining = change.setInjuryWeeks;
    }
    if (change.setBanRaces !== undefined) {
      driverState.banRacesRemaining = change.setBanRaces;
    }
    if (change.engineUnitsUsedChange !== undefined) {
      driverState.engineUnitsUsed += change.engineUnitsUsedChange;
    }
    if (change.gearboxRaceCountChange !== undefined) {
      driverState.gearboxRaceCount += change.gearboxRaceCountChange;
    }

    // Reputation changes apply to the driver entity, not runtime state
    if (change.reputationChange !== undefined) {
      const driver = state.drivers.find((d) => d.id === change.driverId);
      if (driver) {
        driver.reputation = clampPercentage(driver.reputation + change.reputationChange);
      }
    }
  }
}

/**
 * Apply team state changes to game state (mutates state)
 */
export function applyTeamStateChanges(
  state: GameState,
  changes: TeamStateChange[]
): void {
  for (const change of changes) {
    const teamState = state.teamStates[change.teamId];
    const team = state.teams.find((t) => t.id === change.teamId);
    if (!teamState || !team) continue;

    if (change.budgetChange !== undefined) {
      team.budget += change.budgetChange;
    }

    if (change.moraleChanges) {
      for (const [dept, delta] of Object.entries(change.moraleChanges)) {
        const department = dept as Department;
        if (teamState.morale[department] !== undefined && delta !== undefined) {
          teamState.morale[department] = clampPercentage(teamState.morale[department] + delta);
        }
      }
    }

    if (change.sponsorSatisfactionChanges) {
      for (const [sponsorId, delta] of Object.entries(change.sponsorSatisfactionChanges)) {
        if (teamState.sponsorSatisfaction[sponsorId] !== undefined) {
          teamState.sponsorSatisfaction[sponsorId] = clampPercentage(
            teamState.sponsorSatisfaction[sponsorId] + delta
          );
        }
      }
    }
  }
}

/**
 * Update championship standings in game state (mutates state)
 */
export function updateChampionshipStandings(
  state: GameState,
  standings: ChampionshipStandings
): void {
  state.currentSeason.driverStandings = standings.drivers;
  state.currentSeason.constructorStandings = standings.constructors;
}

// =============================================================================
// RACE INPUT BUILDING
// =============================================================================

/**
 * Build RaceProcessingInput from current game state and race result
 */
export function buildRaceInput(state: GameState, raceResult: RaceWeekendResult): RaceProcessingInput {
  return {
    drivers: state.drivers,
    teams: state.teams,
    driverStates: state.driverStates,
    teamStates: state.teamStates,
    raceResult,
    currentStandings: {
      drivers: state.currentSeason.driverStandings,
      constructors: state.currentSeason.constructorStandings,
    },
  };
}

/**
 * Mark calendar entry as completed with race result
 */
export function markRaceComplete(state: GameState, circuitId: string, result: RaceWeekendResult): void {
  const entry = state.currentSeason.calendar.find((e) => e.circuitId === circuitId);
  if (entry) {
    entry.completed = true;
    entry.result = result;
  }
}

/**
 * Apply race processing result to game state (mutates state)
 */
export function applyRaceResult(
  state: GameState,
  raceResult: RaceProcessingResult
): void {
  applyDriverStateChanges(state, raceResult.driverStateChanges);
  applyTeamStateChanges(state, raceResult.teamStateChanges);
  updateChampionshipStandings(state, raceResult.updatedStandings);
}

// =============================================================================
// POST-RACE REPAIRS
// =============================================================================

/**
 * Calculate repair cost for a single driver's race result
 */
function calculateCarRepairCost(
  result: DriverRaceResult,
  driver: Driver,
  carNumber: 1 | 2
): CarRepairCost {
  const wasRetired = result.status === RaceFinishStatus.Retired;
  const incidentCost = wasRetired ? REPAIR_COST_DNF : 0;

  return {
    carNumber,
    driverId: driver.id,
    driverName: getFullName(driver),
    baseCost: REPAIR_COST_BASE,
    incidentCost,
    totalCost: REPAIR_COST_BASE + incidentCost,
    wasRetired,
  };
}

/**
 * Process post-race repairs for all teams after a race.
 * Deducts repair costs and sends email notification to player team.
 */
export function processPostRaceRepairs(
  state: GameState,
  raceResult: RaceWeekendResult,
  circuitId: string
): void {
  const circuit = state.circuits.find((c) => c.id === circuitId);
  const circuitName = circuit?.name ?? 'Unknown Circuit';
  const playerTeamId = state.player.teamId;

  // Process each team
  for (const team of state.teams) {
    const teamState = state.teamStates[team.id];
    if (!teamState) continue;

    // Find drivers for this team (car 1 = first driver role, car 2 = second)
    const teamDrivers = state.drivers.filter((d) => d.teamId === team.id && hasRaceSeat(d));
    const car1Driver = teamDrivers.find((d) => d.role === DriverRole.First);
    const car2Driver = teamDrivers.find((d) => d.role === DriverRole.Second);

    if (!car1Driver || !car2Driver) continue;

    // Find race results for each driver
    const car1Result = raceResult.race.find((r) => r.driverId === car1Driver.id);
    const car2Result = raceResult.race.find((r) => r.driverId === car2Driver.id);

    if (!car1Result || !car2Result) continue;

    // Calculate repair costs
    const car1Repair = calculateCarRepairCost(car1Result, car1Driver, 1);
    const car2Repair = calculateCarRepairCost(car2Result, car2Driver, 2);
    const totalCost = car1Repair.totalCost + car2Repair.totalCost;

    // Deduct from team budget
    team.budget -= totalCost;

    // Add to partsLog for both cars
    const repairs = [
      { repair: car1Repair, driver: car1Driver },
      { repair: car2Repair, driver: car2Driver },
    ];

    for (const { repair, driver } of repairs) {
      state.partsLog.push({
        id: randomUUID(),
        date: { ...state.currentDate },
        seasonNumber: state.currentSeason.seasonNumber,
        type: PartsLogEntryType.Repair,
        item: 'Post-Race Repair',
        cost: repair.totalCost,
        driverId: driver.id,
        carNumber: repair.carNumber,
        repairDetails: repair.wasRetired ? 'Race retirement' : 'Routine maintenance',
      });
    }

    // Send email only for player team
    if (team.id === playerTeamId) {
      const emailData: PostRaceRepairData = {
        category: EmailCategory.PostRaceRepair,
        raceNumber: raceResult.raceNumber,
        circuitName,
        car1: car1Repair,
        car2: car2Repair,
        totalCost,
      };

      state.calendarEvents.push({
        id: randomUUID(),
        date: { ...state.currentDate },
        type: CalendarEventType.Email,
        subject: `Post-Race Repair Report - ${circuitName}`,
        critical: false,
        emailCategory: EmailCategory.PostRaceRepair,
        sender: 'Finance Department',
        body:
          `Race repairs have been completed for both cars after the ${circuitName} Grand Prix.\n\n` +
          `Total cost: $${totalCost.toLocaleString()}`,
        data: emailData,
      });
    }
  }
}

// =============================================================================
// ENGINE ANALYTICS
// =============================================================================

/**
 * Generate engine analytics data for all teams after a race.
 * Each team gets an estimated power value with ±8% error.
 */
export function generateEngineAnalyticsData(state: GameState, raceNumber: number): void {
  for (const team of state.teams) {
    // Get the team's engine contract
    const contract = state.manufacturerContracts.find(
      (c) => c.teamId === team.id && c.type === ManufacturerType.Engine
    );
    if (!contract) continue;

    // Get manufacturer base stats
    const manufacturer = state.manufacturers.find((m) => m.id === contract.manufacturerId);
    if (!manufacturer) continue;

    // Get manufacturer spec state
    const specState = state.manufacturerSpecs.find((s) => s.manufacturerId === manufacturer.id);
    if (!specState) continue;

    // Get team engine state (use car1 as representative - or average both?)
    const teamState = state.teamStates[team.id];
    if (!teamState) continue;

    // Calculate effective stats for car1 (representative)
    const effectiveStats = getEffectiveEngineStats(
      manufacturer.engineStats,
      teamState.engineState.car1Engine.specVersion,
      getSpecBonusesAsEngineStats(specState),
      teamState.engineState.car1Engine.customisation
    );

    // Calculate true power and generate estimated value with error
    const truePower = calculateTruePower(effectiveStats);
    const estimatedPower = generateEstimatedPower(truePower);

    // Find or create analytics entry for this team
    const analyticsIndex = state.engineAnalytics.findIndex((a) => a.teamId === team.id);
    if (analyticsIndex === -1) {
      // Create new entry if not found
      state.engineAnalytics.push({
        teamId: team.id,
        dataPoints: [{ raceNumber, estimatedPower }],
      });
    } else {
      // Add data point to existing entry
      state.engineAnalytics[analyticsIndex].dataPoints.push({
        raceNumber,
        estimatedPower,
      });
    }
  }
}

// =============================================================================
// NEWS EVENT EMISSION
// =============================================================================

/**
 * Emit race result news event with all data needed for article generation
 */
function emitRaceResultEvent(
  state: GameState,
  raceResult: RaceWeekendResult,
  circuitId: string
): void {
  const circuit = state.circuits.find((c) => c.id === circuitId);
  if (!circuit) return;

  // Get podium finishers
  const sortedResults = [...raceResult.race]
    .filter((r) => r.finishPosition !== null)
    .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99));

  const winner = sortedResults[0];
  const second = sortedResults[1];
  const third = sortedResults[2];

  if (!winner || !second || !third) return;

  const winnerDriver = state.drivers.find((d) => d.id === winner.driverId);
  const winnerTeam = state.teams.find((t) => t.id === winner.teamId);
  const secondDriver = state.drivers.find((d) => d.id === second.driverId);
  const thirdDriver = state.drivers.find((d) => d.id === third.driverId);

  if (!winnerDriver || !winnerTeam || !secondDriver || !thirdDriver) return;

  // Format gap to second place
  let winnerMargin = '';
  if (winner.gapToWinner === 0 && second.gapToWinner) {
    const gap = second.gapToWinner / 1000; // Convert ms to seconds
    winnerMargin = `+${gap.toFixed(3)}s`;
  } else if (second.lapsBehind) {
    winnerMargin = second.lapsBehind === 1 ? '+1 lap' : `+${second.lapsBehind} laps`;
  } else {
    winnerMargin = '+0.000s';
  }

  pushNewsEvent(state, NewsEventType.RaceResult, 'high', {
    raceNumber: raceResult.raceNumber,
    circuitName: circuit.name,
    circuitCountry: circuit.country,
    winnerId: winnerDriver.id,
    winnerName: getFullName(winnerDriver),
    winnerTeamName: winnerTeam.name,
    secondName: getFullName(secondDriver),
    thirdName: getFullName(thirdDriver),
    winnerMargin,
  });
}

/**
 * Emit championship lead change event if the leader changed after this race
 */
function emitChampionshipLeadEvent(
  state: GameState,
  previousStandings: DriverStanding[],
  raceNumber: number
): void {
  const currentStandings = state.currentSeason.driverStandings;
  if (currentStandings.length === 0) return;

  const newLeader = currentStandings[0];
  const previousLeader = previousStandings[0];

  // Check if leader changed (or if this is the first race with standings)
  const leaderChanged = !previousLeader || previousLeader.driverId !== newLeader.driverId;

  if (!leaderChanged) return;

  const newLeaderDriver = state.drivers.find((d) => d.id === newLeader.driverId);
  const newLeaderTeam = state.teams.find((t) => t.id === newLeader.teamId);
  const previousLeaderDriver = previousLeader
    ? state.drivers.find((d) => d.id === previousLeader.driverId)
    : null;

  if (!newLeaderDriver || !newLeaderTeam) return;

  const pointsGap = currentStandings[1]
    ? newLeader.points - currentStandings[1].points
    : newLeader.points;

  pushNewsEvent(state, NewsEventType.ChampionshipLead, 'high', {
    newLeaderId: newLeaderDriver.id,
    newLeaderName: getFullName(newLeaderDriver),
    newLeaderTeam: newLeaderTeam.name,
    newLeaderPoints: newLeader.points,
    previousLeaderName: previousLeaderDriver
      ? getFullName(previousLeaderDriver)
      : 'no previous leader',
    pointsGap,
    raceNumber,
  });
}

// =============================================================================
// RACE WEEKEND PROCESSING
// =============================================================================

/**
 * Process a race weekend: generate result, apply changes, mark complete.
 * Called when the game is in RaceWeekend phase.
 */
export function processRaceWeekend(state: GameState, currentRace: CalendarEntry): void {
  // Capture standings before race for comparison
  const previousStandings = [...state.currentSeason.driverStandings];

  // Generate stub race result
  const raceResult = generateStubRaceResult(
    state,
    currentRace.circuitId,
    currentRace.raceNumber
  );

  // Process race through engine
  const raceInput = buildRaceInput(state, raceResult);
  const raceProcessingResult = engineManager.turn.processRace(raceInput);

  // Apply race results to state
  applyRaceResult(state, raceProcessingResult);

  // Mark race as complete
  markRaceComplete(state, currentRace.circuitId, raceResult);

  // Emit news events for race result and championship changes
  emitRaceResultEvent(state, raceResult, currentRace.circuitId);
  emitChampionshipLeadEvent(state, previousStandings, currentRace.raceNumber);

  // Process post-race repairs for all teams
  processPostRaceRepairs(state, raceResult, currentRace.circuitId);

  // Generate engine analytics data for all teams
  generateEngineAnalyticsData(state, currentRace.raceNumber);
}

// =============================================================================
// RACE FINDER
// =============================================================================

/**
 * Find the current race entry for a race weekend.
 * Returns the calendar entry if found, or an error result if not.
 */
export function findCurrentRace(
  state: GameState
): { race: CalendarEntry } | { error: { success: false; error: string } } {
  const currentWeek = getWeekNumber(state.currentDate);
  const race = state.currentSeason.calendar.find(
    (entry) =>
      entry.weekNumber === currentWeek &&
      !entry.completed &&
      !entry.cancelled
  );

  if (!race) {
    return { error: { success: false, error: 'No race found for current week' } };
  }

  return { race };
}
