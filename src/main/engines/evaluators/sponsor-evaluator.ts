/**
 * Sponsor Evaluator
 *
 * Evaluates contract offers from the sponsor's perspective.
 * Sponsors assess team reputation, performance potential, and brand fit.
 *
 * Key mechanics:
 * - minReputation soft gate: Below threshold = demanding terms, not rejection
 * - rivalGroup hard rejection: Cannot have competing brands on same car
 * - Counter strategy: Reduce base payment, increase performance bonuses
 * - Exit clauses: Sponsors can demand early exit if team underperforms
 */

import type {
  Sponsor,
  Team,
  SponsorContractTerms,
  SponsorNegotiation,
  ActiveSponsorDeal,
} from '../../../shared/domain/types';
import type { NegotiationEvaluationResult } from '../../../shared/domain/engines';
import { ResponseType, ResponseTone, SponsorTier, SponsorPlacement } from '../../../shared/domain';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Base response delay in days */
const BASE_RESPONSE_DELAY_DAYS = 3;

/** Min/max response delay */
const MIN_RESPONSE_DELAY_DAYS = 1;
const MAX_RESPONSE_DELAY_DAYS = 5;

// -----------------------------------------------------------------------------
// Reputation Gates
// -----------------------------------------------------------------------------

/**
 * Soft gate threshold multiplier
 * Teams below minReputation * SOFT_GATE_MULTIPLIER get demanding counter-offers
 */
const SOFT_GATE_MULTIPLIER = 0.9; // 10% below minReputation = soft gate

/**
 * Hard gate threshold multiplier
 * Teams below minReputation * HARD_GATE_MULTIPLIER get rejected
 */
const HARD_GATE_MULTIPLIER = 0.7; // 30% below minReputation = hard rejection

/** Maximum exit clause position (sponsor can demand team finish above this) */
const MAX_EXIT_CLAUSE_POSITION = 10;

/** Base exit clause position for teams at soft gate threshold */
const BASE_EXIT_CLAUSE_POSITION = 5;

// -----------------------------------------------------------------------------
// Valuation Thresholds
// -----------------------------------------------------------------------------

/**
 * Premium multiplier for teams exceeding minReputation significantly
 * Top teams can negotiate higher than base payment
 */
const PREMIUM_REPUTATION_THRESHOLD = 1.2; // 20% above minReputation
const MAX_PREMIUM_MULTIPLIER = 1.25; // Up to 25% premium

/** Discount multiplier for teams near minReputation */
const DISCOUNT_MULTIPLIER_FLOOR = 0.7; // At most 30% discount from base

// -----------------------------------------------------------------------------
// Counter-Offer Strategy
// -----------------------------------------------------------------------------

/** Base reduction to annual payment when countering (shift to performance) */
const BASE_PAYMENT_REDUCTION = 0.15; // 15% reduction in base payment

/** Points bonus per championship point (scaled by tier) */
const TITLE_POINTS_BONUS_PER_POINT = 50_000; // $50k per point for title
const MAJOR_POINTS_BONUS_PER_POINT = 25_000; // $25k per point for major
const MINOR_POINTS_BONUS_PER_POINT = 10_000; // $10k per point for minor

/** Win bonus amounts by tier */
const TITLE_WIN_BONUS = 1_000_000; // $1M per win
const MAJOR_WIN_BONUS = 500_000; // $500k per win
const MINOR_WIN_BONUS = 200_000; // $200k per win

/** Maximum contract duration sponsors will accept */
const MAX_CONTRACT_DURATION = 3;

// -----------------------------------------------------------------------------
// Acceptance Thresholds
// -----------------------------------------------------------------------------

/** Ratio of offered payment to sponsor's willing payment for instant accept */
const INSTANT_ACCEPT_RATIO = 0.95; // Accept if offer >= 95% of willing amount

/** Ratio below which sponsor rejects outright (too cheap for them) */
const REJECT_RATIO = 0.6; // Reject if offer < 60% of willing amount

/** Maximum rounds before sponsor walks away */
const MAX_NEGOTIATION_ROUNDS = 4;

// -----------------------------------------------------------------------------
// Relationship Effects
// -----------------------------------------------------------------------------

const ACCEPT_RELATIONSHIP_BOOST = 5;
const REJECT_RELATIONSHIP_PENALTY = -3;

// =============================================================================
// TYPES
// =============================================================================

export interface SponsorEvaluationInput {
  negotiation: SponsorNegotiation;
  sponsor: Sponsor;
  team: Team;
  allTeams: Team[];
  /** All sponsors (for rivalGroup checking) */
  allSponsors: Sponsor[];
  /** Active sponsor deals for the team (to check rivalGroup conflicts) */
  existingSponsorDeals: ActiveSponsorDeal[];
  /** Relationship score (0-100) */
  relationshipScore: number;
  /** Constructor standings position (1-indexed) */
  teamPosition: number;
  /** Total teams in championship */
  totalTeams: number;
}

/** Internal representation of sponsor's valuation */
interface SponsorValuation {
  /** What sponsor is willing to pay this team (base adjusted for reputation) */
  willingPayment: number;
  /** How demanding is the sponsor (0-1, higher = more protective terms) */
  protectionLevel: number;
  /** Whether team is below soft gate (triggers protective counter) */
  isBelowSoftGate: boolean;
  /** Whether team is below hard gate (would be rejected) */
  isBelowHardGate: boolean;
}

// =============================================================================
// RIVAL GROUP CHECK
// =============================================================================

/**
 * Check if team already has a sponsor from the same rivalGroup.
 * This is a HARD rejection - cannot be negotiated.
 */
export function hasRivalGroupConflict(
  sponsorRivalGroup: string | null,
  existingSponsorDeals: ActiveSponsorDeal[],
  allSponsors: Sponsor[]
): boolean {
  if (!sponsorRivalGroup) return false; // No rival group = no conflict possible

  for (const deal of existingSponsorDeals) {
    const existingSponsor = allSponsors.find((s) => s.id === deal.sponsorId);
    if (existingSponsor?.rivalGroup === sponsorRivalGroup) {
      return true; // Conflict! Same rivalGroup
    }
  }
  return false;
}

// =============================================================================
// SPONSOR VALUATION
// =============================================================================

/**
 * Calculate what the sponsor is willing to pay this team
 * and how protective their terms will be.
 *
 * Uses standings position as a proxy for team reputation/exposure.
 */
export function calculateSponsorValuation(
  sponsor: Sponsor,
  teamPosition: number,
  totalTeams: number
): SponsorValuation {
  // Calculate team's effective reputation from standings position
  // Position 1 = 100%, Position last = ~10%
  const positionScore = 1 - (teamPosition - 1) / (totalTeams - 1 || 1);
  const effectiveReputation = positionScore * 100;

  // Compare to sponsor's minimum reputation requirement
  const reputationRatio = effectiveReputation / sponsor.minReputation;

  // Determine gate status
  const isBelowHardGate = reputationRatio < HARD_GATE_MULTIPLIER;
  const isBelowSoftGate = reputationRatio < SOFT_GATE_MULTIPLIER;

  // Calculate willing payment
  let willingPayment = sponsor.payment;

  if (reputationRatio >= PREMIUM_REPUTATION_THRESHOLD) {
    // Premium team - sponsor pays more for exposure
    const premiumFactor = Math.min(reputationRatio - 1, MAX_PREMIUM_MULTIPLIER - 1);
    willingPayment = sponsor.payment * (1 + premiumFactor);
  } else if (reputationRatio < 1.0) {
    // Below threshold - sponsor pays less
    const discountFactor = Math.max(reputationRatio, DISCOUNT_MULTIPLIER_FLOOR);
    willingPayment = sponsor.payment * discountFactor;
  }

  // Calculate protection level (0-1)
  // Higher = more protective terms (exit clause, shorter duration, more bonuses)
  let protectionLevel = 0;
  if (isBelowSoftGate) {
    // Scale from 0 at soft gate to 1 at hard gate
    protectionLevel = Math.min(
      1,
      (SOFT_GATE_MULTIPLIER - reputationRatio) / (SOFT_GATE_MULTIPLIER - HARD_GATE_MULTIPLIER)
    );
  }

  return {
    willingPayment: Math.round(willingPayment),
    protectionLevel,
    isBelowSoftGate,
    isBelowHardGate,
  };
}

// =============================================================================
// COUNTER-OFFER GENERATION
// =============================================================================

/**
 * Get performance bonus amounts based on sponsor tier.
 */
function getBonusesByTier(tier: SponsorTier): { pointsBonus: number; winBonus: number } {
  switch (tier) {
    case SponsorTier.Title:
      return { pointsBonus: TITLE_POINTS_BONUS_PER_POINT, winBonus: TITLE_WIN_BONUS };
    case SponsorTier.Major:
      return { pointsBonus: MAJOR_POINTS_BONUS_PER_POINT, winBonus: MAJOR_WIN_BONUS };
    case SponsorTier.Minor:
    default:
      return { pointsBonus: MINOR_POINTS_BONUS_PER_POINT, winBonus: MINOR_WIN_BONUS };
  }
}

/**
 * Generate counter-offer terms that shift risk to the team.
 * Strategy: Reduce base payment, increase performance bonuses.
 */
function generateCounterTerms(
  currentTerms: SponsorContractTerms,
  sponsor: Sponsor,
  valuation: SponsorValuation
): SponsorContractTerms {
  // Calculate base payment reduction
  // More protection = larger reduction
  const paymentReduction = BASE_PAYMENT_REDUCTION * (1 + valuation.protectionLevel);
  const reducedPayment = Math.round(valuation.willingPayment * (1 - paymentReduction));

  // Get performance bonuses based on tier
  const baseBonuses = getBonusesByTier(sponsor.tier);

  // Scale bonuses by protection level (more risk shift for borderline teams)
  const bonusMultiplier = 1 + valuation.protectionLevel * 0.5; // Up to 50% higher bonuses
  const pointsBonus = Math.round(baseBonuses.pointsBonus * bonusMultiplier);
  const winBonus = Math.round(baseBonuses.winBonus * bonusMultiplier);

  // Calculate exit clause if below soft gate
  let exitClausePosition: number | undefined;
  if (valuation.isBelowSoftGate) {
    // Exit clause position: scale from BASE to MAX based on protection level
    exitClausePosition = Math.round(
      BASE_EXIT_CLAUSE_POSITION +
        valuation.protectionLevel * (MAX_EXIT_CLAUSE_POSITION - BASE_EXIT_CLAUSE_POSITION)
    );
  }

  // Duration: sponsors prefer shorter deals for risky teams
  let duration = currentTerms.duration;
  if (valuation.protectionLevel > 0.5) {
    duration = Math.min(duration, 1); // Force 1-year deal for very risky teams
  } else if (valuation.protectionLevel > 0) {
    duration = Math.min(duration, 2); // Max 2-year for moderately risky
  }
  duration = Math.min(duration, MAX_CONTRACT_DURATION);

  return {
    annualPayment: reducedPayment,
    duration,
    placement: currentTerms.placement,
    pointsBonus,
    winBonus,
    exitClausePosition,
  };
}

// =============================================================================
// RESPONSE DELAY
// =============================================================================

/**
 * Calculate response delay based on relationship.
 * Better relationship = faster response.
 */
function calculateResponseDelay(relationshipScore: number): number {
  // Better relationship = faster response (0-2 days faster)
  const relationshipBonus = Math.floor(relationshipScore / 50);
  return Math.max(
    MIN_RESPONSE_DELAY_DAYS,
    Math.min(BASE_RESPONSE_DELAY_DAYS - relationshipBonus, MAX_RESPONSE_DELAY_DAYS)
  );
}

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

/**
 * Evaluate a sponsor contract offer from the sponsor's perspective.
 */
export function evaluateSponsorOffer(input: SponsorEvaluationInput): NegotiationEvaluationResult {
  const {
    negotiation,
    sponsor,
    allSponsors,
    existingSponsorDeals,
    relationshipScore,
    teamPosition,
    totalTeams,
  } = input;

  // Get the current round's terms
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

  const terms = currentRound.terms as SponsorContractTerms;
  const roundNumber = currentRound.roundNumber;

  // ==========================================================================
  // HARD REJECTION: rivalGroup conflict
  // ==========================================================================
  if (hasRivalGroupConflict(sponsor.rivalGroup, existingSponsorDeals, allSponsors)) {
    return {
      responseType: ResponseType.Reject,
      counterTerms: null,
      responseTone: ResponseTone.Professional,
      responseDelayDays: MIN_RESPONSE_DELAY_DAYS,
      isNewsworthy: false,
      relationshipChange: 0, // No relationship penalty for conflict
    };
  }

  // ==========================================================================
  // Calculate sponsor valuation
  // ==========================================================================
  const valuation = calculateSponsorValuation(sponsor, teamPosition, totalTeams);

  // Hard rejection if WAY below reputation threshold
  if (valuation.isBelowHardGate) {
    return {
      responseType: ResponseType.Reject,
      counterTerms: null,
      responseTone: ResponseTone.Professional,
      responseDelayDays: MIN_RESPONSE_DELAY_DAYS,
      isNewsworthy: false,
      relationshipChange: REJECT_RELATIONSHIP_PENALTY,
    };
  }

  // ==========================================================================
  // Evaluate the offered payment
  // ==========================================================================
  const offeredPayment = terms.annualPayment;
  const paymentRatio = offeredPayment / valuation.willingPayment;

  // ==========================================================================
  // Handle ultimatums
  // ==========================================================================
  if (currentRound.isUltimatum) {
    // Player issued ultimatum - accept or reject only
    if (paymentRatio >= REJECT_RATIO) {
      return {
        responseType: ResponseType.Accept,
        counterTerms: null,
        responseTone: ResponseTone.Professional,
        responseDelayDays: MIN_RESPONSE_DELAY_DAYS,
        isNewsworthy: sponsor.tier === SponsorTier.Title,
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

  // ==========================================================================
  // Decision logic
  // ==========================================================================

  // Accept if offer is good enough and team is above soft gate
  if (paymentRatio >= INSTANT_ACCEPT_RATIO && !valuation.isBelowSoftGate) {
    return {
      responseType: ResponseType.Accept,
      counterTerms: null,
      responseTone: paymentRatio >= 1.0 ? ResponseTone.Enthusiastic : ResponseTone.Professional,
      responseDelayDays: calculateResponseDelay(relationshipScore),
      isNewsworthy: sponsor.tier === SponsorTier.Title,
      relationshipChange: ACCEPT_RELATIONSHIP_BOOST,
    };
  }

  // Reject if offer is too low
  if (paymentRatio < REJECT_RATIO) {
    return {
      responseType: ResponseType.Reject,
      counterTerms: null,
      responseTone: ResponseTone.Disappointed,
      responseDelayDays: calculateResponseDelay(relationshipScore),
      isNewsworthy: false,
      relationshipChange: REJECT_RELATIONSHIP_PENALTY,
    };
  }

  // ==========================================================================
  // Counter-offer
  // ==========================================================================

  // Check if we should issue ultimatum
  const shouldUltimatum = roundNumber >= MAX_NEGOTIATION_ROUNDS;

  const counterTerms = generateCounterTerms(terms, sponsor, valuation);

  return {
    responseType: ResponseType.Counter,
    counterTerms,
    responseTone: valuation.isBelowSoftGate ? ResponseTone.Professional : ResponseTone.Enthusiastic,
    responseDelayDays: calculateResponseDelay(relationshipScore),
    isNewsworthy: false,
    relationshipChange: 0,
    isUltimatum: shouldUltimatum,
  };
}

// =============================================================================
// SPONSOR PLACEMENT HELPERS
// =============================================================================

/**
 * Get the appropriate placement level based on sponsor tier.
 */
export function getPlacementForTier(tier: SponsorTier): SponsorPlacement {
  switch (tier) {
    case SponsorTier.Title:
      return SponsorPlacement.Primary;
    case SponsorTier.Major:
      return SponsorPlacement.Secondary;
    case SponsorTier.Minor:
    default:
      return SponsorPlacement.Tertiary;
  }
}

/**
 * Get display name for sponsor tier.
 */
export function getSponsorTierDisplayName(tier: SponsorTier): string {
  switch (tier) {
    case SponsorTier.Title:
      return 'Title Sponsor';
    case SponsorTier.Major:
      return 'Major Sponsor';
    case SponsorTier.Minor:
      return 'Minor Sponsor';
    default:
      return 'Sponsor';
  }
}
