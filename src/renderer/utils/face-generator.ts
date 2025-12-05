/**
 * Face generation utilities for procedurally generating driver portraits
 * using facesjs with nationality-appropriate appearance traits.
 */
import { display, generate } from 'facesjs';

/**
 * Appearance profile for nationality-based face generation
 */
interface AppearanceProfile {
  skinColors: string[];
  hairColors: string[];
}

/**
 * Simple string hash function for deterministic seeding
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Creates a seeded random number generator for consistent face generation
 */
export function seededRandom(seed: number): () => number {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Appearance profiles by regional grouping
const APPEARANCE_PROFILES: Record<string, AppearanceProfile> = {
  eastAsian: {
    skinColors: ['#f5e1d0', '#ecd4c0', '#e8c9a8', '#dfc19d'],
    hairColors: ['#090806', '#1c1c1c', '#2a2a2a', '#0f0f0f'],
  },
  southAsian: {
    skinColors: ['#c9a16a', '#b8935a', '#a67c52', '#c4a574'],
    hairColors: ['#090806', '#1c1c1c', '#2a2a2a'],
  },
  northernEuropean: {
    skinColors: ['#ffe0c0', '#ffd5b5', '#ffccaa', '#f5d0b0'],
    hairColors: ['#b89778', '#a67b5b', '#8b7355', '#3b3024', '#1c1c1c', '#d4a76a'],
  },
  mediterranean: {
    skinColors: ['#e8c9a8', '#d4a574', '#c9a16a', '#deb887'],
    hairColors: ['#2a2a2a', '#3b3024', '#1c1c1c', '#4a3728'],
  },
  latinAmerican: {
    skinColors: ['#d4a574', '#c9a16a', '#b8935a', '#deb887', '#e8c9a8'],
    hairColors: ['#1c1c1c', '#2a2a2a', '#3b3024', '#090806'],
  },
  african: {
    skinColors: ['#8d5524', '#6b4226', '#5a3825', '#704020'],
    hairColors: ['#090806', '#0f0f0f', '#1c1c1c'],
  },
  middleEastern: {
    skinColors: ['#c9a16a', '#b8935a', '#d4a574', '#c4a574'],
    hairColors: ['#090806', '#1c1c1c', '#2a2a2a'],
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

/**
 * Pick item from array using seeded random
 */
function pickFromArray<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

// Seed offset to ensure facesjs internal randomization uses different sequence than appearance selection
const FACEJS_SEED_OFFSET = 1000;

/**
 * Generates a face into the provided container element.
 * Uses deterministic seeding based on the provided ID for consistent results.
 *
 * @param container - The DOM element to render the face into
 * @param id - Unique identifier used for deterministic seeding
 * @param nationality - ISO country code for nationality-appropriate appearance
 * @param size - Width and height of the rendered face (default: 64)
 */
export function generateFace(
  container: HTMLElement,
  id: string,
  nationality: string,
  size = 64
): void {
  const seed = hashString(id);
  const rand = seededRandom(seed);

  const profile = NATIONALITY_PROFILE_MAP[nationality] || APPEARANCE_PROFILES.northernEuropean;
  const skinColor = pickFromArray(profile.skinColors, rand);
  const hairColor = pickFromArray(profile.hairColors, rand);

  // Temporarily override Math.random for facesjs internal randomization
  const originalRandom = Math.random;
  Math.random = seededRandom(seed + FACEJS_SEED_OFFSET);

  try {
    const face = generate({
      body: { color: skinColor },
      hair: { color: hairColor },
      head: { shave: `rgba(0,0,0,${0.05 + rand() * 0.15})` },
    });
    display(container, face, { width: size, height: size });
  } finally {
    Math.random = originalRandom;
  }
}
