/**
 * Stakeholder Evaluators
 *
 * Each evaluator implements the "black box" logic for how a specific
 * stakeholder type responds to contract offers.
 *
 * Currently implemented:
 * - ManufacturerEvaluator: Engine supplier contract evaluation
 * - DriverEvaluator: Driver contract evaluation (perceived market value system)
 * - TeamEvaluator: Team's evaluation of drivers (shortlisting, attractiveness)
 * - StaffEvaluator: Staff contract evaluation (letter grade scouting system)
 *
 * Future evaluators:
 * - SponsorEvaluator: Sponsor contract evaluation
 */

export {
  evaluateManufacturerOffer,
  type ManufacturerEvaluationInput,
} from './manufacturer-evaluator';

export {
  evaluateDriverOffer,
  calculatePerceivedValue,
  calculateMarketValue,
  calculateDriverAbility,
  MIN_DESPERATION_MULTIPLIER,
  DESPERATION_MULTIPLIER_RANGE,
  MAX_DESPERATION_MULTIPLIER,
  type DriverEvaluationInput,
} from './driver-evaluator';

export {
  calculateDriverAttractiveness,
  getAgeMultiplier,
  getEligibleDriverPool,
  getTeamShortlist,
  evaluateDriverApproach,
  type DriverAttractivenessInput,
  type RankedDriver,
  type EligiblePoolInput,
  type TeamShortlistInput,
  type TeamEvaluationInput,
  type TeamEvaluationResult,
} from './team-evaluator';

export {
  evaluateSponsorOffer,
  hasRivalGroupConflict,
  calculateSponsorValuation,
  getPlacementForTier,
  getSponsorTierDisplayName,
  type SponsorEvaluationInput,
} from './sponsor-evaluator';

export {
  evaluateStaffOffer,
  evaluateStaffApproach,
  calculatePerceivedAbility,
  calculateExpectedSalary,
  calculateTeamPrestige,
  abilityToLetterGrade,
  getChiefLetterGrade,
  getAllLetterGrades,
  getChiefRoleDisplayName,
  type StaffEvaluationInput,
  type StaffApproachInput,
  type StaffApproachResult,
  type LetterGrade,
} from './staff-evaluator';
