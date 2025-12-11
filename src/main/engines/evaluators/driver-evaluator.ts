/**
 * Driver Evaluator
 *
 * Evaluates contract offers from the driver's perspective.
 * Uses perceived market value based on historical performance ratio
 * (driver points / team points) with exponential decay weighting.
 *
 * Key mechanics:
 * - Perceived value: weighted average of contribution ratios over past 5 years
 * - Market value: percentile-based salary ($2M floor, $20M ceiling)
 * - Salary ratio: offered salary vs required salary (adjusted for team quality)
 * - Decision based on ratio + available alternatives
 */

import type { Driver, Team, CareerSeasonRecord } from '../../../shared/domain/types';
import type { NegotiationEvaluationResult } from '../../../shared/domain/engines';
import { ResponseType, ResponseTone } from '../../../shared/domain';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Decay factor for weighting recent seasons (0.8 = 20% decay per year) */
const DECAY_FACTOR = 0.8;

/** Maximum seasons to consider for perceived value */
const MAX_HISTORY_YEARS = 5;

/** Market value floor (0th percentile driver) */
const MARKET_VALUE_FLOOR = 2_000_000;

/** Market value ceiling (100th percentile driver) */
const MARKET_VALUE_CEILING = 20_000_000;

/** Salary ratio threshold for instant accept (insanely good deal) */
const INSTANT_ACCEPT_RATIO = 2.0;

/** Salary ratio threshold for normal accept */
const ACCEPT_RATIO = 1.0;

/** Salary ratio threshold for counter (below this = not interested unless desperate) */
const COUNTER_RATIO = 0.5;

/** Salary ratio threshold for desperate accept (few seats left) */
const DESPERATE_ACCEPT_RATIO = 0.2;

/** Number of available seats that triggers desperation */
const DESPERATION_SEAT_THRESHOLD = 2;

/** Base response delay in days */
const BASE_RESPONSE_DELAY_DAYS = 3;

/** Max multiplier for joining a much worse team (elite driver → backmarker) */
const MAX_TEAM_QUALITY_MULTIPLIER = 5.0;

/** Min multiplier for joining a much better team (weak driver → top team) */
const MIN_TEAM_QUALITY_MULTIPLIER = 0.2;

/** Career stage age thresholds */
const YOUNG_AGE_THRESHOLD = 25;
const VETERAN_AGE_THRESHOLD = 33;

/** Relationship boost for accepting */
const ACCEPT_RELATIONSHIP_BOOST = 5;

/** Relationship penalty for rejecting */
const REJECT_RELATIONSHIP_PENALTY = -3;

/** Threshold of available seats above which driver will counter even good offers */
const MANY_SEATS_THRESHOLD = 5;

/** Multiplier for asking more than required salary when countering a good offer */
const COUNTER_ASK_MULTIPLIER = 1.1;

// =============================================================================
// PERCEIVED VALUE CALCULATION
// =============================================================================

/**
 * Calculate perceived value from career history using exponential decay.
 * Returns a value from 0 to 1 representing the driver's contribution ratio.
 *
 * Formula: Σ(ratio_i × 0.8^i) / Σ(0.8^i) where i=0 is most recent
 */
export function calculatePerceivedValue(careerHistory: CareerSeasonRecord[] | undefined): number {
  if (!careerHistory || careerHistory.length === 0) {
    // No history = average perceived value (0.5)
    return 0.5;
  }

  // Sort by season descending (most recent first)
  const sorted = [...careerHistory].sort((a, b) => b.season - a.season);
  const limited = sorted.slice(0, MAX_HISTORY_YEARS);

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < limited.length; i++) {
    const record = limited[i];
    const weight = Math.pow(DECAY_FACTOR, i);

    // Calculate contribution ratio (driver points / team points)
    // If team got 0 points, use 0.5 as neutral (driver couldn't do better/worse)
    const ratio = record.teamTotalPoints > 0 ? record.totalPoints / record.teamTotalPoints : 0.5;

    weightedSum += ratio * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Calculate market value from perceived value using percentile ranking.
 * All drivers in the grid are compared; salary is linear interpolation.
 */
export function calculateMarketValue(
  driver: Driver,
  allDrivers: Driver[]
): number {
  // Calculate perceived values for all drivers
  const perceivedValues = allDrivers.map((d) => ({
    id: d.id,
    value: calculatePerceivedValue(d.careerHistory),
  }));

  // Sort by value ascending to get percentiles
  perceivedValues.sort((a, b) => a.value - b.value);

  // Find this driver's rank
  const rank = perceivedValues.findIndex((p) => p.id === driver.id);
  if (rank === -1) {
    // Driver not in list, use their perceived value directly
    const percentile = calculatePerceivedValue(driver.careerHistory);
    return MARKET_VALUE_FLOOR + percentile * (MARKET_VALUE_CEILING - MARKET_VALUE_FLOOR);
  }

  // Calculate percentile (0 to 1)
  const percentile = allDrivers.length > 1 ? rank / (allDrivers.length - 1) : 0.5;

  // Linear interpolation between floor and ceiling
  return Math.round(MARKET_VALUE_FLOOR + percentile * (MARKET_VALUE_CEILING - MARKET_VALUE_FLOOR));
}

// =============================================================================
// TEAM QUALITY ADJUSTMENT
// =============================================================================

/**
 * Calculate team quality score (0 to 1) based on constructor standings.
 * 1.0 = championship leader, 0.0 = last place
 */
function calculateTeamQuality(team: Team, allTeams: Team[], standings: Map<string, number>): number {
  const position = standings.get(team.id) ?? allTeams.length;
  const totalTeams = allTeams.length;

  // Invert position to quality (1st place = 1.0, last = 0.0)
  return totalTeams > 1 ? (totalTeams - position) / (totalTeams - 1) : 0.5;
}

/**
 * Calculate driver ability score (0 to 1) from attributes.
 * Simple average of all attribute values normalized to 0-1.
 */
function calculateDriverAbility(driver: Driver): number {
  const attrs = driver.attributes;
  const sum =
    attrs.pace +
    attrs.consistency +
    attrs.focus +
    attrs.overtaking +
    attrs.wetWeather +
    attrs.smoothness +
    attrs.defending;
  // Each attribute is 0-100, 7 attributes, so max is 700
  return sum / 700;
}

/**
 * Calculate the required salary multiplier based on driver ability vs team quality.
 *
 * - Elite driver → bad team: requires up to 5x market value
 * - Weak driver → great team: accepts down to 0.2x market value
 */
function calculateTeamQualityMultiplier(
  driverAbility: number,
  teamQuality: number,
  careerWeight: number
): number {
  // Gap between driver ability and team quality (-1 to +1)
  // Positive = driver is better than team deserves
  // Negative = team is better than driver deserves
  const gap = driverAbility - teamQuality;

  // Career weight shifts the multiplier curve
  // Veterans (high careerWeight) demand less premium for worse teams
  // Young drivers (low careerWeight) are more flexible
  const adjustedGap = gap * (1 - careerWeight * 0.5); // Reduce gap effect for veterans

  if (adjustedGap > 0) {
    // Driver is "too good" for team - demand premium
    // Max premium at gap = 1.0 (elite driver, terrible team)
    const premiumFactor = adjustedGap; // 0 to 1
    return 1 + premiumFactor * (MAX_TEAM_QUALITY_MULTIPLIER - 1);
  } else {
    // Team is "too good" for driver - accept discount
    // Max discount at gap = -1.0 (terrible driver, elite team)
    const discountFactor = -adjustedGap; // 0 to 1
    return 1 - discountFactor * (1 - MIN_TEAM_QUALITY_MULTIPLIER);
  }
}

/**
 * Calculate career weight based on driver age.
 * Higher weight = more focused on money than performance.
 */
function calculateCareerWeight(driver: Driver): number {
  const birthYear = new Date(driver.dateOfBirth).getFullYear();
  const currentYear = new Date().getFullYear(); // TODO: Use game year
  const age = currentYear - birthYear;

  if (age < YOUNG_AGE_THRESHOLD) {
    return 0.3; // Young: 70% performance focus
  } else if (age >= VETERAN_AGE_THRESHOLD) {
    return 0.7; // Veteran: 70% money focus
  } else {
    // Prime: linear interpolation
    const t = (age - YOUNG_AGE_THRESHOLD) / (VETERAN_AGE_THRESHOLD - YOUNG_AGE_THRESHOLD);
    return 0.3 + t * 0.4; // 0.3 to 0.7
  }
}

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

export interface DriverEvaluationInput {
  driver: Driver;
  offeringTeam: Team;
  offeredSalary: number;
  offeredDuration: number;
  allDrivers: Driver[];
  allTeams: Team[];
  constructorStandings: Map<string, number>; // teamId → position (1-indexed)
  availableSeats: number; // How many open seats remain on grid
  currentRound: number;
  maxRounds: number;
}

/**
 * Evaluate a contract offer from the driver's perspective.
 */
export function evaluateDriverOffer(input: DriverEvaluationInput): NegotiationEvaluationResult {
  const {
    driver,
    offeringTeam,
    offeredSalary,
    allDrivers,
    allTeams,
    constructorStandings,
    availableSeats,
    currentRound,
    maxRounds,
  } = input;

  // Calculate key metrics
  const marketValue = calculateMarketValue(driver, allDrivers);
  const driverAbility = calculateDriverAbility(driver);
  const teamQuality = calculateTeamQuality(offeringTeam, allTeams, constructorStandings);
  const careerWeight = calculateCareerWeight(driver);

  // Calculate required salary based on team quality gap
  const multiplier = calculateTeamQualityMultiplier(driverAbility, teamQuality, careerWeight);
  const requiredSalary = marketValue * multiplier;

  // Calculate salary ratio
  const salaryRatio = offeredSalary / requiredSalary;

  // Determine desperation level
  const isDesperate = availableSeats <= DESPERATION_SEAT_THRESHOLD;
  const isLateRound = currentRound >= maxRounds - 1;

  // Decision logic
  let responseType: ResponseType;
  let counterSalary: number | null = null;
  let isUltimatum = false;

  if (salaryRatio >= INSTANT_ACCEPT_RATIO) {
    // Insanely good deal - instant accept
    responseType = ResponseType.Accept;
  } else if (salaryRatio >= ACCEPT_RATIO) {
    // Good deal - accept, or counter if many alternatives
    if (availableSeats > MANY_SEATS_THRESHOLD) {
      // Many options - try to negotiate better
      responseType = ResponseType.Counter;
      counterSalary = Math.round(requiredSalary * COUNTER_ASK_MULTIPLIER);
    } else {
      responseType = ResponseType.Accept;
    }
  } else if (salaryRatio >= COUNTER_RATIO) {
    // Below expectations - counter
    responseType = ResponseType.Counter;
    // Counter with what they actually want
    counterSalary = Math.round(requiredSalary);
    // Late rounds or few alternatives = ultimatum
    if (isLateRound || isDesperate) {
      isUltimatum = true;
    }
  } else if (salaryRatio >= DESPERATE_ACCEPT_RATIO && isDesperate) {
    // Very low offer but desperate - accept to stay in F1
    responseType = ResponseType.Accept;
  } else {
    // Offer too low - reject
    responseType = ResponseType.Reject;
  }

  // Determine tone based on salary ratio
  let responseTone: ResponseTone;
  if (salaryRatio >= ACCEPT_RATIO) {
    responseTone = ResponseTone.Enthusiastic;
  } else if (salaryRatio >= COUNTER_RATIO) {
    responseTone = ResponseTone.Professional;
  } else {
    responseTone = ResponseTone.Disappointed;
  }

  // Build result
  const result: NegotiationEvaluationResult = {
    responseType,
    counterTerms: counterSalary
      ? {
          // Driver contract terms (simplified - just salary/duration for now)
          annualCost: counterSalary,
          duration: input.offeredDuration,
          upgradesIncluded: 0,
          customisationPointsIncluded: 0,
          optimisationIncluded: false,
        }
      : null,
    responseTone,
    responseDelayDays: BASE_RESPONSE_DELAY_DAYS,
    isNewsworthy: responseType === ResponseType.Accept,
    relationshipChange:
      responseType === ResponseType.Accept
        ? ACCEPT_RELATIONSHIP_BOOST
        : responseType === ResponseType.Reject
          ? REJECT_RELATIONSHIP_PENALTY
          : 0,
    isUltimatum,
  };

  return result;
}
