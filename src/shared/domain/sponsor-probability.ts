/**
 * Shared sponsor probability utilities.
 * Used by both the engine (main) and the renderer (UI live band).
 */

import { SponsorTier } from './types';

// =============================================================================
// THRESHOLD CONSTANTS (shared with sponsor-evaluator.ts)
// =============================================================================

export const INSTANT_ACCEPT_RATIO = 0.95;
export const REJECT_RATIO = 0.6;
export const SOFT_GATE_MULTIPLIER = 0.9;
export const HARD_GATE_MULTIPLIER = 0.7;

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
// PROBABILITY MODEL
// =============================================================================

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

const PROB_STEEPNESS = 25;

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
  if (isBelowHardGate) {
    return { accept: 0, counter: 0, reject: 1 };
  }

  let pAccept = sigmoid((paymentRatio - INSTANT_ACCEPT_RATIO) * PROB_STEEPNESS);
  const pReject = sigmoid((REJECT_RATIO - paymentRatio) * PROB_STEEPNESS);

  // Soft gate heavily dampens acceptance
  if (isBelowSoftGate) {
    pAccept *= 0.3;
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
  | 'Likely to reject';

/**
 * Map a probability distribution to a human-readable likelihood band.
 * The dominant outcome wins; if no outcome exceeds 50%, it's a Toss-up.
 */
export function getLikelihoodBand(probs: AcceptanceProbabilities): LikelihoodBand {
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
  const positionScore = 1 - (teamPosition - 1) / (totalTeams - 1 || 1);
  const effectiveReputation = positionScore * 100;
  const reputationRatio = effectiveReputation / (minReputation || 1);

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
