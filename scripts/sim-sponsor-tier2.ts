/**
 * Sponsor Tier 2 simulation CLI — used by Tricia (Tester) to verify
 * Tier 2 sponsorship mechanics: probability model, seeded rolls, rejection reasons.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sim-sponsor-tier2.ts [scenario]
 *
 * Scenarios:
 *   band           Print probability + band for a range of monthly payment values
 *   seed           Show that different negotiation seeds can produce different outcomes
 *   reasons        Trigger all five rejection-reason cases and print their text
 *
 * All scenarios run by default when no argument is supplied.
 */

import { randomUUID } from 'crypto';
import type {
  GameState,
  SponsorNegotiation,
  SponsorContractTerms,
  Sponsor,
  Team,
  ActiveSponsorDeal,
} from '../src/shared/domain/types';
import {
  SponsorTier,
  SponsorPlacement,
  NegotiationPhase,
  StakeholderType,
  ResponseType,
} from '../src/shared/domain/types';
import {
  computeAcceptanceProbabilities,
  getLikelihoodBand,
  hashString,
  seededRandom,
} from '../src/shared/domain/sponsor-probability';
import {
  evaluateSponsorOffer,
  calculateSponsorValuation,
} from '../src/main/engines/evaluators/sponsor-evaluator';
import { GameStateManager } from '../src/main/services/game-state-manager';

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

function makeSponsorDeal(sponsorId: string, teamId: string, tier: SponsorTier): ActiveSponsorDeal {
  return {
    sponsorId,
    teamId,
    tier,
    signingBonus: 0,
    monthlyPayment: 500_000,
    guaranteed: false,
    startSeason: 1,
    endSeason: 3,
  };
}

function makeNegotiation(
  id: string,
  teamId: string,
  sponsorId: string,
  terms: SponsorContractTerms,
  roundNumber = 1,
  isUltimatum = false
): SponsorNegotiation {
  return {
    id,
    stakeholderType: StakeholderType.Sponsor,
    teamId,
    sponsorId,
    phase: NegotiationPhase.AwaitingResponse,
    forSeason: 2,
    startedDate: { year: 2025, month: 1, day: 1 },
    lastActivityDate: { year: 2025, month: 1, day: 15 },
    rounds: [
      {
        roundNumber,
        offeredBy: 'player' as const,
        terms,
        offeredDate: { year: 2025, month: 1, day: 1 },
        expiresDate: { year: 2025, month: 2, day: 1 },
        isUltimatum,
      },
    ],
    currentRound: roundNumber,
    maxRounds: 4,
    relationshipScoreBefore: 50,
    hasCompetingOffer: false,
    isProactiveOutreach: false,
  };
}

function makeMinimalState(teamId: string, sponsors: Sponsor[], deals: ActiveSponsorDeal[] = []): GameState {
  const team = makeTeam(teamId);
  return {
    teams: [team],
    sponsors,
    sponsorDeals: deals,
    negotiations: [],
    calendarEvents: [],
    events: [],
    currentDate: { year: 2025, month: 1, day: 15 },
    currentSeason: {
      seasonNumber: 1,
      constructorStandings: [{ teamId, points: 100, position: 3, wins: 2, podiums: 4, polePositions: 1 }],
    } as GameState['currentSeason'],
    player: { teamId } as GameState['player'],
  } as unknown as GameState;
}

// ---------------------------------------------------------------------------
// Scenario 1: Band verification
// ---------------------------------------------------------------------------

function runBandScenario() {
  console.log('\n===== SCENARIO 1: Band Verification =====');
  console.log('Verifies that the band shown in the UI is driven by the actual engine probability.\n');

  const teamId = 'team-1';
  const sponsor = makeSponsor({ minReputation: 40 });
  const teamPosition = 3;
  const totalTeams = 10;

  // Compute valuation the same way the engine does
  const valuation = calculateSponsorValuation(sponsor, teamPosition, totalTeams);
  console.log(`willingPayment = $${valuation.willingPayment.toLocaleString()}/mo`);
  console.log(`isBelowHardGate = ${valuation.isBelowHardGate}`);
  console.log(`isBelowSoftGate = ${valuation.isBelowSoftGate}`);
  console.log('');

  const testRatios = [0.50, 0.60, 0.70, 0.80, 0.90, 0.95, 1.00, 1.10, 1.20];
  console.log('paymentRatio | p_accept | p_counter | p_reject | band');
  console.log('-------------|----------|-----------|----------|---------');

  for (const ratio of testRatios) {
    const offered = Math.round(valuation.willingPayment * ratio);
    const probs = computeAcceptanceProbabilities(ratio, valuation.isBelowHardGate, valuation.isBelowSoftGate);
    const band = getLikelihoodBand(probs);

    // Also run through the engine to verify the band matches the seeded decision
    const neg = makeNegotiation(randomUUID(), teamId, sponsor.id, {
      monthlyPayment: offered,
      signingBonus: 0,
      duration: 2,
      placement: SponsorPlacement.Secondary,
    });
    const result = evaluateSponsorOffer({
      negotiation: neg,
      sponsor,
      team: makeTeam(teamId),
      allTeams: [],
      allSponsors: [sponsor],
      existingSponsorDeals: [],
      relationshipScore: 50,
      teamPosition,
      totalTeams,
    });

    const match = result.acceptanceProbability !== undefined
      ? Math.abs(result.acceptanceProbability - probs.accept) < 0.001 ? '✓' : '✗ MISMATCH'
      : '?';

    console.log(
      `${ratio.toFixed(2)}         | ${probs.accept.toFixed(3)}  | ${probs.counter.toFixed(3)}    | ${probs.reject.toFixed(3)}   | ${band} [engine:${result.responseType} prob:${match}]`
    );
  }
}

// ---------------------------------------------------------------------------
// Scenario 2: Seed variation
// ---------------------------------------------------------------------------

function runSeedScenario() {
  console.log('\n===== SCENARIO 2: Seeded Roll Variation =====');
  console.log('Verifies that different per-negotiation seeds can produce different outcomes.\n');

  const teamId = 'team-1';
  const sponsor = makeSponsor({ minReputation: 40 });
  const teamPosition = 3;
  const totalTeams = 10;

  // Use a toss-up payment ratio (near INSTANT_ACCEPT_RATIO) where accept & counter have similar probability
  const valuation = calculateSponsorValuation(sponsor, teamPosition, totalTeams);
  const tossUpOffered = Math.round(valuation.willingPayment * 0.95);
  console.log(`Offer: $${tossUpOffered.toLocaleString()}/mo (ratio ~0.95, toss-up range)`);
  console.log('Running 20 evaluations with different negotiation IDs:\n');

  const outcomes: Record<string, number> = { Accept: 0, Counter: 0, Reject: 0 };

  for (let i = 0; i < 20; i++) {
    const negId = `neg-seed-test-${i}`;
    const neg = makeNegotiation(negId, teamId, sponsor.id, {
      monthlyPayment: tossUpOffered,
      signingBonus: 0,
      duration: 2,
      placement: SponsorPlacement.Secondary,
    });
    const result = evaluateSponsorOffer({
      negotiation: neg,
      sponsor,
      team: makeTeam(teamId),
      allTeams: [],
      allSponsors: [sponsor],
      existingSponsorDeals: [],
      relationshipScore: 50,
      teamPosition,
      totalTeams,
    });
    const label = result.responseType === ResponseType.Accept ? 'Accept'
      : result.responseType === ResponseType.Counter ? 'Counter'
      : 'Reject';
    outcomes[label]++;

    // Print raw seed → roll
    const seed = hashString(`${negId}:1`);
    const roll = seededRandom(seed);
    process.stdout.write(`  ID ${String(i).padStart(2)}: seed=${seed.toString().padStart(10)} roll=${roll.toFixed(4)} → ${label}\n`);
  }

  console.log(`\nDistribution: Accept=${outcomes.Accept}  Counter=${outcomes.Counter}  Reject=${outcomes.Reject}`);
  const distinctOutcomes = Object.values(outcomes).filter((v) => v > 0).length;
  if (distinctOutcomes >= 2) {
    console.log('✓ Multiple outcomes observed — seeded roll is live.');
  } else {
    console.log('! Only one outcome observed. Payment ratio may be too far from a boundary — try a different ratio.');
  }
}

// ---------------------------------------------------------------------------
// Scenario 3: All five rejection reasons
// ---------------------------------------------------------------------------

function runReasonsScenario() {
  console.log('\n===== SCENARIO 3: Rejection Reasons =====');
  console.log('Verifies all five rejection-reason strings are populated correctly.\n');

  const teamId = 'team-1';
  const terms = (monthly: number): SponsorContractTerms => ({
    monthlyPayment: monthly,
    signingBonus: 0,
    duration: 2,
    placement: SponsorPlacement.Secondary,
  });

  // ── Case 1: Rival conflict ──────────────────────────────���──────────────────
  {
    console.log('Case 1 — Rival conflict');
    const rivalSponsor = makeSponsor({ id: 'rival-sponsor', name: 'Rival Co', rivalGroup: 'auto-group' });
    const targetSponsor = makeSponsor({ id: 'target-sponsor', name: 'Target Sponsor', rivalGroup: 'auto-group' });
    const existingDeal = makeSponsorDeal('rival-sponsor', teamId, SponsorTier.Major);

    const neg = makeNegotiation(randomUUID(), teamId, 'target-sponsor', terms(1_000_000));
    const result = evaluateSponsorOffer({
      negotiation: neg,
      sponsor: targetSponsor,
      team: makeTeam(teamId),
      allTeams: [],
      allSponsors: [rivalSponsor, targetSponsor],
      existingSponsorDeals: [existingDeal],
      relationshipScore: 50,
      teamPosition: 3,
      totalTeams: 10,
    });
    const pass = result.responseType === ResponseType.Reject && !!result.rejectionReason;
    console.log(`  responseType: ${result.responseType}`);
    console.log(`  rejectionReason: "${result.rejectionReason}"`);
    console.log(`  ${pass ? '✓ PASS' : '✗ FAIL'}\n`);
  }

  // ── Case 2: Below reputation floor ────────────────────────────────────────
  {
    console.log('Case 2 — Below reputation floor');
    // High minReputation so a mid-table team fails the hard gate
    const sponsor = makeSponsor({ minReputation: 90 });
    const neg = makeNegotiation(randomUUID(), teamId, sponsor.id, terms(1_000_000));
    const result = evaluateSponsorOffer({
      negotiation: neg,
      sponsor,
      team: makeTeam(teamId),
      allTeams: [],
      allSponsors: [sponsor],
      existingSponsorDeals: [],
      relationshipScore: 50,
      teamPosition: 9, // Near last → low reputation
      totalTeams: 10,
    });
    const pass = result.responseType === ResponseType.Reject && !!result.rejectionReason;
    console.log(`  responseType: ${result.responseType}`);
    console.log(`  rejectionReason: "${result.rejectionReason}"`);
    console.log(`  ${pass ? '✓ PASS' : '✗ FAIL'}\n`);
  }

  // ── Case 3: Offer too low ──────────────────────────────────────────────────
  {
    console.log('Case 3 — Offer too low');
    const sponsor = makeSponsor({ minReputation: 40 });
    // Offer at 30% of willing payment — well below REJECT_RATIO (0.6)
    const valuation = calculateSponsorValuation(sponsor, 3, 10);
    const lowOffer = Math.round(valuation.willingPayment * 0.30);

    // Use a negotiation ID that produces a roll in the Reject range
    // We'll try multiple IDs to find one that actually rejects (vs counter)
    let found = false;
    for (let i = 0; i < 50; i++) {
      const neg = makeNegotiation(`neg-low-offer-${i}`, teamId, sponsor.id, terms(lowOffer));
      const result = evaluateSponsorOffer({
        negotiation: neg,
        sponsor,
        team: makeTeam(teamId),
        allTeams: [],
        allSponsors: [sponsor],
        existingSponsorDeals: [],
        relationshipScore: 50,
        teamPosition: 3,
        totalTeams: 10,
      });
      if (result.responseType === ResponseType.Reject && result.rejectionReason?.includes('looking closer')) {
        console.log(`  responseType: ${result.responseType}`);
        console.log(`  rejectionReason: "${result.rejectionReason}"`);
        console.log(`  ✓ PASS\n`);
        found = true;
        break;
      }
    }
    if (!found) {
      // At 0.30 ratio, p_reject is very high — this should always reject
      console.log('  ! Could not find an "offer too low" rejection in 50 tries — check threshold\n');
    }
  }

  // ── Case 4: Max rounds ────────────────────────────────────────────────────
  {
    console.log('Case 4 — Max rounds (≥4 rounds)');
    const sponsor = makeSponsor({ minReputation: 40 });
    const valuation = calculateSponsorValuation(sponsor, 3, 10);
    // Mid-range offer that might counter, but we force round 4 which triggers the max-rounds rejection reason
    const midOffer = Math.round(valuation.willingPayment * 0.70);

    let found = false;
    for (let i = 0; i < 50; i++) {
      const neg = makeNegotiation(`neg-maxround-${i}`, teamId, sponsor.id, terms(midOffer), 4);
      const result = evaluateSponsorOffer({
        negotiation: neg,
        sponsor,
        team: makeTeam(teamId),
        allTeams: [],
        allSponsors: [sponsor],
        existingSponsorDeals: [],
        relationshipScore: 50,
        teamPosition: 3,
        totalTeams: 10,
      });
      if (result.rejectionReason?.includes("tried to find common ground")) {
        console.log(`  responseType: ${result.responseType}`);
        console.log(`  rejectionReason: "${result.rejectionReason}"`);
        console.log(`  ✓ PASS\n`);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log('  ! Max-rounds rejection reason not triggered in 50 tries.\n');
    }
  }

  // ── Case 5: Slot filled by other deal ─────────────────────────────────────
  {
    console.log('Case 5 — Slot filled by other deal');
    const sponsor1 = makeSponsor({ id: 'sponsor-a', name: 'Sponsor A', tier: SponsorTier.Minor });
    const sponsor2 = makeSponsor({ id: 'sponsor-b', name: 'Sponsor B', tier: SponsorTier.Minor });
    const sponsorTerms: SponsorContractTerms = {
      monthlyPayment: 200_000,
      signingBonus: 100_000,
      duration: 2,
      placement: SponsorPlacement.Tertiary,
    };
    const negA: SponsorNegotiation = {
      id: 'neg-a',
      stakeholderType: StakeholderType.Sponsor,
      teamId,
      sponsorId: 'sponsor-a',
      phase: NegotiationPhase.PendingPlayerConfirmation,
      forSeason: 2,
      startedDate: { year: 2025, month: 1, day: 1 },
      lastActivityDate: { year: 2025, month: 1, day: 15 },
      rounds: [{ roundNumber: 1, offeredBy: 'counterparty' as const, terms: sponsorTerms, offeredDate: { year: 2025, month: 1, day: 1 }, expiresDate: { year: 2025, month: 2, day: 1 } }],
      currentRound: 1,
      maxRounds: 4,
      relationshipScoreBefore: 50,
      hasCompetingOffer: false,
      isProactiveOutreach: false,
    };
    const negB: SponsorNegotiation = {
      ...negA,
      id: 'neg-b',
      sponsorId: 'sponsor-b',
    };

    const state = makeMinimalState(teamId, [sponsor1, sponsor2]);
    // Minor tier has 5 slots (from SPONSOR_SLOT_COUNTS). Pre-fill 4 so that signing
    // neg-a fills the last slot and triggers the auto-fail of neg-b.
    for (let i = 0; i < 4; i++) {
      (state.sponsorDeals as ActiveSponsorDeal[]).push(makeSponsorDeal(`sponsor-existing-${i}`, teamId, SponsorTier.Minor));
    }
    state.negotiations = [negA, negB] as GameState['negotiations'];
    GameStateManager.currentState = state;

    // Sign neg-a — this fills the last slot, which should auto-fail neg-b
    GameStateManager.signSponsorDeal('neg-a');

    const updatedNegB = state.negotiations.find((n) => n.id === 'neg-b') as SponsorNegotiation;
    const pass =
      updatedNegB?.phase === NegotiationPhase.Failed &&
      !!updatedNegB.rejectionReason;
    console.log(`  neg-b phase after signing neg-a: ${updatedNegB?.phase}`);
    console.log(`  rejectionReason: "${updatedNegB?.rejectionReason ?? '(none)'}"`);
    console.log(`  ${pass ? '✓ PASS' : '✗ FAIL'}\n`);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const scenario = process.argv[2] ?? 'all';

if (scenario === 'band' || scenario === 'all') runBandScenario();
if (scenario === 'seed' || scenario === 'all') runSeedScenario();
if (scenario === 'reasons' || scenario === 'all') runReasonsScenario();
