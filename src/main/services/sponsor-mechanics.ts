import type { GameState } from '../../shared/domain/types';

/**
 * Credit monthly sponsor payments to each team's budget.
 * Called once at the start of each new month in the turn loop.
 *
 * Only deals whose contract is active for the current season pay out — i.e.
 * `startSeason <= currentSeason <= endSeason`. Deals signed in season N for
 * season N+1 do not pay during N, and deals whose endSeason has passed do not
 * keep paying after the contract ends.
 */
export function applyMonthlyIncomeTick(state: GameState): void {
  const currentSeason = state.currentSeason.seasonNumber;
  for (const deal of state.sponsorDeals) {
    if (deal.startSeason > currentSeason) continue;
    if (deal.endSeason < currentSeason) continue;
    if (deal.monthlyPayment <= 0) continue;
    const team = state.teams.find((t) => t.id === deal.teamId);
    if (team) {
      team.budget += deal.monthlyPayment;
    }
  }
}
