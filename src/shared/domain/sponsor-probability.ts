/**
 * Shared sponsor probability utilities.
 * Used by both the engine (main) and the renderer (UI live band).
 *
 * All probability + valuation math lives here so the renderer's live likelihood
 * band reflects the engine's actual decision — no parallel calculation.
 */

import { SponsorTier, SponsorPlacement, type Sponsor } from './types';

// =============================================================================
// THRESHOLD CONSTANTS (shared with sponsor-evaluator.ts)
// =============================================================================

export const INSTANT_ACCEPT_RATIO = 0.90;
export const REJECT_RATIO = 1.10;
export const SOFT_GATE_MULTIPLIER = 0.9;
export const HARD_GATE_MULTIPLIER = 0.7;

// =============================================================================
// VALUATION CONSTANTS (shared with sponsor-evaluator.ts)
// =============================================================================

/** Premium multiplier applies when team's reputation exceeds the threshold */
export const PREMIUM_REPUTATION_THRESHOLD = 1.2;
/** Cap on the premium uplift over base monthly payment */
export const MAX_PREMIUM_MULTIPLIER = 1.25;
/** Floor on the discount multiplier when reputation is below 1.0 */
export const DISCOUNT_MULTIPLIER_FLOOR = 0.7;

// =============================================================================
// PAYMENT RATIO CONSTANTS
// =============================================================================

/** Weight applied to signing bonus when computing total offered cost */
const BONUS_WEIGHT = 1.5;
/** Floor for effectiveReputation so P10 teams can reach some sponsors */
const EFFECTIVE_REP_FLOOR = 10;

// =============================================================================
// PROBABILITY-MODEL TUNING CONSTANTS
// =============================================================================

/** Sigmoid steepness around the accept/reject thresholds */
const PROB_STEEPNESS = 25;
/** When team is below soft gate, multiply pAccept by this dampener */
const SOFT_GATE_PACCEPT_DAMPING = 0.3;
/** When team is below hard gate ("Below requirements"), heavily damp pAccept — roughly 1–3% at reasonable terms */
const BELOW_GATE_PACCEPT_DAMPING = 0.03;

// =============================================================================
// TIER PAYMENT RANGES (hardcoded from sponsors.json data)
// =============================================================================

export const TIER_PAYMENT_RANGES: Record<SponsorTier, { low: number; high: number }> = {
  [SponsorTier.Title]: { low: 2_916_667, high: 5_000_000 },
  [SponsorTier.Major]: { low: 1_000_000, high: 2_083_333 },
  [SponsorTier.Minor]: { low: 166_667, high: 666_667 },
};

// =============================================================================
// SEEDED RNG
// =============================================================================

/** djb2 hash — produces a stable uint32 from any string */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG — returns a float in [0, 1) from a uint32 seed */
export function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// =============================================================================
// REPUTATION RATIO
// =============================================================================

/**
 * Compute reputationRatio = effectiveReputation / minReputation.
 * effectiveReputation is derived from constructor standings position.
 */
export function computeReputationRatio(
  teamPosition: number,
  totalTeams: number,
  minReputation: number
): number {
  const positionScore = 1 - (teamPosition - 1) / (totalTeams - 1 || 1);
  const effectiveReputation = Math.max(positionScore * 100, EFFECTIVE_REP_FLOOR);
  return effectiveReputation / (minReputation || 1);
}

// =============================================================================
// WILLING PAYMENT
// =============================================================================

/**
 * Compute the sponsor's willing monthly payment for a given team.
 * Premium uplift above PREMIUM_REPUTATION_THRESHOLD; discount below 1.0
 * (floored at DISCOUNT_MULTIPLIER_FLOOR). This is the divisor used for
 * paymentRatio in the probability model.
 */
export function calculateWillingPayment(
  sponsor: Sponsor,
  teamPosition: number,
  totalTeams: number
): number {
  const reputationRatio = computeReputationRatio(teamPosition, totalTeams, sponsor.minReputation);

  let willing = sponsor.baseMonthlyPayment;
  if (reputationRatio >= PREMIUM_REPUTATION_THRESHOLD) {
    const premiumFactor = Math.min(reputationRatio - 1, MAX_PREMIUM_MULTIPLIER - 1);
    willing = sponsor.baseMonthlyPayment * (1 + premiumFactor);
  } else if (reputationRatio < 1.0) {
    const discountFactor = Math.max(reputationRatio, DISCOUNT_MULTIPLIER_FLOOR);
    willing = sponsor.baseMonthlyPayment * discountFactor;
  }
  return Math.round(willing);
}

// =============================================================================
// PAYMENT RATIO
// =============================================================================

/**
 * Compute paymentRatio = offeredCost / willingCost.
 * Signing bonus is weighted to reflect its upfront cash-flow burden.
 */
export function computePaymentRatio(
  monthlyPayment: number,
  durationMonths: number,
  signingBonus: number,
  willingMonthly: number
): number {
  const offeredCost = monthlyPayment * durationMonths + signingBonus * BONUS_WEIGHT;
  const willingCost = willingMonthly * durationMonths;
  return offeredCost / (willingCost || 1);
}

// =============================================================================
// PROBABILITY MODEL
// =============================================================================

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export interface AcceptanceProbabilities {
  accept: number;
  counter: number;
  reject: number;
}

/**
 * Compute the probability distribution over Accept / Counter / Reject outcomes
 * for a given offer state. Pure function — no side effects.
 *
 * @param paymentRatio  offeredPayment / willingPayment
 * @param isBelowHardGate  reputationRatio < HARD_GATE_MULTIPLIER
 * @param isBelowSoftGate  reputationRatio < SOFT_GATE_MULTIPLIER
 */
export function computeAcceptanceProbabilities(
  paymentRatio: number,
  isBelowHardGate: boolean,
  isBelowSoftGate: boolean
): AcceptanceProbabilities {
  let pAccept = sigmoid((INSTANT_ACCEPT_RATIO - paymentRatio) * PROB_STEEPNESS);
  const pReject = sigmoid((paymentRatio - REJECT_RATIO) * PROB_STEEPNESS);

  if (isBelowHardGate) {
    pAccept *= BELOW_GATE_PACCEPT_DAMPING;
  } else if (isBelowSoftGate) {
    pAccept *= SOFT_GATE_PACCEPT_DAMPING;
  }

  const pCounter = Math.max(0, 1 - pAccept - pReject);
  return { accept: pAccept, counter: pCounter, reject: pReject };
}

// =============================================================================
// LIKELIHOOD BAND
// =============================================================================

export type LikelihoodBand =
  | 'Likely to accept'
  | 'Likely to counter'
  | 'Toss-up'
  | 'Likely to reject'
  | 'Below requirements';

/**
 * Map a probability distribution to a human-readable likelihood band.
 * The dominant outcome wins; if no outcome exceeds 50%, it's a Toss-up.
 * Pass isBelowHardGate=true to short-circuit to the "Below requirements" label.
 */
export function getLikelihoodBand(probs: AcceptanceProbabilities, isBelowHardGate = false): LikelihoodBand {
  if (isBelowHardGate) return 'Below requirements';
  const { accept, counter, reject } = probs;
  if (accept > 0.5) return 'Likely to accept';
  if (reject > 0.5) return 'Likely to reject';
  if (counter > 0.5) return 'Likely to counter';
  return 'Toss-up';
}

// =============================================================================
// REPUTATION STANDING
// =============================================================================

export type ReputationStanding = 'Strong match' | 'Borderline' | 'Below requirements';

/**
 * Compute the player's reputation standing relative to a sponsor's requirements.
 *
 * @param teamPosition  1-indexed constructor standings position
 * @param totalTeams    number of teams in the championship
 * @param minReputation sponsor.minReputation (0–100)
 */
export function getReputationStanding(
  teamPosition: number,
  totalTeams: number,
  minReputation: number
): ReputationStanding {
  const reputationRatio = computeReputationRatio(teamPosition, totalTeams, minReputation);
  if (reputationRatio < HARD_GATE_MULTIPLIER) return 'Below requirements';
  if (reputationRatio < SOFT_GATE_MULTIPLIER) return 'Borderline';
  return 'Strong match';
}

/**
 * Compute the minimum constructor championship position required for a sponsor.
 * Returns the ceiling of the computed position bound.
 */
export function getRequiredPosition(totalTeams: number, minReputation: number): number {
  // Solve: positionScore = minReputation / 100
  // positionScore = 1 - (position - 1) / (totalTeams - 1)
  // position = 1 + (totalTeams - 1) * (1 - minReputation / 100)
  return Math.ceil(1 + (totalTeams - 1) * (1 - minReputation / 100));
}

// =============================================================================
// PLACEMENT MAPPING
// =============================================================================

/** Map sponsor tier to its corresponding placement level on the car. */
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
