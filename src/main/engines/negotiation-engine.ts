/**
 * Negotiation Engine
 *
 * Processes all active negotiations during day simulation.
 * Dispatches to stakeholder-specific evaluators based on negotiation type.
 *
 * Responsibilities:
 * - Check if responses are due based on response delay
 * - Call appropriate evaluator (manufacturer, driver, staff, sponsor)
 * - Generate negotiation updates with new rounds
 * - Flag sim-stopping emails and newsworthy events
 */

import type {
  INegotiationEngine,
  NegotiationEvaluationInput,
  NegotiationEvaluationResult,
  NegotiationProcessingInput,
  NegotiationProcessingResult,
  NegotiationUpdate,
} from '../../shared/domain/engines';
import type {
  Negotiation,
  ManufacturerNegotiation,
  DriverNegotiation,
  SponsorNegotiation,
  StaffNegotiation,
  NegotiationRound,
  GameDate,
  DriverContractTerms,
  StaffContractTerms,
} from '../../shared/domain/types';
import {
  StakeholderType,
  NegotiationPhase,
  ResponseType,
  ResponseTone,
} from '../../shared/domain';
import {
  evaluateManufacturerOffer,
  evaluateDriverOffer,
  evaluateSponsorOffer,
  evaluateStaffOffer,
  MAX_DESPERATION_MULTIPLIER,
} from './evaluators';
import { offsetDate } from '../../shared/utils/date-utils';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default response delay for stub evaluators */
const DEFAULT_RESPONSE_DELAY_DAYS = 3;

/** Default expiration days from offer date */
const DEFAULT_EXPIRATION_DAYS = 14;

/** Default relationship score when not specified (neutral) */
const DEFAULT_RELATIONSHIP_SCORE = 50;

/** Maximum rounds before negotiations typically fail */
const MAX_NEGOTIATION_ROUNDS = 5;

// =============================================================================
// DATE HELPERS
// =============================================================================

/**
 * Compare two GameDates
 * Returns: negative if a < b, 0 if equal, positive if a > b
 */
function compareDates(a: GameDate, b: GameDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Check if a response is due (response date <= current date)
 */
function isResponseDue(
  round: NegotiationRound,
  currentDate: GameDate,
  responseDelayDays: number
): boolean {
  const responseDate = offsetDate(round.offeredDate, responseDelayDays);
  return compareDates(responseDate, currentDate) <= 0;
}

// =============================================================================
// EVALUATOR DISPATCH
// =============================================================================

/**
 * Dispatch to appropriate evaluator based on stakeholder type
 */
function dispatchToEvaluator(
  negotiation: Negotiation,
  input: NegotiationProcessingInput
): NegotiationEvaluationResult {
  switch (negotiation.stakeholderType) {
    case StakeholderType.Manufacturer: {
      const mfgNegotiation = negotiation as ManufacturerNegotiation;
      const manufacturer = input.manufacturers.find(
        (m) => m.id === mfgNegotiation.manufacturerId
      );
      const team = input.teams.find((t) => t.id === negotiation.teamId);

      if (!manufacturer || !team) {
        // Missing data - return rejection
        return {
          responseType: ResponseType.Reject,
          counterTerms: null,
          responseTone: ResponseTone.Professional,
          responseDelayDays: DEFAULT_RESPONSE_DELAY_DAYS,
          isNewsworthy: false,
          relationshipChange: 0,
        };
      }

      const relationshipScore =
        input.relationshipScores[mfgNegotiation.manufacturerId] ?? DEFAULT_RELATIONSHIP_SCORE;

      return evaluateManufacturerOffer({
        negotiation: mfgNegotiation,
        manufacturer,
        team,
        allTeams: input.teams,
        relationshipScore,
        securedTeamIds: input.securedTeamIds,
        activeContracts: input.activeManufacturerContracts,
      });
    }

    case StakeholderType.Driver: {
      const driverNegotiation = negotiation as DriverNegotiation;
      const driver = input.drivers.find((d) => d.id === driverNegotiation.driverId);
      const offeringTeam = input.teams.find((t) => t.id === negotiation.teamId);

      if (!driver || !offeringTeam) {
        return {
          responseType: ResponseType.Reject,
          counterTerms: null,
          responseTone: ResponseTone.Professional,
          responseDelayDays: DEFAULT_RESPONSE_DELAY_DAYS,
          isNewsworthy: false,
          relationshipChange: 0,
        };
      }

      // Get offered terms from the last round
      const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
      const terms = lastRound.terms as DriverContractTerms;

      // Get driver's desperation multiplier from runtime state
      const driverState = input.driverStates[driver.id];
      const desperationMultiplier =
        driverState?.desperationMultiplier ?? MAX_DESPERATION_MULTIPLIER;

      // Calculate available seats: teams with fewer than 2 drivers
      const teamDriverCounts = new Map<string, number>();
      for (const d of input.drivers) {
        if (d.teamId) {
          teamDriverCounts.set(d.teamId, (teamDriverCounts.get(d.teamId) ?? 0) + 1);
        }
      }
      const availableSeats = input.teams.reduce((count, team) => {
        const driverCount = teamDriverCounts.get(team.id) ?? 0;
        return count + Math.max(0, 2 - driverCount);
      }, 0);

      return evaluateDriverOffer({
        driver,
        offeringTeam,
        offeredSalary: terms.salary,
        offeredDuration: terms.duration,
        allDrivers: input.drivers,
        allTeams: input.teams,
        constructorStandings: input.constructorStandings,
        availableSeats,
        currentRound: negotiation.rounds.length,
        maxRounds: MAX_NEGOTIATION_ROUNDS,
        desperationMultiplier,
        gameYear: input.currentDate.year,
      });
    }

    case StakeholderType.Staff: {
      const staffNegotiation = negotiation as StaffNegotiation;
      const chief = input.chiefs.find((c) => c.id === staffNegotiation.staffId);
      const offeringTeam = input.teams.find((t) => t.id === negotiation.teamId);

      if (!chief || !offeringTeam) {
        return {
          responseType: ResponseType.Reject,
          counterTerms: null,
          responseTone: ResponseTone.Professional,
          responseDelayDays: DEFAULT_RESPONSE_DELAY_DAYS,
          isNewsworthy: false,
          relationshipChange: 0,
        };
      }

      const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
      const terms = lastRound.terms as StaffContractTerms;

      return evaluateStaffOffer({
        chief,
        offeringTeam,
        offeredSalary: terms.salary,
        offeredDuration: terms.duration,
        offeredSigningBonus: terms.signingBonus,
        offeredBonusPercent: terms.bonusPercent,
        buyoutRequired: terms.buyoutRequired,
        allTeams: input.teams,
        currentRound: negotiation.rounds.length,
        maxRounds: MAX_NEGOTIATION_ROUNDS,
      });
    }

    case StakeholderType.Sponsor: {
      const sponsorNegotiation = negotiation as SponsorNegotiation;
      const sponsor = input.sponsors.find((s) => s.id === sponsorNegotiation.sponsorId);
      const team = input.teams.find((t) => t.id === negotiation.teamId);

      if (!sponsor || !team) {
        return {
          responseType: ResponseType.Reject,
          counterTerms: null,
          responseTone: ResponseTone.Professional,
          responseDelayDays: DEFAULT_RESPONSE_DELAY_DAYS,
          isNewsworthy: false,
          relationshipChange: 0,
        };
      }

      const relationshipScore =
        input.relationshipScores[sponsorNegotiation.sponsorId] ?? DEFAULT_RELATIONSHIP_SCORE;

      // Calculate team position from constructor standings
      const teamPosition = input.constructorStandings.get(team.id) ?? input.teams.length;
      const totalTeams = input.teams.length;

      return evaluateSponsorOffer({
        negotiation: sponsorNegotiation,
        sponsor,
        team,
        allTeams: input.teams,
        allSponsors: input.sponsors,
        existingSponsorDeals: input.activeSponsorDeals.filter((d) => d.teamId === team.id),
        relationshipScore,
        teamPosition,
        totalTeams,
      });
    }

    default:
      // Unknown type - reject
      return {
        responseType: ResponseType.Reject,
        counterTerms: null,
        responseTone: ResponseTone.Professional,
        responseDelayDays: DEFAULT_RESPONSE_DELAY_DAYS,
        isNewsworthy: false,
        relationshipChange: 0,
      };
  }
}

/**
 * Create a new round based on evaluation result
 */
function createResponseRound(
  previousRound: NegotiationRound,
  result: NegotiationEvaluationResult,
  currentDate: GameDate
): NegotiationRound {
  const expirationDate = offsetDate(currentDate, DEFAULT_EXPIRATION_DAYS);

  return {
    roundNumber: previousRound.roundNumber + 1,
    offeredBy: 'counterparty',
    terms: result.counterTerms ?? previousRound.terms,
    offeredDate: currentDate,
    expiresDate: expirationDate,
    responseType: result.responseType,
    responseTone: result.responseTone,
    responseDate: currentDate,
    isUltimatum: result.isUltimatum,
  };
}

/**
 * Determine the new negotiation phase based on response
 */
function determineNewPhase(responseType: ResponseType): NegotiationPhase {
  switch (responseType) {
    case ResponseType.Accept:
      return NegotiationPhase.Completed;
    case ResponseType.Reject:
      return NegotiationPhase.Failed;
    case ResponseType.Counter:
      // Counterparty countered - player's turn to respond
      return NegotiationPhase.ResponseReceived;
    case ResponseType.NeedTime:
      // Counterparty needs more time - still waiting for their decision
      return NegotiationPhase.AwaitingResponse;
    default:
      return NegotiationPhase.AwaitingResponse;
  }
}

/**
 * Process a single negotiation
 */
function processNegotiation(
  negotiation: Negotiation,
  input: NegotiationProcessingInput
): NegotiationUpdate | null {
  // Only process negotiations awaiting response
  if (negotiation.phase !== NegotiationPhase.AwaitingResponse) {
    return null;
  }

  // Get the last round
  const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
  if (!lastRound) {
    return null;
  }

  // Only process if it's the player's offer (counterparty needs to respond)
  if (lastRound.offeredBy !== 'player') {
    return null;
  }

  // Check if response is due
  // For now, use default delay - later will be stored per-negotiation
  if (!isResponseDue(lastRound, input.currentDate, DEFAULT_RESPONSE_DELAY_DAYS)) {
    return null;
  }

  // Evaluate the offer
  const result = dispatchToEvaluator(negotiation, input);

  // Create response round
  const responseRound = createResponseRound(lastRound, result, input.currentDate);

  // Update negotiation
  // Type assertion needed because Negotiation is a union type with different round types
  // The cast is safe because responseRound is created from the same negotiation's lastRound
  const updatedNegotiation = {
    ...negotiation,
    phase: determineNewPhase(result.responseType),
    rounds: [...negotiation.rounds, responseRound],
  } as Negotiation;

  // Determine if should stop simulation
  // Always stop for: Accept, Reject (negotiation concluded)
  // Stop for Counter only if it's an ultimatum
  const shouldStop =
    result.responseType === ResponseType.Accept ||
    result.responseType === ResponseType.Reject ||
    (result.responseType === ResponseType.Counter && (result.isUltimatum ?? false));

  return {
    negotiationId: negotiation.id,
    updatedNegotiation,
    shouldStopSimulation: shouldStop,
    isNewsworthy: result.isNewsworthy,
  };
}

// =============================================================================
// NEGOTIATION ENGINE IMPLEMENTATION
// =============================================================================

export class NegotiationEngine implements INegotiationEngine {
  /**
   * Evaluate a single offer
   * Dispatches to appropriate stakeholder evaluator
   */
  evaluateOffer(_input: NegotiationEvaluationInput): NegotiationEvaluationResult {
    // This method is for direct evaluation (not during day processing)
    // For now, return a stub response
    // The actual evaluation happens in dispatchToEvaluator during processDay
    return {
      responseType: ResponseType.Accept,
      counterTerms: null,
      responseTone: ResponseTone.Professional,
      responseDelayDays: DEFAULT_RESPONSE_DELAY_DAYS,
      isNewsworthy: false,
      relationshipChange: 0,
    };
  }

  /**
   * Process all active negotiations for a single day
   * Checks if any responses are due and generates them
   */
  processDay(input: NegotiationProcessingInput): NegotiationProcessingResult {
    const updates: NegotiationUpdate[] = [];

    for (const negotiation of input.negotiations) {
      const update = processNegotiation(negotiation, input);
      if (update) {
        updates.push(update);
      }
    }

    return { updates };
  }
}
