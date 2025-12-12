/**
 * Main process services
 */

export { ConfigLoader } from './config-loader';
export { GameStateManager } from './game-state-manager';
export { SaveManager } from './save-manager';
export {
  generateDailyNews,
  buildNewsContext,
  createNewsHeadline,
  createNamedQuote,
  createAnonymousQuote,
  createDriverQuote,
  createPrincipalQuote,
  createChiefQuote,
  pickRandom,
  checkProbability,
  isDaysBeforeRace,
} from './news-generator';
export type { NewsGenerationContext, CreateHeadlineParams } from './news-generator';
