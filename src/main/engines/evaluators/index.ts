/**
 * Stakeholder Evaluators
 *
 * Each evaluator implements the "black box" logic for how a specific
 * stakeholder type responds to contract offers.
 *
 * Currently implemented:
 * - ManufacturerEvaluator: Engine supplier contract evaluation
 * - DriverEvaluator: Driver contract evaluation (perceived market value system)
 *
 * Future evaluators:
 * - StaffEvaluator: Staff contract evaluation
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
  MIN_DESPERATION_MULTIPLIER,
  DESPERATION_MULTIPLIER_RANGE,
  type DriverEvaluationInput,
} from './driver-evaluator';
