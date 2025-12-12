/**
 * Face generation utilities for procedurally generating driver portraits
 * using DiceBear avataaars with nationality-appropriate appearance traits.
 */
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

/**
 * Appearance profile for nationality-based face generation
 * Colors are hex strings without # prefix (DiceBear format)
 */
interface AppearanceProfile {
  skinColors: string[];
  hairColors: string[];
}

/**
 * Simple string hash function for deterministic seeding
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Appearance profiles by regional grouping
// Colors are hex without # prefix for DiceBear
const APPEARANCE_PROFILES: Record<string, AppearanceProfile> = {
  eastAsian: {
    skinColors: ['ffdbb4', 'edb98a', 'd08b5b'],
    hairColors: ['2c1b18', '4a312c'],
  },
  southAsian: {
    skinColors: ['d08b5b', 'ae5d29', 'c68642'],
    hairColors: ['2c1b18', '4a312c'],
  },
  northernEuropean: {
    skinColors: ['ffdbb4', 'edb98a', 'f8d9c4'],
    hairColors: ['b58143', 'd6b370', 'a55728', '2c1b18', '724133', 'c93305'],
  },
  mediterranean: {
    skinColors: ['edb98a', 'd08b5b', 'c68642'],
    hairColors: ['2c1b18', '4a312c', '724133'],
  },
  latinAmerican: {
    skinColors: ['d08b5b', 'c68642', 'ae5d29', 'edb98a'],
    hairColors: ['2c1b18', '4a312c', '724133'],
  },
  african: {
    skinColors: ['ae5d29', '614335', '8d5524'],
    hairColors: ['2c1b18', '4a312c'],
  },
  middleEastern: {
    skinColors: ['c68642', 'd08b5b', 'ae5d29'],
    hairColors: ['2c1b18', '4a312c'],
  },
};

// Map nationality ISO codes to appearance profiles
const NATIONALITY_PROFILE_MAP: Record<string, AppearanceProfile> = {
  // East Asian
  JP: APPEARANCE_PROFILES.eastAsian,
  CN: APPEARANCE_PROFILES.eastAsian,
  KR: APPEARANCE_PROFILES.eastAsian,
  SG: APPEARANCE_PROFILES.eastAsian,
  // South/Southeast Asian
  TH: APPEARANCE_PROFILES.southAsian,
  IN: APPEARANCE_PROFILES.southAsian,
  ID: APPEARANCE_PROFILES.southAsian,
  // Northern European
  GB: APPEARANCE_PROFILES.northernEuropean,
  DE: APPEARANCE_PROFILES.northernEuropean,
  NL: APPEARANCE_PROFILES.northernEuropean,
  BE: APPEARANCE_PROFILES.northernEuropean,
  DK: APPEARANCE_PROFILES.northernEuropean,
  SE: APPEARANCE_PROFILES.northernEuropean,
  NO: APPEARANCE_PROFILES.northernEuropean,
  FI: APPEARANCE_PROFILES.northernEuropean,
  IE: APPEARANCE_PROFILES.northernEuropean,
  AT: APPEARANCE_PROFILES.northernEuropean,
  CH: APPEARANCE_PROFILES.northernEuropean,
  PL: APPEARANCE_PROFILES.northernEuropean,
  CZ: APPEARANCE_PROFILES.northernEuropean,
  RU: APPEARANCE_PROFILES.northernEuropean,
  BG: APPEARANCE_PROFILES.northernEuropean,
  AU: APPEARANCE_PROFILES.northernEuropean,
  NZ: APPEARANCE_PROFILES.northernEuropean,
  US: APPEARANCE_PROFILES.northernEuropean,
  CA: APPEARANCE_PROFILES.northernEuropean,
  // Mediterranean
  IT: APPEARANCE_PROFILES.mediterranean,
  ES: APPEARANCE_PROFILES.mediterranean,
  PT: APPEARANCE_PROFILES.mediterranean,
  FR: APPEARANCE_PROFILES.mediterranean,
  MC: APPEARANCE_PROFILES.mediterranean,
  GR: APPEARANCE_PROFILES.mediterranean,
  // Latin American
  BR: APPEARANCE_PROFILES.latinAmerican,
  MX: APPEARANCE_PROFILES.latinAmerican,
  AR: APPEARANCE_PROFILES.latinAmerican,
  CO: APPEARANCE_PROFILES.latinAmerican,
  VE: APPEARANCE_PROFILES.latinAmerican,
  PE: APPEARANCE_PROFILES.latinAmerican,
  PY: APPEARANCE_PROFILES.latinAmerican,
  // African/Caribbean
  BB: APPEARANCE_PROFILES.african,
  // Middle Eastern
  AE: APPEARANCE_PROFILES.middleEastern,
  SA: APPEARANCE_PROFILES.middleEastern,
};

// Professional-only options for avataaars (no wacky expressions)
const PROFESSIONAL_EYES = ['default', 'happy', 'squint'] as const;
const PROFESSIONAL_EYEBROWS = ['default', 'defaultNatural', 'flatNatural', 'raisedExcitedNatural'] as const;
const PROFESSIONAL_MOUTH = ['default', 'smile', 'serious', 'twinkle'] as const;
// Valid hair styles from DiceBear avataaars
const PROFESSIONAL_TOP = [
  'shortFlat',
  'shortWaved',
  'shortCurly',
  'shortRound',
  'theCaesar',
  'theCaesarAndSidePart',
  'dreads01',
  'frizzle',
] as const;

// Light facial hair options (professional stubble/beard look)
// Note: avataaars doesn't have 'blank' - we use facialHairProbability instead
const FACIAL_HAIR_OPTIONS = ['beardLight', 'beardMedium', 'moustacheFancy'] as const;

/**
 * Team colors for racing suit
 */
export interface TeamColors {
  primary: string;
  secondary: string;
}

/** Default colors for free agents without a team */
export const FREE_AGENT_COLORS: TeamColors = {
  primary: '#555555',
  secondary: '#333333',
};

/**
 * Convert hex color to DiceBear format (without #)
 */
function hexToDiceBear(hex: string): string {
  return hex.replace('#', '');
}

/**
 * Generates a face SVG string.
 * Uses deterministic seeding based on the provided ID for consistent results.
 *
 * @param id - Unique identifier used for deterministic seeding
 * @param nationality - ISO country code for nationality-appropriate appearance
 * @param teamColors - Team colors for the clothing
 * @returns SVG string of the generated face
 */
export function generateFaceSvg(
  id: string,
  nationality: string,
  teamColors: TeamColors
): string {
  const seed = hashString(id);
  const profile = NATIONALITY_PROFILE_MAP[nationality] ?? APPEARANCE_PROFILES.northernEuropean;

  // Use seed to deterministically pick from arrays
  const skinColor = profile.skinColors[seed % profile.skinColors.length];
  const hairColor = profile.hairColors[seed % profile.hairColors.length];
  const eyes = PROFESSIONAL_EYES[seed % PROFESSIONAL_EYES.length];
  const eyebrows = PROFESSIONAL_EYEBROWS[(seed >> 2) % PROFESSIONAL_EYEBROWS.length];
  const mouth = PROFESSIONAL_MOUTH[(seed >> 4) % PROFESSIONAL_MOUTH.length];
  const top = PROFESSIONAL_TOP[(seed >> 6) % PROFESSIONAL_TOP.length];
  const facialHair = FACIAL_HAIR_OPTIONS[(seed >> 8) % FACIAL_HAIR_OPTIONS.length];

  // Determine if this person has facial hair (50% chance based on seed)
  const hasFacialHair = (seed >> 10) % 2 === 0;

  const avatar = createAvatar(avataaars, {
    seed: id,
    skinColor: [skinColor],
    hairColor: [hairColor],
    top: [top],
    eyes: [eyes],
    eyebrows: [eyebrows],
    mouth: [mouth],
    facialHair: [facialHair],
    facialHairProbability: hasFacialHair ? 100 : 0,
    facialHairColor: [hairColor],
    clothing: ['shirtCrewNeck'],
    clothesColor: [hexToDiceBear(teamColors.primary)],
    accessoriesProbability: 0,
    backgroundColor: ['transparent'],
  });

  return avatar.toString();
}

/**
 * Generates a face as a data URI for use in img src.
 * Uses deterministic seeding based on the provided ID for consistent results.
 *
 * @param id - Unique identifier used for deterministic seeding
 * @param nationality - ISO country code for nationality-appropriate appearance
 * @param teamColors - Team colors for the clothing
 * @returns Data URI string of the generated face SVG
 */
export function generateFaceDataUri(
  id: string,
  nationality: string,
  teamColors: TeamColors
): string {
  const svg = generateFaceSvg(id, nationality, teamColors);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
