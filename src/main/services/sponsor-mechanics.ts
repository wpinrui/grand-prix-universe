import type { GameState } from '../../shared/domain/types';

/**
 * Credit monthly sponsor payments to each team's budget.
 * Called once at the start of each new month in the turn loop.
 */
export function applyMonthlyIncomeTick(state: GameState): void {
  for (const deal of state.sponsorDeals) {
    const team = state.teams.find((t) => t.id === deal.teamId);
    if (team && deal.monthlyPayment > 0) {
      team.budget += deal.monthlyPayment;
    }
  }
}
