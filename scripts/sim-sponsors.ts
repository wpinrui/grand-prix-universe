/**
 * Sponsor simulation CLI — used by Tricia (Tester) to verify Tier 1 sponsorship mechanics.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sim-sponsors.ts [scenario]
 *
 * Scenarios:
 *   signing      Simulate a sponsor-accepts → player Sign and print pre/post team.budget
 *   monthly N    Fast-forward N months (active deal) and print cumulative delta
 *   slots        Try to start a negotiation when all slots of a tier are filled
 *
 * All scenarios run by default when no argument is supplied.
 *
 * The CLI installs a constructed GameState onto `GameStateManager.currentState`
 * and invokes the same methods the IPC layer calls — no parallel calculation.
 */

import { randomUUID } from 'crypto';
import type {
  GameState,
  SponsorNegotiation,
  SponsorContractTerms,
  Sponsor,
  Team,
} from '../src/shared/domain/types';
import {
  SponsorTier,
  SponsorPlacement,
  NegotiationPhase,
  StakeholderType,
} from '../src/shared/domain/types';
import { SPONSOR_SLOT_COUNTS } from '../src/shared/domain/engine-utils';
import { GameStateManager } from '../src/main/services/game-state-manager';
import { applyMonthlyIncomeTick } from '../src/main/services/sponsor-mechanics';

// ---------------------------------------------------------------------------
// Minimal state builders
// ---------------------------------------------------------------------------

function makeTeam(id: string, budget: number): Team {
  return {
    id,
    name: 'Test Team',
    shortName: 'TEST',
    color: '#ff0000',
    budget,
    reputation: 70,
    initialSponsorIds: [],
  } as unknown as Team;
}

function makeSponsor(id: string, tier: SponsorTier): Sponsor {
  return {
    id,
    name: 'Test Sponsor',
    industry: 'technology',
    tier,
    baseMonthlyPayment: 50_000,
    minReputation: 0,
    rivalGroup: null,
    logoUrl: null,
  };
}

function makeMinimalState(
  teamId: string,
  budget: number,
  sponsorTier: SponsorTier = SponsorTier.Major
): GameState {
  const team = makeTeam(teamId, budget);
  const sponsor = makeSponsor('sponsor-1', sponsorTier);
  return {
    teams: [team],
    sponsors: [sponsor],
    sponsorDeals: [],
    negotiations: [],
    calendarEvents: [],
    events: [],
    currentDate: { year: 2025, month: 1, day: 15 },
    currentSeason: { seasonNumber: 1 } as GameState['currentSeason'],
    player: { teamId } as GameState['player'],
  } as unknown as GameState;
}

function makePendingNegotiation(
  teamId: string,
  sponsorId: string,
  terms: SponsorContractTerms,
  forSeason = 2
): SponsorNegotiation {
  return {
    id: randomUUID(),
    stakeholderType: StakeholderType.Sponsor,
    teamId,
    sponsorId,
    phase: NegotiationPhase.PendingPlayerConfirmation,
    forSeason,
    startedDate: { year: 2025, month: 1, day: 1 },
    lastActivityDate: { year: 2025, month: 1, day: 15 },
    rounds: [
      {
        roundNumber: 1,
        offeredBy: 'counterparty' as const,
        terms,
        offeredDate: { year: 2025, month: 1, day: 1 },
        expiresDate: { year: 2025, month: 2, day: 1 },
      },
    ],
    currentRound: 1,
    maxRounds: 5,
    relationshipScoreBefore: 50,
    hasCompetingOffer: false,
    isProactiveOutreach: false,
  };
}

function installState(state: GameState): void {
  GameStateManager.currentState = state;
}

// ---------------------------------------------------------------------------
// Scenario 1 — Signing bonus via real signSponsorDeal()
// ---------------------------------------------------------------------------

function scenarySigning() {
  console.log('\n=== SCENARIO: signing ===');

  const teamId = 'team-1';
  const signingBonus = 200_000;
  const monthlyPayment = 50_000;
  const startBudget = 1_000_000;

  const state = makeMinimalState(teamId, startBudget);
  const terms: SponsorContractTerms = {
    signingBonus,
    monthlyPayment,
    duration: 2,
    placement: SponsorPlacement.Secondary,
  };

  const negotiation = makePendingNegotiation(teamId, 'sponsor-1', terms);
  state.negotiations.push(negotiation);

  installState(state);

  const budgetBefore = state.teams[0].budget;
  console.log(`Budget before Sign:  $${budgetBefore.toLocaleString()}`);

  GameStateManager.signSponsorDeal(negotiation.id);

  const budgetAfter = state.teams[0].budget;
  console.log(`Budget after Sign:   $${budgetAfter.toLocaleString()}`);
  console.log(`Delta:               $${(budgetAfter - budgetBefore).toLocaleString()} (expected $${signingBonus.toLocaleString()})`);
  console.log(`Negotiation phase:   ${negotiation.phase} (expected '${NegotiationPhase.Completed}')`);

  const passed =
    budgetAfter - budgetBefore === signingBonus &&
    negotiation.phase === NegotiationPhase.Completed;
  console.log(`Result: ${passed ? 'PASS ✓' : 'FAIL ✗'}`);
}

// ---------------------------------------------------------------------------
// Scenario 2 — Monthly income tick (real applyMonthlyIncomeTick)
//
// Covers the active-season filter: an inactive deal scheduled for next season
// must not pay, and an expired deal must not pay.
// ---------------------------------------------------------------------------

function scenarioMonthly(months: number) {
  console.log(`\n=== SCENARIO: monthly (${months} months) ===`);

  const teamId = 'team-1';
  const monthlyPayment = 50_000;
  const startBudget = 1_000_000;

  const state = makeMinimalState(teamId, startBudget);
  // currentSeason = 1

  // Active deal (covers current season) — should pay
  state.sponsorDeals.push({
    sponsorId: 'sponsor-1',
    teamId,
    tier: SponsorTier.Major,
    signingBonus: 0,
    monthlyPayment,
    guaranteed: true,
    startSeason: 1,
    endSeason: 3,
  });
  // Future deal (next season) — should NOT pay
  state.sponsorDeals.push({
    sponsorId: 'sponsor-future',
    teamId,
    tier: SponsorTier.Major,
    signingBonus: 0,
    monthlyPayment: 99_999,
    guaranteed: true,
    startSeason: 2,
    endSeason: 3,
  });
  // Expired deal — should NOT pay
  state.sponsorDeals.push({
    sponsorId: 'sponsor-expired',
    teamId,
    tier: SponsorTier.Minor,
    signingBonus: 0,
    monthlyPayment: 88_888,
    guaranteed: true,
    startSeason: 0,
    endSeason: 0,
  });

  installState(state);

  const budgetBefore = state.teams[0].budget;
  console.log(`Budget before ${months} month(s): $${budgetBefore.toLocaleString()}`);

  for (let i = 0; i < months; i++) {
    applyMonthlyIncomeTick(state);
  }

  const budgetAfter = state.teams[0].budget;
  const delta = budgetAfter - budgetBefore;
  const expected = monthlyPayment * months;
  console.log(`Budget after ${months} month(s):  $${budgetAfter.toLocaleString()}`);
  console.log(`Delta:    $${delta.toLocaleString()} (expected $${expected.toLocaleString()} — only the active deal should pay)`);

  const passed = delta === expected;
  console.log(`Result: ${passed ? 'PASS ✓' : 'FAIL ✗'}`);
}

// ---------------------------------------------------------------------------
// Scenario 3 — Slot enforcement via real startSponsorNegotiation()
// ---------------------------------------------------------------------------

function scenarioSlots() {
  console.log('\n=== SCENARIO: slots ===');

  const teamId = 'team-1';
  const tier = SponsorTier.Title; // Only 1 slot
  const state = makeMinimalState(teamId, 1_000_000, tier);

  // Fill the only Title slot
  state.sponsorDeals.push({
    sponsorId: 'sponsor-1',
    teamId,
    tier,
    signingBonus: 0,
    monthlyPayment: 100_000,
    guaranteed: true,
    startSeason: 1,
    endSeason: 3,
  });
  // Add a second sponsor of the same tier so we have someone to attempt to negotiate with
  state.sponsors.push(makeSponsor('sponsor-2', tier));

  installState(state);

  console.log(`Title slots allowed:   ${SPONSOR_SLOT_COUNTS[tier]}`);
  console.log(`Active title deals:    ${state.sponsorDeals.filter((d) => d.teamId === teamId && d.tier === tier).length}`);

  const terms: SponsorContractTerms = {
    signingBonus: 100_000,
    monthlyPayment: 100_000,
    duration: 2,
    placement: SponsorPlacement.Primary,
  };

  let blocked = false;
  let errorMessage = '';
  try {
    GameStateManager.startSponsorNegotiation('sponsor-2', terms);
  } catch (err) {
    blocked = true;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  console.log(`Attempt to negotiate: ${blocked ? `BLOCKED ✓ ("${errorMessage}")` : 'ALLOWED (unexpected ✗)'}`);
  console.log(`Result: ${blocked ? 'PASS ✓' : 'FAIL ✗'}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  const scenario = process.argv[2] ?? 'all';
  const months = parseInt(process.argv[3] ?? '3', 10);

  if (scenario === 'signing' || scenario === 'all') scenarySigning();
  if (scenario === 'monthly' || scenario === 'all') scenarioMonthly(months);
  if (scenario === 'slots' || scenario === 'all') scenarioSlots();

  console.log('\nDone.');
}

main();
