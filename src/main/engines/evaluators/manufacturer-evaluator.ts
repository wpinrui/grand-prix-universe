/**
 * Manufacturer Evaluator
 *
 * Evaluates engine contract offers from the manufacturer's perspective.
 * Implements realistic negotiation behavior with:
 *
 * - Probabilistic pricing (secret floor with variance)
 * - Pattern detection (stubborn/aggressive player behavior)
 * - Graduated concessions over multiple rounds
 * - Ultimatum mechanics for both parties
 *
 * Based on proposal.md "Contract Negotiations System > ENGINE SUPPLIERS"
 */

import type {
  Team,
  Manufacturer,
  ManufacturerNegotiation,
  ContractTerms,
  NegotiationRound,
  ActiveManufacturerContract,
} from '../../../shared/domain/types';
import type { NegotiationEvaluationResult } from '../../../shared/domain/engines';
import { ResponseType, ResponseTone } from '../../../shared/domain';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Base response delay in days */
const BASE_RESPONSE_DELAY_DAYS = 3;

/** Maximum response delay in days */
const MAX_RESPONSE_DELAY_DAYS = 7;

/** Minimum response delay in days */
const MIN_RESPONSE_DELAY_DAYS = 1;

/** Relationship threshold for warm responses */
const WARM_RELATIONSHIP_THRESHOLD = 70;

/** Relationship threshold for cold responses */
const COLD_RELATIONSHIP_THRESHOLD = 30;

/** Relationship boost for accepting */
const ACCEPT_RELATIONSHIP_BOOST = 5;

/** Relationship penalty for rejecting */
const REJECT_RELATIONSHIP_PENALTY = -5;

/** Relationship penalty for issuing ultimatum */
const ULTIMATUM_RELATIONSHIP_PENALTY = -2;

/** Maximum rounds before AI issues ultimatum regardless */
const MAX_ROUNDS_BEFORE_ULTIMATUM = 5;

/** Ideal profit margin (30% above cost) */
const IDEAL_MARGIN = 1.30;

/** Comfortable profit margin (15% above cost) */
const COMFORTABLE_MARGIN = 1.15;

/** Minimum margin variance range (1.0 to 1.15, randomly selected per negotiation) */
const MIN_MARGIN_FLOOR = 1.0;
const MIN_MARGIN_CEILING = 1.15;

/** Maximum desperation discount */
const MAX_DESPERATION_DISCOUNT = 0.20;

/** Strategic value discount for top teams */
const STRATEGIC_VALUE_DISCOUNT = 0.08;

/** Threshold for strategic value to be considered "top team" (0-1 scale) */
const STRATEGIC_VALUE_THRESHOLD = 0.7;

/** Threshold for desperation to be considered "desperate" (0-1 scale) */
const DESPERATION_THRESHOLD = 0.3;

/** Concession rate per round (how much they move toward floor) */
const BASE_CONCESSION_RATE = 0.20;

/** Multiplier for threshold when player makes great concession */
const GREAT_CONCESSION_THRESHOLD_MULTIPLIER = 0.95;

/** Divisor for calculating round factor (accept lower prices in later rounds) */
const ROUND_FACTOR_DIVISOR = 4;

// =============================================================================
// TYPES
// =============================================================================

export interface ManufacturerEvaluationInput {
  negotiation: ManufacturerNegotiation;
  manufacturer: Manufacturer;
  team: Team;
  allTeams: Team[];
  relationshipScore: number;
  securedTeamIds: string[];
  /** Active manufacturer contracts (from GameState) - needed to calculate desperation */
  activeContracts: ActiveManufacturerContract[];
}

/** Player negotiation patterns */
type NegotiationPattern =
  | 'first-offer'      // First round, no pattern yet
  | 'cooperative'      // Making reasonable concessions
  | 'stubborn'         // Same offer twice
  | 'aggressive'       // Lowered their offer
  | 'good-concession'  // Moved 10-20% toward AI's ask
  | 'great-concession' // Moved >20% toward AI's ask
  | 'responded-to-ultimatum'; // AI issued ultimatum, player responded

// =============================================================================
// PROBABILISTIC PRICING
// =============================================================================

/**
 * Generate a deterministic but "secret" minimum margin for this negotiation
 * Uses negotiation ID as seed so it's consistent across evaluations
 * but unpredictable to the player
 */
function getSecretMinimumMargin(negotiationId: string): number {
  // Simple hash from negotiation ID
  let hash = 0;
  for (let i = 0; i < negotiationId.length; i++) {
    hash = ((hash << 5) - hash) + negotiationId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to 0-1 range
  const normalized = Math.abs(hash) / 2147483647;
  // Scale to margin range
  return MIN_MARGIN_FLOOR + normalized * (MIN_MARGIN_CEILING - MIN_MARGIN_FLOOR);
}

/**
 * Calculate manufacturer's cost for a contract
 */
function calculateManufacturerCost(
  manufacturer: Manufacturer,
  terms: ContractTerms
): number {
  const { costs } = manufacturer;
  const yearlyCost =
    costs.baseEngine * 2 +
    costs.upgrade * terms.upgradesIncluded +
    costs.customisationPoint * terms.customisationPointsIncluded +
    (terms.optimisationIncluded ? costs.optimisation : 0);

  return yearlyCost * terms.duration;
}

/**
 * Calculate the floor price (absolute minimum the manufacturer will accept)
 * Applies desperation and strategic value discounts to the secret margin
 */
function calculateFloorPrice(
  cost: number,
  secretMinMargin: number,
  desperation: number,
  strategicValue: number
): number {
  const desperationDiscount = desperation * MAX_DESPERATION_DISCOUNT;
  const strategicDiscount = strategicValue > STRATEGIC_VALUE_THRESHOLD ? STRATEGIC_VALUE_DISCOUNT : 0;
  const adjustedMinMargin = Math.max(1.0, secretMinMargin - desperationDiscount - strategicDiscount);
  return cost * adjustedMinMargin;
}

// =============================================================================
// MARKET FACTORS
// =============================================================================

/**
 * Calculate desperation (0-1) based on market share threat
 */
function calculateDesperation(
  manufacturerId: string,
  allTeams: Team[],
  securedTeamIds: string[],
  activeContracts: ActiveManufacturerContract[]
): number {
  // Find teams that currently have contracts with this manufacturer
  const currentCustomerIds = new Set(
    activeContracts
      .filter((c) => c.manufacturerId === manufacturerId)
      .map((c) => c.teamId)
  );
  const currentCustomers = currentCustomerIds.size;

  // Count secured customers (teams that have already renewed with this manufacturer)
  const securedCount = allTeams.filter(
    (team) =>
      securedTeamIds.includes(team.id) && currentCustomerIds.has(team.id)
  ).length;

  const unsignedCount = allTeams.filter((team) => !securedTeamIds.includes(team.id)).length;
  const teamsNeeded = currentCustomers - securedCount;

  if (teamsNeeded <= 0) return 0;
  if (unsignedCount <= teamsNeeded) {
    return Math.min(1, teamsNeeded / Math.max(1, unsignedCount));
  }
  return Math.max(0, (teamsNeeded / unsignedCount) * 0.5);
}

/**
 * Calculate strategic value (0-1) based on team competitiveness
 */
function calculateStrategicValue(team: Team, allTeams: Team[]): number {
  const budgets = allTeams.map((t) => t.budget);
  const maxBudget = Math.max(...budgets);
  const minBudget = Math.min(...budgets);
  const range = maxBudget - minBudget;
  if (range === 0) return 0.5;
  return (team.budget - minBudget) / range;
}

// =============================================================================
// PATTERN DETECTION
// =============================================================================

/**
 * Detect player's negotiation pattern from round history
 */
function detectNegotiationPattern(
  rounds: NegotiationRound<ContractTerms>[]
): NegotiationPattern {
  if (rounds.length === 1) return 'first-offer';

  // Get player offers (filter to player-made offers only)
  const playerOffers = rounds.filter((r) => r.offeredBy === 'player');
  if (playerOffers.length < 2) return 'first-offer';

  // Check if last AI response was an ultimatum
  const lastAiRound = rounds.filter((r) => r.offeredBy === 'counterparty').pop();
  if (lastAiRound?.isUltimatum) return 'responded-to-ultimatum';

  const lastOffer = playerOffers[playerOffers.length - 1].terms.annualCost;
  const prevOffer = playerOffers[playerOffers.length - 2].terms.annualCost;

  // Same offer = stubborn
  if (lastOffer === prevOffer) return 'stubborn';

  // Lowered offer = aggressive (insulting)
  if (lastOffer < prevOffer) return 'aggressive';

  // Calculate concession percentage
  // Get what AI asked for in their last counter
  const aiCounters = rounds.filter((r) => r.offeredBy === 'counterparty');
  if (aiCounters.length === 0) return 'cooperative';

  const lastAiAsk = aiCounters[aiCounters.length - 1].terms.annualCost;
  const gap = lastAiAsk - prevOffer;
  if (gap <= 0) return 'cooperative'; // Already above AI ask

  const movement = lastOffer - prevOffer;
  const concessionPct = movement / gap;

  if (concessionPct >= 0.20) return 'great-concession';
  if (concessionPct >= 0.10) return 'good-concession';
  return 'cooperative';
}

/**
 * Count how many times player has been stubborn (same offer)
 */
function countStubbornRounds(rounds: NegotiationRound<ContractTerms>[]): number {
  const playerOffers = rounds.filter((r) => r.offeredBy === 'player');
  let stubbornCount = 0;

  for (let i = 1; i < playerOffers.length; i++) {
    if (playerOffers[i].terms.annualCost === playerOffers[i - 1].terms.annualCost) {
      stubbornCount++;
    }
  }
  return stubbornCount;
}

// =============================================================================
// PRICE CALCULATIONS
// =============================================================================

/**
 * Calculate AI's target price for this round
 * Starts high (ideal) and moves toward floor over rounds
 */
function calculateTargetPrice(
  cost: number,
  secretMinMargin: number,
  roundNumber: number,
  desperation: number,
  strategicValue: number,
  pattern: NegotiationPattern
): number {
  // Calculate price points
  const idealPrice = cost * IDEAL_MARGIN;
  const comfortablePrice = cost * COMFORTABLE_MARGIN;
  const floorPrice = calculateFloorPrice(cost, secretMinMargin, desperation, strategicValue);

  // Calculate concession rate based on pattern
  let concessionMultiplier = 1.0;
  if (pattern === 'great-concession') concessionMultiplier = 1.5; // Move faster if player is cooperative
  if (pattern === 'good-concession') concessionMultiplier = 1.2;
  if (pattern === 'stubborn') concessionMultiplier = 0.5; // Move slower if player is stubborn
  if (pattern === 'aggressive') concessionMultiplier = 0.3; // Barely move if player is aggressive

  // Calculate how far to move from ideal toward floor
  // Round 1: Start at ideal
  // Each round: Move BASE_CONCESSION_RATE * concessionMultiplier toward floor
  const totalConcession = Math.min(
    1,
    (roundNumber - 1) * BASE_CONCESSION_RATE * concessionMultiplier
  );

  // Interpolate between ideal and floor
  const targetPrice = idealPrice - totalConcession * (idealPrice - floorPrice);

  // Never go below comfortable unless desperate or strategic
  if (desperation < DESPERATION_THRESHOLD && strategicValue < STRATEGIC_VALUE_THRESHOLD) {
    return Math.max(targetPrice, comfortablePrice);
  }

  return Math.max(targetPrice, floorPrice);
}

/**
 * Calculate acceptance threshold for this round
 * Player offer must be at or above this to be accepted
 */
function calculateAcceptanceThreshold(
  cost: number,
  secretMinMargin: number,
  roundNumber: number,
  desperation: number,
  strategicValue: number,
  pattern: NegotiationPattern
): number {
  const comfortablePrice = cost * COMFORTABLE_MARGIN;
  const floorPrice = calculateFloorPrice(cost, secretMinMargin, desperation, strategicValue);

  // Early rounds: Only accept above comfortable
  // Later rounds: Accept closer to floor
  // Great concession: More willing to accept
  const roundFactor = Math.min(1, (roundNumber - 1) / ROUND_FACTOR_DIVISOR); // 0 at round 1, 1 at round 5

  let threshold = comfortablePrice - roundFactor * (comfortablePrice - floorPrice);

  // If player made great concession, lower threshold
  if (pattern === 'great-concession') {
    threshold = Math.max(floorPrice, threshold * GREAT_CONCESSION_THRESHOLD_MULTIPLIER);
  }

  return Math.max(floorPrice, threshold);
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

function determineResponseTone(
  relationshipScore: number,
  pattern: NegotiationPattern
): ResponseTone {
  // Pattern affects tone more than relationship
  if (pattern === 'aggressive') return ResponseTone.Insulted;
  if (pattern === 'stubborn') return ResponseTone.Disappointed;

  if (pattern === 'great-concession') return ResponseTone.Enthusiastic;

  if (relationshipScore >= WARM_RELATIONSHIP_THRESHOLD) return ResponseTone.Enthusiastic;
  if (relationshipScore <= COLD_RELATIONSHIP_THRESHOLD) return ResponseTone.Disappointed;
  return ResponseTone.Professional;
}

function calculateResponseDelay(
  relationshipScore: number,
  strategicValue: number,
  isUltimatum: boolean
): number {
  // Ultimatums get faster response (urgent decision)
  if (isUltimatum) return MIN_RESPONSE_DELAY_DAYS;

  const relationshipReduction = Math.floor(relationshipScore / 50);
  const strategicReduction = Math.floor(strategicValue * 2);
  const delay = BASE_RESPONSE_DELAY_DAYS - relationshipReduction - strategicReduction;
  return Math.max(MIN_RESPONSE_DELAY_DAYS, Math.min(delay, MAX_RESPONSE_DELAY_DAYS));
}

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

export function evaluateManufacturerOffer(
  input: ManufacturerEvaluationInput
): NegotiationEvaluationResult {
  const {
    negotiation,
    manufacturer,
    team,
    allTeams,
    relationshipScore,
    securedTeamIds,
    activeContracts,
  } = input;

  const rounds = negotiation.rounds;
  const currentRound = rounds[rounds.length - 1];

  if (!currentRound) {
    return {
      responseType: ResponseType.Reject,
      counterTerms: null,
      responseTone: ResponseTone.Disappointed,
      responseDelayDays: BASE_RESPONSE_DELAY_DAYS,
      isNewsworthy: false,
      relationshipChange: REJECT_RELATIONSHIP_PENALTY,
    };
  }

  const terms = currentRound.terms;
  const offeredPrice = terms.annualCost * terms.duration;
  const roundNumber = currentRound.roundNumber;

  // Calculate factors
  const cost = calculateManufacturerCost(manufacturer, terms);
  const secretMinMargin = getSecretMinimumMargin(negotiation.id);
  const desperation = calculateDesperation(manufacturer.id, allTeams, securedTeamIds, activeContracts);
  const strategicValue = calculateStrategicValue(team, allTeams);
  const pattern = detectNegotiationPattern(rounds);
  const stubbornCount = countStubbornRounds(rounds);

  // Check if player responded to our ultimatum
  if (pattern === 'responded-to-ultimatum') {
    // We issued ultimatum, they must accept or reject only
    const floorPrice = calculateFloorPrice(cost, secretMinMargin, desperation, strategicValue);

    if (offeredPrice >= floorPrice) {
      return {
        responseType: ResponseType.Accept,
        counterTerms: null,
        responseTone: ResponseTone.Professional,
        responseDelayDays: MIN_RESPONSE_DELAY_DAYS,
        isNewsworthy: strategicValue > STRATEGIC_VALUE_THRESHOLD,
        relationshipChange: ACCEPT_RELATIONSHIP_BOOST,
      };
    } else {
      return {
        responseType: ResponseType.Reject,
        counterTerms: null,
        responseTone: ResponseTone.Disappointed,
        responseDelayDays: MIN_RESPONSE_DELAY_DAYS,
        isNewsworthy: false,
        relationshipChange: REJECT_RELATIONSHIP_PENALTY,
      };
    }
  }

  // Check if player issued ultimatum
  if (currentRound.isUltimatum) {
    const acceptThreshold = calculateAcceptanceThreshold(
      cost, secretMinMargin, roundNumber, desperation, strategicValue, pattern
    );

    if (offeredPrice >= acceptThreshold) {
      return {
        responseType: ResponseType.Accept,
        counterTerms: null,
        responseTone: determineResponseTone(relationshipScore, pattern),
        responseDelayDays: MIN_RESPONSE_DELAY_DAYS,
        isNewsworthy: strategicValue > STRATEGIC_VALUE_THRESHOLD,
        relationshipChange: ACCEPT_RELATIONSHIP_BOOST,
      };
    } else {
      // Player's ultimatum rejected - negotiation over
      return {
        responseType: ResponseType.Reject,
        counterTerms: null,
        responseTone: ResponseTone.Disappointed,
        responseDelayDays: MIN_RESPONSE_DELAY_DAYS,
        isNewsworthy: false,
        relationshipChange: REJECT_RELATIONSHIP_PENALTY,
      };
    }
  }

  // Calculate acceptance threshold
  const acceptThreshold = calculateAcceptanceThreshold(
    cost, secretMinMargin, roundNumber, desperation, strategicValue, pattern
  );

  // Check if we should accept
  if (offeredPrice >= acceptThreshold) {
    return {
      responseType: ResponseType.Accept,
      counterTerms: null,
      responseTone: determineResponseTone(relationshipScore, pattern),
      responseDelayDays: calculateResponseDelay(relationshipScore, strategicValue, false),
      isNewsworthy: strategicValue > STRATEGIC_VALUE_THRESHOLD,
      relationshipChange: ACCEPT_RELATIONSHIP_BOOST,
    };
  }

  // Determine if we should issue ultimatum
  const shouldUltimatum =
    pattern === 'aggressive' ||
    stubbornCount >= 2 ||
    roundNumber >= MAX_ROUNDS_BEFORE_ULTIMATUM;

  // Calculate counter-offer price
  const targetPrice = calculateTargetPrice(
    cost, secretMinMargin, roundNumber, desperation, strategicValue, pattern
  );

  const counterTerms: ContractTerms = {
    ...terms,
    annualCost: Math.ceil(targetPrice / terms.duration),
  };

  // Relationship penalty for ultimatum
  const relationshipChange = shouldUltimatum ? ULTIMATUM_RELATIONSHIP_PENALTY : 0;

  return {
    responseType: ResponseType.Counter,
    counterTerms,
    responseTone: determineResponseTone(relationshipScore, pattern),
    responseDelayDays: calculateResponseDelay(relationshipScore, strategicValue, shouldUltimatum),
    isNewsworthy: false,
    relationshipChange,
    isUltimatum: shouldUltimatum,
  };
}
