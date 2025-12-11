/**
 * Manufacturer Evaluator
 *
 * Evaluates engine contract offers from the manufacturer's perspective.
 * Implements the "black box" logic for how manufacturers respond to offers.
 *
 * Key factors:
 * - Factory team priority: Works teams always get accepted
 * - Customer limits: FIA limits manufacturers to 3 customer teams max
 * - Profitability: Won't offer deals that lose money
 */

import type {
  Team,
  Manufacturer,
  ManufacturerNegotiation,
  GameDate,
  ContractTerms,
} from '../../../shared/domain/types';
import type { NegotiationEvaluationResult } from '../../../shared/domain/engines';
import { ResponseType, ResponseTone } from '../../../shared/domain';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum customer teams per manufacturer (FIA regulation) */
const MAX_CUSTOMER_TEAMS = 3;

/** Base response delay in days */
const BASE_RESPONSE_DELAY_DAYS = 2;

/** Maximum response delay in days */
const MAX_RESPONSE_DELAY_DAYS = 5;

/** Minimum profit margin required (as a multiplier, e.g., 1.1 = 10% margin) */
const MIN_PROFIT_MARGIN = 1.05;

/** Relationship threshold for warm responses */
const WARM_RELATIONSHIP_THRESHOLD = 70;

/** Relationship threshold for cold responses */
const COLD_RELATIONSHIP_THRESHOLD = 30;

/** Relationship boost for accepting an offer */
const ACCEPT_RELATIONSHIP_BOOST = 5;

/** Relationship penalty for rejecting an offer */
const REJECT_RELATIONSHIP_PENALTY = -3;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input required to evaluate a manufacturer offer
 */
export interface ManufacturerEvaluationInput {
  /** The negotiation being evaluated */
  negotiation: ManufacturerNegotiation;
  /** The manufacturer being negotiated with */
  manufacturer: Manufacturer;
  /** The team making the offer */
  team: Team;
  /** All teams in the game (for customer count check) */
  allTeams: Team[];
  /** Current relationship score (0-100) */
  relationshipScore: number;
  /** Current game date */
  currentDate: GameDate;
}

/**
 * Internal calculation results for profitability
 */
interface ProfitabilityResult {
  /** Total cost to manufacturer over contract duration */
  totalCost: number;
  /** Total revenue from contract over duration */
  totalRevenue: number;
  /** Whether the deal is profitable */
  isProfitable: boolean;
  /** Profit margin as a percentage (revenue/cost) */
  profitMargin: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a team is the manufacturer's works team
 */
function isWorksTeam(manufacturer: Manufacturer, teamId: string): boolean {
  return manufacturer.worksTeamId === teamId;
}

/**
 * Check if a team is already a partner team
 */
function isPartnerTeam(manufacturer: Manufacturer, teamId: string): boolean {
  return manufacturer.partnerTeamIds.includes(teamId);
}

/**
 * Count current customer teams for a manufacturer
 * Excludes works team and partner teams from the count
 */
function countCustomerTeams(manufacturer: Manufacturer, allTeams: Team[]): number {
  return allTeams.filter((team) => {
    const contract = team.manufacturerContracts?.find(
      (c) => c.manufacturerId === manufacturer.id
    );
    if (!contract) return false;
    if (isWorksTeam(manufacturer, team.id)) return false;
    if (isPartnerTeam(manufacturer, team.id)) return false;
    return true;
  }).length;
}

/**
 * Check if manufacturer has capacity for another customer
 */
function hasCustomerCapacity(
  manufacturer: Manufacturer,
  allTeams: Team[],
  requestingTeamId: string
): boolean {
  const currentCount = countCustomerTeams(manufacturer, allTeams);
  // If team already has contract, they don't count toward new capacity
  const teamAlreadyCustomer = allTeams.some((team) => {
    if (team.id !== requestingTeamId) return false;
    const contract = team.manufacturerContracts?.find(
      (c) => c.manufacturerId === manufacturer.id
    );
    return contract && !isWorksTeam(manufacturer, team.id) && !isPartnerTeam(manufacturer, team.id);
  });

  const effectiveCount = teamAlreadyCustomer ? currentCount - 1 : currentCount;
  return effectiveCount < MAX_CUSTOMER_TEAMS;
}

/**
 * Calculate the manufacturer's cost for a contract
 */
function calculateManufacturerCost(
  manufacturer: Manufacturer,
  terms: ContractTerms
): number {
  const { costs } = manufacturer;
  const yearlyCost =
    costs.baseEngine * 2 + // Two engines per season (one per car)
    costs.upgrade * terms.upgradesIncluded +
    costs.customisationPoint * terms.customisationPointsIncluded +
    (terms.optimisationIncluded ? costs.optimisation : 0);

  return yearlyCost * terms.duration;
}

/**
 * Calculate profitability of a contract offer
 */
function calculateProfitability(
  manufacturer: Manufacturer,
  terms: ContractTerms
): ProfitabilityResult {
  const totalCost = calculateManufacturerCost(manufacturer, terms);
  const totalRevenue = terms.annualCost * terms.duration;
  const profitMargin = totalRevenue / totalCost;

  return {
    totalCost,
    totalRevenue,
    isProfitable: profitMargin >= MIN_PROFIT_MARGIN,
    profitMargin,
  };
}

/**
 * Generate counter-offer terms that meet profitability requirements
 * Adjusts annual cost to achieve minimum profit margin
 */
function generateCounterTerms(
  manufacturer: Manufacturer,
  originalTerms: ContractTerms
): ContractTerms {
  const totalCost = calculateManufacturerCost(manufacturer, originalTerms);
  const requiredRevenue = totalCost * MIN_PROFIT_MARGIN;
  const requiredAnnualCost = Math.ceil(requiredRevenue / originalTerms.duration);

  return {
    ...originalTerms,
    annualCost: requiredAnnualCost,
  };
}

/**
 * Determine response tone based on relationship score
 */
function determineResponseTone(relationshipScore: number): ResponseTone {
  if (relationshipScore >= WARM_RELATIONSHIP_THRESHOLD) {
    return ResponseTone.Warm;
  }
  if (relationshipScore <= COLD_RELATIONSHIP_THRESHOLD) {
    return ResponseTone.Cold;
  }
  return ResponseTone.Professional;
}

/**
 * Calculate response delay based on relationship and round number
 * Better relationships = faster responses
 * Later rounds = slightly faster (they're engaged)
 */
function calculateResponseDelay(
  relationshipScore: number,
  roundNumber: number
): number {
  // Base delay reduced by relationship
  const relationshipReduction = Math.floor(relationshipScore / 40); // 0-2 days reduction
  const roundReduction = Math.min(roundNumber - 1, 2); // Up to 2 days reduction for engaged negotiation

  const delay = BASE_RESPONSE_DELAY_DAYS - relationshipReduction - roundReduction;
  return Math.max(1, Math.min(delay, MAX_RESPONSE_DELAY_DAYS));
}

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

/**
 * Evaluate a manufacturer contract offer
 *
 * Logic flow:
 * 1. Works team? → Always accept
 * 2. Partner team? → Always accept (favorable terms)
 * 3. Over customer capacity? → Reject
 * 4. Unprofitable? → Counter with higher price
 * 5. Otherwise → Accept
 */
export function evaluateManufacturerOffer(
  input: ManufacturerEvaluationInput
): NegotiationEvaluationResult {
  const { negotiation, manufacturer, team, allTeams, relationshipScore } = input;

  // Get the most recent terms from the negotiation
  const currentRound = negotiation.rounds[negotiation.rounds.length - 1];
  if (!currentRound) {
    // No rounds yet - shouldn't happen, but handle gracefully
    return {
      responseType: ResponseType.Reject,
      counterTerms: null,
      responseTone: ResponseTone.Cold,
      responseDelayDays: BASE_RESPONSE_DELAY_DAYS,
      isNewsworthy: false,
      relationshipChange: REJECT_RELATIONSHIP_PENALTY,
    };
  }

  const terms = currentRound.terms;
  const roundNumber = currentRound.roundNumber;

  // 1. Works team always gets accepted
  if (isWorksTeam(manufacturer, team.id)) {
    return {
      responseType: ResponseType.Accept,
      counterTerms: null,
      responseTone: ResponseTone.Warm,
      responseDelayDays: 1,
      isNewsworthy: true, // Works deal is always newsworthy
      relationshipChange: ACCEPT_RELATIONSHIP_BOOST,
    };
  }

  // 2. Partner team always gets accepted
  if (isPartnerTeam(manufacturer, team.id)) {
    return {
      responseType: ResponseType.Accept,
      counterTerms: null,
      responseTone: ResponseTone.Warm,
      responseDelayDays: 1,
      isNewsworthy: true, // Partner deal is newsworthy
      relationshipChange: ACCEPT_RELATIONSHIP_BOOST,
    };
  }

  // 3. Check customer capacity
  if (!hasCustomerCapacity(manufacturer, allTeams, team.id)) {
    return {
      responseType: ResponseType.Reject,
      counterTerms: null,
      responseTone: determineResponseTone(relationshipScore),
      responseDelayDays: calculateResponseDelay(relationshipScore, roundNumber),
      isNewsworthy: false,
      relationshipChange: REJECT_RELATIONSHIP_PENALTY,
    };
  }

  // 4. Check profitability
  const profitability = calculateProfitability(manufacturer, terms);

  if (!profitability.isProfitable) {
    // Generate counter-offer with acceptable price
    const counterTerms = generateCounterTerms(manufacturer, terms);

    return {
      responseType: ResponseType.Counter,
      counterTerms,
      responseTone: determineResponseTone(relationshipScore),
      responseDelayDays: calculateResponseDelay(relationshipScore, roundNumber),
      isNewsworthy: false,
      relationshipChange: 0,
    };
  }

  // 5. Accept the offer
  return {
    responseType: ResponseType.Accept,
    counterTerms: null,
    responseTone: determineResponseTone(relationshipScore),
    responseDelayDays: calculateResponseDelay(relationshipScore, roundNumber),
    isNewsworthy: false, // Regular customer deals not newsworthy
    relationshipChange: ACCEPT_RELATIONSHIP_BOOST,
  };
}
