/**
 * Staff Evaluator
 *
 * Evaluates contract offers from the chief's perspective.
 * Uses ability-based market value with deterministic scouting error.
 *
 * Key mechanics:
 * - Letter grade scouting: Player sees A+ to F- grades with ±15% seeded error
 * - Market salary: Ability-based curve ($300k floor, $15M ceiling)
 * - Per-chief greediness: Seeded variance on expected salary
 * - Career progression: Mid-ability staff accept less for prestigious teams
 * - Simplified buyouts: Auto-paid, no negotiation with current employer
 */

import type { Chief, Team, StaffContractTerms } from '../../../shared/domain/types';
import type { NegotiationEvaluationResult } from '../../../shared/domain/engines';
import { ResponseType, ResponseTone, ChiefRole } from '../../../shared/domain';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Market salary calculation - ability to salary mapping */
const MARKET_SALARY_FLOOR = 300_000; // Ability 0 baseline
const MARKET_SALARY_CEILING = 15_000_000; // Ability 100 baseline (top chiefs)
const MARKET_SALARY_EXPONENT = 2.5; // Exponential curve factor

/** Greediness variance - chiefs with same ability may want different salaries */
const GREEDINESS_VARIANCE = 0.15; // +/- 15% from calculated market salary

/** Scouting error range for perceived ability */
const SCOUTING_ERROR_RANGE = 0.15; // +/- 15% error on perceived ability

/** Evaluation thresholds */
const INSTANT_ACCEPT_RATIO = 1.4; // 40% above expectations = instant yes
const ACCEPT_RATIO = 1.0; // At or above expectations = accept
const COUNTER_RATIO = 0.7; // 70-100% = willing to counter
// Note: Staff reject offers below COUNTER_RATIO threshold

/** Signing bonus thresholds */
const GOOD_SIGNING_BONUS_RATIO = 0.15; // 15% of salary = good bonus

/** Base response delay in days */
const BASE_RESPONSE_DELAY_DAYS = 3;

/** Relationship effects */
const ACCEPT_RELATIONSHIP_BOOST = 5;
const REJECT_RELATIONSHIP_PENALTY = -3;

/** Preferred contract duration (staff prefer 2-3 years for stability) */
const PREFERRED_MAX_DURATION = 3;

/** Long contract penalty (reduces effective ratio if contract too long) */
const LONG_CONTRACT_PENALTY = 0.05;

/** Career progression - mid-ability staff may take less at top teams */
const MID_ABILITY_LOW = 50;
const MID_ABILITY_HIGH = 85;
const MAX_CAREER_DISCOUNT = 0.2; // Up to 20% salary discount for prestige

/** Team prestige threshold for staff to consider approaching */
const APPROACH_PRESTIGE_THRESHOLD = 0.3;

/** Prestige improvement needed for staff to want to switch teams */
const PRESTIGE_UPGRADE_THRESHOLD = 0.2;

/** Ability gap for staff to consider target team's slot */
const ABILITY_UPGRADE_THRESHOLD = 5;

// =============================================================================
// LETTER GRADE SCOUTING SYSTEM
// =============================================================================

/** Letter grades from highest to lowest */
const LETTER_GRADES = [
  'A+',
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D+',
  'D',
  'D-',
  'F+',
  'F',
  'F-',
] as const;

export type LetterGrade = (typeof LETTER_GRADES)[number];

/**
 * Generate a deterministic hash from two strings.
 * Same inputs always produce the same output (0 to 1).
 */
function hashSeed(part1: string, part2: string): number {
  const str = `${part1}-${part2}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash % 10000) / 10000; // 0 to 1
}

/**
 * Calculate perceived ability with seeded error.
 * Same player always sees same error for same chief.
 *
 * @param trueAbility - Actual 0-100 ability
 * @param playerName - Player's name (seed)
 * @param chiefId - Chief's ID (seed)
 * @returns Perceived ability (0-100, clamped)
 */
export function calculatePerceivedAbility(
  trueAbility: number,
  playerName: string,
  chiefId: string
): number {
  const seed = hashSeed(playerName, chiefId);
  // Convert 0-1 to -1 to +1, then scale by error range
  const error = (seed * 2 - 1) * SCOUTING_ERROR_RANGE * 100;
  return Math.max(0, Math.min(100, trueAbility + error));
}

/**
 * Convert ability (0-100) to letter grade.
 * A+ = 97-100, A = 93-96, A- = 90-92, etc.
 * Each grade spans ~6.67 points (100 points / 15 grades)
 */
export function abilityToLetterGrade(ability: number): LetterGrade {
  // Invert: higher ability = lower index (A+ is index 0)
  const gradeIndex = Math.floor((100 - ability) / 6.67);
  const clampedIndex = Math.max(0, Math.min(LETTER_GRADES.length - 1, gradeIndex));
  return LETTER_GRADES[clampedIndex];
}

/**
 * Get perceived letter grade for a chief (with scouting error).
 * This is what the player sees in the UI.
 */
export function getChiefLetterGrade(chief: Chief, playerName: string): LetterGrade {
  const perceivedAbility = calculatePerceivedAbility(chief.ability, playerName, chief.id);
  return abilityToLetterGrade(perceivedAbility);
}

/**
 * Get all letter grades in order (for UI display)
 */
export function getAllLetterGrades(): readonly LetterGrade[] {
  return LETTER_GRADES;
}

// =============================================================================
// MARKET SALARY CALCULATION
// =============================================================================

/**
 * Calculate base market salary from ability.
 * Uses exponential curve: ability 50 = ~$2M, ability 100 = ~$15M
 *
 * Formula: FLOOR + (ability/100)^EXPONENT × (CEILING - FLOOR)
 */
function calculateBaseMarketSalary(ability: number): number {
  const normalizedAbility = ability / 100;
  const factor = Math.pow(normalizedAbility, MARKET_SALARY_EXPONENT);
  return Math.round(MARKET_SALARY_FLOOR + factor * (MARKET_SALARY_CEILING - MARKET_SALARY_FLOOR));
}

/**
 * Calculate expected salary for a specific chief.
 * Includes per-chief "greediness" variance seeded by chief ID.
 */
export function calculateExpectedSalary(chief: Chief): number {
  const baseSalary = calculateBaseMarketSalary(chief.ability);

  // Apply per-chief greediness variance (deterministic from ID)
  const greedSeed = hashSeed('greed', chief.id);
  const greedFactor = 1 + (greedSeed * 2 - 1) * GREEDINESS_VARIANCE;

  return Math.round(baseSalary * greedFactor);
}

// =============================================================================
// TEAM PRESTIGE CALCULATION
// =============================================================================

/**
 * Calculate team prestige/attractiveness for staff.
 * Based on budget ranking (proxy for success/resources).
 * Returns 0-1 where 1 = most prestigious.
 */
export function calculateTeamPrestige(team: Team, allTeams: Team[]): number {
  const budgets = allTeams.map((t) => t.budget);
  const maxBudget = Math.max(...budgets);
  const minBudget = Math.min(...budgets);
  const range = maxBudget - minBudget;

  if (range === 0) return 0.5;
  return (team.budget - minBudget) / range;
}

/**
 * Calculate career progression discount.
 * Mid-ability staff may accept less to join a top team.
 *
 * Returns a multiplier (0.8-1.0):
 * - High ability (85+) staff don't need the boost = 1.0
 * - Mid ability (50-85) staff want career progression = 0.8-1.0
 * - Low ability (<50) staff are grateful for any job = 1.0
 */
function calculateCareerProgressionMultiplier(ability: number, teamPrestige: number): number {
  // Only mid-ability staff care about career progression
  if (ability < MID_ABILITY_LOW || ability > MID_ABILITY_HIGH) return 1.0;

  // The better the team, the more discount they'll accept
  // ability 50-85 maps to max discount at ability 50, no discount at ability 85
  const abilityFactor = (ability - MID_ABILITY_LOW) / (MID_ABILITY_HIGH - MID_ABILITY_LOW);
  const maxDiscount = MAX_CAREER_DISCOUNT * (1 - abilityFactor); // More discount for lower ability

  return 1.0 - maxDiscount * teamPrestige;
}

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

export interface StaffEvaluationInput {
  chief: Chief;
  offeringTeam: Team;
  offeredSalary: number;
  offeredDuration: number;
  offeredSigningBonus: number;
  offeredBonusPercent: number;
  buyoutRequired: number; // Automatically paid if poaching (not negotiated)
  allTeams: Team[];
  currentRound: number;
  maxRounds: number;
}

/**
 * Evaluate a staff contract offer from the chief's perspective.
 */
export function evaluateStaffOffer(input: StaffEvaluationInput): NegotiationEvaluationResult {
  const {
    chief,
    offeringTeam,
    offeredSalary,
    offeredDuration,
    offeredSigningBonus,
    offeredBonusPercent,
    buyoutRequired,
    allTeams,
    currentRound,
    maxRounds,
  } = input;

  // Calculate expected salary
  const expectedSalary = calculateExpectedSalary(chief);

  // Calculate team prestige
  const teamPrestige = calculateTeamPrestige(offeringTeam, allTeams);

  // Apply career progression discount
  const careerMultiplier = calculateCareerProgressionMultiplier(chief.ability, teamPrestige);
  const adjustedExpectedSalary = Math.round(expectedSalary * careerMultiplier);

  // Calculate salary ratio
  const salaryRatio = offeredSalary / adjustedExpectedSalary;

  // Evaluate signing bonus as additional value (amortized over duration)
  const bonusValue = offeredSigningBonus / offeredDuration;
  const effectiveSalary = offeredSalary + bonusValue * 0.5; // Bonus worth half of equivalent salary
  const effectiveRatio = effectiveSalary / adjustedExpectedSalary;

  // Check contract duration preference - penalty for very long contracts
  const durationPenalty = offeredDuration > PREFERRED_MAX_DURATION ? LONG_CONTRACT_PENALTY : 0;
  const finalRatio = effectiveRatio - durationPenalty;

  // Late round check for ultimatum
  const isLateRound = currentRound >= maxRounds - 1;

  // Decision logic
  let responseType: ResponseType;
  let counterSalary: number | null = null;
  let counterSigningBonus: number | null = null;
  let isUltimatum = false;

  if (finalRatio >= INSTANT_ACCEPT_RATIO) {
    // Amazing offer - instant accept
    responseType = ResponseType.Accept;
  } else if (finalRatio >= ACCEPT_RATIO) {
    // Good offer - accept
    responseType = ResponseType.Accept;
  } else if (finalRatio >= COUNTER_RATIO) {
    // Below expectations but negotiable - counter
    responseType = ResponseType.Counter;

    // If salary is close (90%+), ask for better signing bonus instead
    if (salaryRatio > 0.9) {
      counterSalary = offeredSalary;
      counterSigningBonus = Math.round(expectedSalary * GOOD_SIGNING_BONUS_RATIO);
    } else {
      counterSalary = adjustedExpectedSalary;
      counterSigningBonus = offeredSigningBonus;
    }

    // Late round = ultimatum
    if (isLateRound) {
      isUltimatum = true;
    }
  } else {
    // Offer too low - reject
    responseType = ResponseType.Reject;
  }

  // Determine tone based on ratio
  let responseTone: ResponseTone;
  if (finalRatio >= ACCEPT_RATIO) {
    responseTone = ResponseTone.Enthusiastic;
  } else if (finalRatio >= COUNTER_RATIO) {
    responseTone = ResponseTone.Professional;
  } else {
    responseTone = ResponseTone.Disappointed;
  }

  // Build counter terms if countering
  const counterTerms: StaffContractTerms | null = counterSalary
    ? {
        salary: counterSalary,
        duration: offeredDuration,
        signingBonus: counterSigningBonus ?? offeredSigningBonus,
        buyoutRequired: buyoutRequired,
        bonusPercent: offeredBonusPercent,
      }
    : null;

  return {
    responseType,
    counterTerms,
    responseTone,
    responseDelayDays: BASE_RESPONSE_DELAY_DAYS,
    isNewsworthy: responseType === ResponseType.Accept && chief.ability >= 85,
    relationshipChange:
      responseType === ResponseType.Accept
        ? ACCEPT_RELATIONSHIP_BOOST
        : responseType === ResponseType.Reject
          ? REJECT_RELATIONSHIP_PENALTY
          : 0,
    isUltimatum,
  };
}

// =============================================================================
// PROACTIVE OUTREACH (Staff Approaching Teams)
// =============================================================================

export interface StaffApproachInput {
  approachingChief: Chief;
  targetTeam: Team;
  allTeams: Team[];
  allChiefs: Chief[];
}

export interface StaffApproachResult {
  shouldApproach: boolean;
  reason: 'free_agent' | 'seeking_upgrade' | 'not_interested';
  proposedSalary: number;
  proposedDuration: number;
}

/**
 * Determine if a staff member should approach a team.
 *
 * Staff approach teams when:
 * 1. They're a free agent looking for work
 * 2. They're at a smaller team and want to join a bigger one
 *    (but only if target team's chief is weaker or vacant)
 */
export function evaluateStaffApproach(input: StaffApproachInput): StaffApproachResult {
  const { approachingChief, targetTeam, allTeams, allChiefs } = input;

  const targetPrestige = calculateTeamPrestige(targetTeam, allTeams);
  const expectedSalary = calculateExpectedSalary(approachingChief);

  // Check if target team already has a chief of this role
  const existingChief = allChiefs.find(
    (c) => c.teamId === targetTeam.id && c.role === approachingChief.role
  );

  // Free agents approach mid-tier and above teams
  if (!approachingChief.teamId) {
    // Only approach if no existing chief or weaker existing chief
    if (!existingChief || existingChief.ability < approachingChief.ability - ABILITY_UPGRADE_THRESHOLD) {
      return {
        shouldApproach: targetPrestige > APPROACH_PRESTIGE_THRESHOLD,
        reason: 'free_agent',
        proposedSalary: expectedSalary,
        proposedDuration: 2,
      };
    }
    return {
      shouldApproach: false,
      reason: 'not_interested',
      proposedSalary: 0,
      proposedDuration: 0,
    };
  }

  // Staff at teams want to upgrade
  const currentTeam = allTeams.find((t) => t.id === approachingChief.teamId);
  if (currentTeam) {
    const currentPrestige = calculateTeamPrestige(currentTeam, allTeams);

    // Only approach significantly better teams (20%+ prestige improvement)
    if (targetPrestige > currentPrestige + PRESTIGE_UPGRADE_THRESHOLD) {
      // But only if target team's chief is weaker or vacant
      if (!existingChief || existingChief.ability < approachingChief.ability - ABILITY_UPGRADE_THRESHOLD) {
        return {
          shouldApproach: true,
          reason: 'seeking_upgrade',
          proposedSalary: expectedSalary,
          proposedDuration: 2,
        };
      }
    }
  }

  return {
    shouldApproach: false,
    reason: 'not_interested',
    proposedSalary: 0,
    proposedDuration: 0,
  };
}

/**
 * Get the role display name for a chief role.
 */
export function getChiefRoleDisplayName(role: ChiefRole): string {
  switch (role) {
    case ChiefRole.Designer:
      return 'Chief Designer';
    case ChiefRole.Mechanic:
      return 'Chief Mechanic';
    case ChiefRole.Commercial:
      return 'Chief Commercial';
    default:
      return 'Chief';
  }
}
