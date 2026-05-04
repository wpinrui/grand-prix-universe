/**
 * Sponsor eligibility balance simulator.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sim-sponsor-balance.ts
 *
 * Prints, for each grid position 1–10 in a 10-team championship, the count
 * of sponsors per tier (Title / Major / Minor) in each eligibility band
 * (Strong / Borderline / Below). Uses the same computeReputationRatio and
 * getReputationStanding functions as the Browse tab — no parallel calculation.
 *
 * Target curve (Strong + Borderline):
 *   Pos | Title(/18) | Major(/45) | Minor(/63)
 *   P1  |    ~16     |    ~42     |    ~58
 *   P2  |    ~14     |    ~39     |    ~53
 *   P3  |    ~12     |    ~36     |    ~48
 *   P4  |    ~9      |    ~30     |    ~40
 *   P5  |    ~7      |    ~25     |    ~32
 *   P6  |    ~4      |    ~20     |    ~28
 *   P7  |    ~2      |    ~14     |    ~24
 *   P8  |     0      |    ~9      |    ~18
 *   P9  |     0      |    ~6      |    ~14
 *   P10 |     0      |     0      |     0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  computeReputationRatio,
  computePaymentRatio,
  computeAcceptanceProbabilities,
  getLikelihoodBand,
  calculateWillingPayment,
  getReputationStanding,
  HARD_GATE_MULTIPLIER,
  SOFT_GATE_MULTIPLIER,
  type LikelihoodBand,
} from '../src/shared/domain/sponsor-probability';
import type { Sponsor } from '../src/shared/domain/types';

const sponsorsPath = path.join(__dirname, '../data/content/sponsors.json');
const { sponsors } = JSON.parse(fs.readFileSync(sponsorsPath, 'utf-8')) as {
  sponsors: Array<Sponsor>;
};

const TOTAL_TEAMS = 10;
const TIERS = ['title', 'major', 'minor'] as const;
type Tier = typeof TIERS[number];
type Band = 'Strong' | 'Borderline' | 'Below';

function getBand(position: number, totalTeams: number, minReputation: number): Band {
  const standing = getReputationStanding(position, totalTeams, minReputation);
  if (standing === 'Strong match') return 'Strong';
  if (standing === 'Borderline') return 'Borderline';
  return 'Below';
}

type TierCounts = Record<Band, number>;
type Row = Record<Tier, TierCounts>;

const rows: Row[] = [];
for (let pos = 1; pos <= TOTAL_TEAMS; pos++) {
  const row: Row = {
    title: { Strong: 0, Borderline: 0, Below: 0 },
    major: { Strong: 0, Borderline: 0, Below: 0 },
    minor: { Strong: 0, Borderline: 0, Below: 0 },
  };
  for (const sponsor of sponsors) {
    const tier = sponsor.tier as Tier;
    if (!TIERS.includes(tier)) continue;
    const band = getBand(pos, TOTAL_TEAMS, sponsor.minReputation);
    row[tier][band]++;
  }
  rows.push(row);
}

// ---- Print ----------------------------------------------------------------

const COL = 6;
function pad(n: number): string { return String(n).padStart(COL); }
function padH(s: string): string { return s.padStart(COL); }

const divider = '-'.repeat(4 + 3 * COL + 3 + 3 * COL + 3 + 3 * COL);

console.log('\nSponsor Eligibility Balance — 10-team championship\n');
console.log(
  'Pos |' +
  padH('TStr') + padH('TBrd') + padH('T+B') + '  |' +
  padH('MStr') + padH('MBrd') + padH('M+B') + '  |' +
  padH('mStr') + padH('mBrd') + padH('m+B')
);
console.log(divider);

rows.forEach((row, i) => {
  const pos = i + 1;
  const t = row.title;
  const ma = row.major;
  const mi = row.minor;
  console.log(
    `P${String(pos).padEnd(2)} |` +
    pad(t.Strong) + pad(t.Borderline) + pad(t.Strong + t.Borderline) + '  |' +
    pad(ma.Strong) + pad(ma.Borderline) + pad(ma.Strong + ma.Borderline) + '  |' +
    pad(mi.Strong) + pad(mi.Borderline) + pad(mi.Strong + mi.Borderline)
  );
});

console.log(divider);
console.log('\nLegend: T=Title  M=Major  m=Minor  Str=Strong  Brd=Borderline  +B=Strong+Borderline\n');

// ============================================================================
// SECTION 2: Likelihood bands per prestige tier × bonus split
// ============================================================================

const DEFAULT_DURATION_MONTHS = 24; // 2 seasons

type LikelihoodKey = 'Accept' | 'Counter' | 'Tossup' | 'Reject' | 'Below';

function bandKey(band: LikelihoodBand): LikelihoodKey {
  if (band === 'Likely to accept') return 'Accept';
  if (band === 'Likely to counter') return 'Counter';
  if (band === 'Toss-up') return 'Tossup';
  if (band === 'Likely to reject') return 'Reject';
  return 'Below';
}

type BandCounts = Record<LikelihoodKey, number>;

function makeBandCounts(): BandCounts {
  return { Accept: 0, Counter: 0, Tossup: 0, Reject: 0, Below: 0 };
}

/**
 * Compute likelihood band counts for all sponsors at a given position,
 * using a specific monthlyPayment and signingBonus per sponsor (derived
 * from the sponsor's baseMonthlyPayment).
 */
function computeBandCounts(
  position: number,
  totalTeams: number,
  getTerms: (sponsor: Sponsor) => { monthlyPayment: number; signingBonus: number }
): Record<Tier, BandCounts> {
  const counts: Record<Tier, BandCounts> = {
    title: makeBandCounts(),
    major: makeBandCounts(),
    minor: makeBandCounts(),
  };
  for (const sponsor of sponsors) {
    const tier = sponsor.tier as Tier;
    if (!TIERS.includes(tier)) continue;
    const { monthlyPayment, signingBonus } = getTerms(sponsor);
    const willingMonthly = calculateWillingPayment(sponsor, position, totalTeams);
    const paymentRatio = computePaymentRatio(monthlyPayment, DEFAULT_DURATION_MONTHS, signingBonus, willingMonthly);
    const reputationRatio = computeReputationRatio(position, totalTeams, sponsor.minReputation);
    const isBelowHardGate = reputationRatio < HARD_GATE_MULTIPLIER;
    const isBelowSoftGate = reputationRatio < SOFT_GATE_MULTIPLIER;
    const probs = computeAcceptanceProbabilities(paymentRatio, isBelowHardGate, isBelowSoftGate);
    const band = getLikelihoodBand(probs, isBelowHardGate);
    counts[tier][bandKey(band)]++;
  }
  return counts;
}

type BonusSplit = {
  label: string;
  getTerms: (sponsor: Sponsor) => { monthlyPayment: number; signingBonus: number };
};

// Headline y = m*x + c (no bonus weight) is held constant across splits.
// Default split: monthly=base, bonus=2×base → headline = base*24 + 2*base = 26*base
// Splits A/B/C vary the bonus; monthly is adjusted so headline remains 26*base.
// offeredCost = monthly*24 + bonus*BONUS_WEIGHT differs because BONUS_WEIGHT > 1,
// so higher-bonus splits cost more — verifying the bonus moves the band.

const bonusSplits: BonusSplit[] = [
  {
    label: 'Default (monthly=base, bonus=2×base)',
    getTerms: (s) => ({
      monthlyPayment: s.baseMonthlyPayment,
      signingBonus: s.baseMonthlyPayment * 2,
    }),
  },
  {
    label: 'Split A (bonus=0, monthly adjusted to same headline)',
    getTerms: (s) => {
      // headline = base*24 + 2*base = 26*base; here bonus=0 → monthly = 26*base/24
      const headline = s.baseMonthlyPayment * DEFAULT_DURATION_MONTHS + s.baseMonthlyPayment * 2;
      return {
        monthlyPayment: headline / DEFAULT_DURATION_MONTHS,
        signingBonus: 0,
      };
    },
  },
  {
    label: 'Split B (bonus=1×base, monthly adjusted to same headline)',
    getTerms: (s) => {
      const headline = s.baseMonthlyPayment * DEFAULT_DURATION_MONTHS + s.baseMonthlyPayment * 2;
      return {
        monthlyPayment: (headline - s.baseMonthlyPayment) / DEFAULT_DURATION_MONTHS,
        signingBonus: s.baseMonthlyPayment,
      };
    },
  },
  {
    label: 'Split C (bonus=3×base, monthly adjusted to same headline)',
    getTerms: (s) => {
      const headline = s.baseMonthlyPayment * DEFAULT_DURATION_MONTHS + s.baseMonthlyPayment * 2;
      return {
        monthlyPayment: (headline - s.baseMonthlyPayment * 3) / DEFAULT_DURATION_MONTHS,
        signingBonus: s.baseMonthlyPayment * 3,
      };
    },
  },
];

const BAND_KEYS: LikelihoodKey[] = ['Accept', 'Counter', 'Tossup', 'Reject', 'Below'];

for (const split of bonusSplits) {
  console.log(`\n--- ${split.label} ---\n`);
  console.log(
    'Pos |' +
    ' T:Acc T:Ctr T:Tup T:Rej T:Blw  |' +
    ' M:Acc M:Ctr M:Tup M:Rej M:Blw  |' +
    ' m:Acc m:Ctr m:Tup m:Rej m:Blw'
  );
  const splitDivider = '-'.repeat(4 + 33 + 2 + 33 + 2 + 33);
  console.log(splitDivider);

  for (let pos = 1; pos <= TOTAL_TEAMS; pos++) {
    const counts = computeBandCounts(pos, TOTAL_TEAMS, split.getTerms);
    const fmt = (n: number) => String(n).padStart(5);
    const row = (tier: Tier) => BAND_KEYS.map((k) => fmt(counts[tier][k])).join('');
    console.log(`P${String(pos).padEnd(2)} |${row('title')}  |${row('major')}  |${row('minor')}`);
  }
  console.log(splitDivider);
}

console.log('\nLegend: T=Title  M=Major  m=Minor  Acc=Likely-to-accept  Ctr=Likely-to-counter  Tup=Toss-up  Rej=Likely-to-reject  Blw=Below-requirements\n');
