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
  getReputationStanding,
} from '../src/shared/domain/sponsor-probability';

const sponsorsPath = path.join(__dirname, '../data/content/sponsors.json');
const { sponsors } = JSON.parse(fs.readFileSync(sponsorsPath, 'utf-8')) as {
  sponsors: Array<{ id: string; name: string; tier: string; minReputation: number }>;
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
