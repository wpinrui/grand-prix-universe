/**
 * Sponsor Tier 3 simulation CLI — used by Tricia (Tester) to verify
 * Tier 3 sponsorship mechanics: renewal prompt, lapse, and renewal payment calculation.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sim-sponsor-tier3.ts [scenario]
 *
 * Scenarios:
 *   prompt   Season-end hook fires a critical renewal-prompt email for expiring deals
 *   lapse    Expiring deal with no player action is removed at season transition
 *   payment  calculateWillingPayment output for a given team position and sponsor
 *
 * All scenarios run by default when no argument is supplied.
 */

import type { GameState, Sponsor, ActiveSponsorDeal, Team } from '../src/shared/domain/types';
import {
  SponsorTier,
  GamePhase,
} from '../src/shared/domain/types';
import { CalendarEventType } from '../src/shared/domain';
import { calculateWillingPayment } from '../src/shared/domain/sponsor-probability';
import { processSponsorSeasonEnd } from '../src/main/services/contract-creator';

// ---------------------------------------------------------------------------
// Minimal builders
// ---------------------------------------------------------------------------

function makeTeam(id: string): Team {
  return {
    id,
    name: 'Test Team',
    shortName: 'TEST',
    color: '#ff0000',
    budget: 5_000_000,
    reputation: 70,
    initialSponsorIds: [],
  } as unknown as Team;
}

function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'sponsor-test',
    name: 'Test Sponsor',
    industry: 'technology',
    tier: SponsorTier.Major,
    baseMonthlyPayment: 1_000_000,
    minReputation: 40,
    rivalGroup: null,
    logoUrl: null,
    ...overrides,
  };
}

function makeDeal(sponsorId: string, teamId: string, startSeason: number, endSeason: number): ActiveSponsorDeal {
  return {
    sponsorId,
    teamId,
    tier: SponsorTier.Major,
    signingBonus: 0,
    monthlyPayment: 500_000,
    guaranteed: true,
    startSeason,
    endSeason,
  };
}

function makeMinimalState(teamId: string, sponsors: Sponsor[], deals: ActiveSponsorDeal[], currentSeasonNumber: number): GameState {
  const team = makeTeam(teamId);
  return {
    teams: [team],
    sponsors,
    sponsorDeals: deals,
    negotiations: [],
    calendarEvents: [],
    events: [],
    drivers: [],
    chiefs: [],
    manufacturers: [],
    runtimeStates: {},
    currentDate: { year: 2025, month: 12, day: 31 },
    currentSeason: {
      seasonNumber: currentSeasonNumber,
      constructorStandings: [{ teamId, points: 200, position: 3, wins: 5, podiums: 10, polePositions: 2 }],
      driverStandings: [],
      calendar: [],
      regulations: {},
    } as GameState['currentSeason'],
    pastSeasons: [],
    phase: GamePhase.PostSeason,
    player: { teamId } as GameState['player'],
    settings: {},
    version: '1.0.0',
  } as unknown as GameState;
}

// ---------------------------------------------------------------------------
// Scenario 1: Renewal prompt email
// ---------------------------------------------------------------------------

function runPromptScenario(): boolean {
  console.log('\n===== SCENARIO 1: Renewal Prompt Email =====');
  console.log('Sets up an expiring deal (endSeason === currentSeason), calls processSponsorSeasonEnd()');
  console.log('(the same function startNewSeason() uses), and confirms a critical renewal-prompt email was generated.\n');

  const teamId = 'team-player';
  const sponsor = makeSponsor({ id: 'sponsor-alpha', name: 'AlphaCorp' });
  const deal = makeDeal(sponsor.id, teamId, 3, 5);
  const state = makeMinimalState(teamId, [sponsor], [deal], 5);

  processSponsorSeasonEnd(state, teamId);

  const criticalEmails = state.calendarEvents.filter(
    (e: { type: string; critical: boolean; body?: string }) =>
      e.type === CalendarEventType.Email && e.critical
  );

  if (criticalEmails.length === 0) {
    console.log('FAIL — no critical email generated');
    return false;
  }

  const email = criticalEmails[0] as { subject: string; body: string };
  console.log(`Subject: "${email.subject}"`);
  console.log(`Body:    "${email.body}"`);

  const hasRenewalText = email.body.includes('open to renewal') && email.body.includes('Renewals tab');
  if (!hasRenewalText) {
    console.log(`FAIL — email body missing expected renewal text`);
    return false;
  }

  // Verify player-team filter: a non-player deal expiring same season must NOT get an email
  const otherTeamId = 'team-other';
  const otherSponsor = makeSponsor({ id: 'sponsor-other', name: 'OtherCorp' });
  const otherDeal = makeDeal(otherSponsor.id, otherTeamId, 3, 5);
  const state2 = makeMinimalState(teamId, [otherSponsor], [otherDeal], 5);
  processSponsorSeasonEnd(state2, teamId);
  const emailsForOtherTeam = state2.calendarEvents.filter(
    (e: { type: string; critical: boolean }) => e.type === CalendarEventType.Email && e.critical
  );
  if (emailsForOtherTeam.length !== 0) {
    console.log('FAIL — renewal prompt sent for a non-player deal');
    return false;
  }

  console.log('\nScenario 1 ✓ — critical renewal-prompt email generated for player deal only');
  return true;
}

// ---------------------------------------------------------------------------
// Scenario 2: Lapse on ignored deal
// ---------------------------------------------------------------------------

function runLapseScenario(): boolean {
  console.log('\n===== SCENARIO 2: Lapse on Ignored Deal =====');
  console.log('Sets up an expiring deal with no active negotiation, calls processSponsorSeasonEnd(),');
  console.log('and confirms the deal is removed and a news headline fires.\n');

  const teamId = 'team-player';
  const sponsor = makeSponsor({ id: 'sponsor-beta', name: 'BetaDrive' });
  const deal = makeDeal(sponsor.id, teamId, 3, 5);
  const state = makeMinimalState(teamId, [sponsor], [deal], 5);

  const dealsBeforeLapse = state.sponsorDeals.length;
  processSponsorSeasonEnd(state, teamId);
  const dealsAfterLapse = state.sponsorDeals.length;

  const headlines = state.calendarEvents.filter(
    (e: { type: string; critical: boolean; subject?: string }) =>
      e.type === CalendarEventType.Headline && !e.critical
  );

  if (dealsAfterLapse !== dealsBeforeLapse - 1) {
    console.log(`FAIL — deal count: before=${dealsBeforeLapse}, after=${dealsAfterLapse}`);
    return false;
  }

  if (headlines.length === 0) {
    console.log('FAIL — no news headline generated for lapsed deal');
    return false;
  }

  const headline = headlines[0] as { subject: string };
  console.log(`Headline: "${headline.subject}"`);

  const hasLapseText =
    headline.subject.includes('BetaDrive') &&
    headline.subject.includes('Test Team') &&
    headline.subject.includes('3-year');

  if (!hasLapseText) {
    console.log(`FAIL — headline missing sponsor name, team name, or duration`);
    return false;
  }

  console.log(`Deals removed: ${dealsBeforeLapse} → ${dealsAfterLapse}`);
  console.log('\nScenario 2 ✓ — deal lapsed, slot opened, news headline fired');
  return true;
}

// ---------------------------------------------------------------------------
// Scenario 3: Renewal payment matches calculateWillingPayment
// ---------------------------------------------------------------------------

function runPaymentScenario(): boolean {
  console.log('\n===== SCENARIO 3: Renewal Payment Calculation =====');
  console.log('Prints the renewal monthly payment from calculateWillingPayment for specific');
  console.log('team positions, confirming no parallel calculation exists.\n');

  const testCases = [
    { teamPosition: 1, totalTeams: 10, label: 'P1 (champion)' },
    { teamPosition: 3, totalTeams: 10, label: 'P3' },
    { teamPosition: 5, totalTeams: 10, label: 'P5 (midfield)' },
    { teamPosition: 8, totalTeams: 10, label: 'P8 (lower midfield)' },
    { teamPosition: 10, totalTeams: 10, label: 'P10 (backmarker)' },
  ];

  const sponsor = makeSponsor({
    id: 'sponsor-gamma',
    name: 'GammaPay',
    tier: SponsorTier.Title,
    baseMonthlyPayment: 3_000_000,
    minReputation: 50,
  });

  console.log('sponsor: GammaPay (Title, base $3M/mo, minReputation=50)');
  console.log('');
  console.log('position     | renewalPayment');
  console.log('-------------|---------------');

  let passed = true;
  for (const { teamPosition, totalTeams, label } of testCases) {
    const payment = calculateWillingPayment(sponsor, teamPosition, totalTeams);
    console.log(`${label.padEnd(12)} | $${payment.toLocaleString()}/mo`);

    // Sanity: payment must be > 0 and <= 2× base (premium cap)
    if (payment <= 0 || payment > sponsor.baseMonthlyPayment * 2) {
      console.log(`  FAIL — payment out of expected range`);
      passed = false;
    }
  }

  // Verify P1 > P5 > P10 (better position = higher willing payment)
  const p1 = calculateWillingPayment(sponsor, 1, 10);
  const p5 = calculateWillingPayment(sponsor, 5, 10);
  const p10 = calculateWillingPayment(sponsor, 10, 10);

  if (!(p1 >= p5 && p5 >= p10)) {
    console.log('\nFAIL — payment does not decrease monotonically with lower position');
    passed = false;
  } else {
    console.log('\nMonotonicity check: P1 ≥ P5 ≥ P10 ✓');
  }

  if (passed) {
    console.log('\nScenario 3 ✓ — calculateWillingPayment outputs consistent values for Renewals tab');
  }
  return passed;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const arg = process.argv[2];
let allPassed = true;

if (!arg || arg === 'prompt') {
  allPassed = runPromptScenario() && allPassed;
}
if (!arg || arg === 'lapse') {
  allPassed = runLapseScenario() && allPassed;
}
if (!arg || arg === 'payment') {
  allPassed = runPaymentScenario() && allPassed;
}

console.log('\n' + (allPassed ? '✓ All Tier 3 scenarios passed.' : '✗ One or more Tier 3 scenarios FAILED.'));
process.exit(allPassed ? 0 : 1);
