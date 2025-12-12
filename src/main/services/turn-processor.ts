/**
 * Turn Processor Module
 *
 * Handles turn processing, phase transitions, and daily updates.
 */

import { randomUUID } from 'crypto';
import { EngineManager } from '../engines/engine-manager';
import {
  formatChiefSender,
  createDesignEmail,
  applyDesignUpdates,
  applyTestingUpdates,
  updateProjectedMilestones,
} from './design-processor';
import { applyDriverStateChanges, applyTeamStateChanges } from './race-processor';
import {
  buildNegotiationInput,
  applyNegotiationUpdates,
  processProactiveOutreach,
  processDriverOutreach,
  processSponsorOutreach,
  processStaffOutreach,
} from './negotiation-processor';
import type {
  GameState,
  GameDate,
} from '../../shared/domain';
import type {
  TurnProcessingInput,
  TurnProcessingResult,
} from '../../shared/domain/engines';
import type { AdvanceWeekResult, SimulationTickPayload } from '../../shared/ipc';
import {
  GamePhase,
  EmailCategory,
  ManufacturerType,
  ChiefRole,
  DriverRole,
  CalendarEventType,
} from '../../shared/domain';
import { isSameDay } from '../../shared/utils/date-utils';
import {
  type PartReadyData,
  type SpecReleaseData,
  type SpecReleaseStatChange,
} from '../../shared/domain/types';
import {
  shouldReleaseSpec,
  generateSpecBonus,
  ENGINE_STAT_KEYS,
  ENGINE_STAT_DISPLAY_NAMES,
} from '../../shared/domain/engine-utils';
import { generateDailyNews } from './news-generator';

/** Shared engine manager instance */
const engineManager = new EngineManager();

// =============================================================================
// TURN INPUT BUILDING
// =============================================================================

/**
 * Build TurnProcessingInput from current game state
 */
export function buildTurnInput(state: GameState): TurnProcessingInput {
  return {
    currentDate: state.currentDate,
    phase: state.phase,
    calendar: state.currentSeason.calendar,
    drivers: state.drivers,
    teams: state.teams,
    chiefs: state.chiefs,
    driverStates: state.driverStates,
    teamStates: state.teamStates,
    sponsorDeals: state.sponsorDeals,
    manufacturerContracts: state.manufacturerContracts,
  };
}

// =============================================================================
// PENDING PARTS CHECKING
// =============================================================================

/**
 * Check for pending parts that are ready and emit Part Ready emails
 * Returns true if any part became ready (for auto-stop)
 */
export function checkPendingParts(state: GameState, currentDate: GameDate): boolean {
  const playerTeamId = state.player.teamId;
  const teamState = state.teamStates[playerTeamId];
  const playerTeam = state.teams.find((t) => t.id === playerTeamId);
  if (!teamState || !playerTeam) return false;

  // Find team drivers for recommendation
  const teamDrivers = state.drivers.filter(
    (d) => d.teamId === playerTeamId && d.role !== DriverRole.Test
  );
  if (teamDrivers.length < 2) return false; // Need 2 drivers for recommendation

  // Sort by car number to get car 1 and car 2 drivers
  const sortedDrivers = [...teamDrivers].sort(
    (a, b) => (a.raceNumber ?? 99) - (b.raceNumber ?? 99)
  );
  const driver1 = sortedDrivers[0];
  const driver2 = sortedDrivers[1];

  // Determine recommendation based on driver roles
  // Driver 1 / Driver 2 roles: always recommend Driver 1
  // Equal / Equal roles: use a simple rotation (first ready part goes to car 1)
  const equalRoles = driver1.role === DriverRole.Equal && driver2.role === DriverRole.Equal;

  // Get chief designer for sender
  const chiefDesigner = state.chiefs.find(
    (c) => c.teamId === playerTeamId && c.role === ChiefRole.Designer
  );
  const sender = formatChiefSender(chiefDesigner ?? null);

  let hadReadyPart = false;
  let partIndex = 0;

  for (const pendingPart of teamState.pendingParts) {
    // Only process parts that are ready and not yet installed
    if (pendingPart.installedOnCars.length > 0) continue;
    if (!isSameDay(pendingPart.readyDate, currentDate)) continue;

    hadReadyPart = true;

    // Determine recommendation for this part
    let recommendedCar: 1 | 2;
    let recommendedDriver: typeof driver1;
    let otherDriver: typeof driver1;

    if (equalRoles) {
      // Rotate recommendation based on part index
      recommendedCar = partIndex % 2 === 0 ? 1 : 2;
      recommendedDriver = recommendedCar === 1 ? driver1 : driver2;
      otherDriver = recommendedCar === 1 ? driver2 : driver1;
    } else {
      // Driver 1 role gets priority
      if (driver1.role === DriverRole.First) {
        recommendedCar = 1;
        recommendedDriver = driver1;
        otherDriver = driver2;
      } else {
        recommendedCar = 2;
        recommendedDriver = driver2;
        otherDriver = driver1;
      }
    }

    const data: PartReadyData = {
      category: EmailCategory.PartReady,
      pendingPartId: pendingPart.id,
      item: pendingPart.item,
      payoff: pendingPart.payoff,
      baseCost: pendingPart.baseCost,
      recommendedCar,
      recommendedDriverId: recommendedDriver.id,
      recommendedDriverName: `${recommendedDriver.firstName} ${recommendedDriver.lastName}`,
      otherDriverId: otherDriver.id,
      otherDriverName: `${otherDriver.firstName} ${otherDriver.lastName}`,
      chiefId: chiefDesigner?.id,
    };

    const subject = `Part ready: ${pendingPart.item}`;
    const body = `The ${pendingPart.item} is now ready for installation. ` +
      `We recommend installing on ${recommendedDriver.firstName} ${recommendedDriver.lastName}'s car first. ` +
      `Installation cost: $${pendingPart.baseCost.toLocaleString()} per car, ` +
      `or $${(pendingPart.baseCost * 3).toLocaleString()} for both cars (rush).`;

    state.calendarEvents.push(
      createDesignEmail(
        currentDate,
        subject,
        body,
        sender,
        chiefDesigner?.id,
        EmailCategory.PartReady,
        true, // Critical - auto-stop for player to make installation choice
        data
      )
    );

    partIndex++;
  }

  return hadReadyPart;
}

// =============================================================================
// SPEC RELEASES
// =============================================================================

/**
 * Process spec releases for all engine manufacturers
 * Each manufacturer has a daily probability of releasing a new spec
 */
export function processSpecReleases(state: GameState, currentDate: GameDate): void {
  // Only process during racing season (not pre-season or post-season)
  if (state.phase === GamePhase.PreSeason || state.phase === GamePhase.PostSeason) {
    return;
  }

  const playerTeamId = state.player.teamId;
  const playerEngineContract = state.manufacturerContracts.find(
    (c) => c.teamId === playerTeamId && c.type === ManufacturerType.Engine
  );

  for (const specState of state.manufacturerSpecs) {
    const manufacturer = state.manufacturers.find((m) => m.id === specState.manufacturerId);
    if (!manufacturer) continue;

    // Check if this manufacturer releases a spec today
    if (!shouldReleaseSpec(manufacturer.reputation)) continue;

    // Generate the new spec bonuses
    const newBonus = generateSpecBonus(manufacturer.reputation);
    specState.latestSpecVersion += 1;
    specState.specBonuses.push(newBonus);

    // Build stat changes for the email
    const statChanges: SpecReleaseStatChange[] = [];
    for (const key of ENGINE_STAT_KEYS) {
      if (newBonus[key] > 0) {
        statChanges.push({
          stat: key,
          statName: ENGINE_STAT_DISPLAY_NAMES[key],
          improvement: newBonus[key],
        });
      }
    }

    // Build common fields for the event
    const statSummary = statChanges.map((s) => `${s.statName} +${s.improvement}`).join(', ');
    const subject = `${manufacturer.name} releases Spec ${specState.latestSpecVersion}.0`;

    // Check if this affects the player's team
    const affectsPlayer = playerEngineContract?.manufacturerId === manufacturer.id;

    // Create email for player if it affects them, news headline otherwise
    if (affectsPlayer) {
      const data: SpecReleaseData = {
        category: EmailCategory.SpecRelease,
        manufacturerId: manufacturer.id,
        manufacturerName: manufacturer.name,
        newSpecVersion: specState.latestSpecVersion,
        statChanges,
        affectsPlayer: true,
      };

      const body = `${manufacturer.name} has released a new engine specification! ` +
        `Spec ${specState.latestSpecVersion}.0 brings improvements to: ${statSummary}. ` +
        `This upgrade is now available for purchase for your cars.`;

      state.calendarEvents.push({
        id: randomUUID(),
        date: currentDate,
        type: CalendarEventType.Email,
        subject,
        body,
        critical: false, // Not critical - player can continue simulation
        emailCategory: EmailCategory.SpecRelease,
        sender: `${manufacturer.name} Technical Department`,
        data,
      });
    } else {
      // News headline for other manufacturers' spec releases
      const body = `${manufacturer.name} has released a new engine specification. ` +
        `The update brings improvements to: ${statSummary}.`;

      state.calendarEvents.push({
        id: randomUUID(),
        date: currentDate,
        type: CalendarEventType.Headline,
        subject,
        body,
        critical: false,
      });
    }
  }
}

// =============================================================================
// TURN RESULT APPLICATION
// =============================================================================

/**
 * Apply turn processing result to game state (mutates state)
 * Returns true if player team had a design milestone or test completion (for auto-stop)
 */
export function applyTurnResult(state: GameState, result: TurnProcessingResult): boolean {
  state.currentDate = result.newDate;
  state.phase = result.newPhase;
  applyDriverStateChanges(state, result.driverStateChanges);
  applyTeamStateChanges(state, result.teamStateChanges);

  // Apply design updates and check for player milestones
  const playerHadDesignMilestone = applyDesignUpdates(state, result.designUpdates, result.newDate);

  // Apply testing updates and check for player completions
  const playerHadTestCompletion = applyTestingUpdates(state, result.testingUpdates, result.newDate);

  // Check for pending parts that are ready
  const playerHadReadyPart = checkPendingParts(state, result.newDate);

  // Process manufacturer spec releases
  processSpecReleases(state, result.newDate);

  // Process active negotiations (manufacturer responses)
  const negotiationInput = buildNegotiationInput(state);
  const negotiationResult = engineManager.negotiation.processDay(negotiationInput);
  const negotiationStopped = applyNegotiationUpdates(state, negotiationResult.updates);

  // Process proactive outreach from manufacturers
  const playerReceivedManufacturerOutreach = processProactiveOutreach(state);

  // Process proactive outreach from drivers
  const playerReceivedDriverOutreach = processDriverOutreach(state);

  // Process proactive outreach from sponsors
  const playerReceivedSponsorOutreach = processSponsorOutreach(state);

  // Process proactive outreach from staff
  const playerReceivedStaffOutreach = processStaffOutreach(state);

  // Update projected milestone dates based on current progress
  updateProjectedMilestones(state);

  // Generate daily news headlines
  const dailyNews = generateDailyNews(state);
  state.calendarEvents.push(...dailyNews);

  return playerHadDesignMilestone || playerHadTestCompletion || playerHadReadyPart || negotiationStopped || playerReceivedManufacturerOutreach || playerReceivedDriverOutreach || playerReceivedSponsorOutreach || playerReceivedStaffOutreach;
}

/**
 * Apply blocked turn result to state and return blocked AdvanceWeekResult.
 * Used when advancement is blocked (e.g., post-season reached).
 */
export function applyBlockedResult(state: GameState, turnResult: TurnProcessingResult): AdvanceWeekResult {
  state.currentDate = turnResult.newDate;
  state.phase = turnResult.newPhase;
  return {
    success: true,
    state,
    blocked: turnResult.blocked,
  };
}

/**
 * Process a turn and apply results to state.
 * Handles both blocked and normal turn outcomes.
 */
export function processTurn(state: GameState): AdvanceWeekResult {
  const turnInput = buildTurnInput(state);
  const turnResult = engineManager.turn.processDay(turnInput);

  if (turnResult.blocked) {
    return applyBlockedResult(state, turnResult);
  }

  applyTurnResult(state, turnResult);
  return { success: true, state };
}

// =============================================================================
// SIMULATION TICK
// =============================================================================

/**
 * Processes a single simulation tick (one day).
 * Returns the tick payload to send to renderer.
 * Updates the game state's simulation.isSimulating flag if stopped.
 */
export function processSimulationTick(state: GameState): SimulationTickPayload {
  const turnInput = buildTurnInput(state);
  const turnResult = engineManager.turn.processDay(turnInput);

  // Apply turn result (works for both blocked and normal cases -
  // blocked returns empty change arrays so this is safe)
  const playerHadMilestone = applyTurnResult(state, turnResult);

  // Determine if we should stop (blocked, explicit stop flag, or design milestone)
  const shouldStop =
    turnResult.blocked !== undefined ||
    turnResult.shouldStopSimulation ||
    playerHadMilestone;

  // Determine stop reason
  let stopReason = turnResult.stopReason;
  if (!stopReason && playerHadMilestone) {
    stopReason = 'design-milestone';
  }

  if (shouldStop) {
    state.simulation.isSimulating = false;
  }

  return {
    state,
    stopped: shouldStop,
    stopReason,
  };
}
