/**
 * Stakeholder Evaluators
 *
 * Each evaluator implements the "black box" logic for how a specific
 * stakeholder type responds to contract offers.
 *
 * Currently implemented:
 * - ManufacturerEvaluator: Engine supplier contract evaluation
 *
 * Future evaluators:
 * - DriverEvaluator: Driver contract evaluation
 * - StaffEvaluator: Staff contract evaluation
 * - SponsorEvaluator: Sponsor contract evaluation
 */

export {
  evaluateManufacturerOffer,
  type ManufacturerEvaluationInput,
} from './manufacturer-evaluator';
