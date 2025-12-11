/**
 * Color palette generation utilities using chroma-js
 *
 * Generates Material You-style color palettes from a single primary color.
 * All colors are adjusted to ensure readable contrast.
 */

import chroma from 'chroma-js';

/**
 * Default color when no team is selected (neutral blue)
 */
export const DEFAULT_PRIMARY_COLOR = '#3b82f6';

/**
 * Generated color palette with all theme colors
 */
export interface ColorPalette {
  // Primary accent shades (50 = lightest, 900 = darkest)
  accent50: string;
  accent100: string;
  accent200: string;
  accent300: string;
  accent400: string;
  accent500: string; // The base/primary color (adjusted for good saturation)
  accent600: string;
  accent700: string;
  accent800: string;
  accent900: string;

  // Contrast colors (text that's readable on accent backgrounds)
  accentContrast: string; // For text on accent-500/600
  accentContrastSubtle: string; // For secondary text on accent backgrounds

  // Surface colors (tinted grays for backgrounds)
  surface: string; // Main content background
  surfaceElevated: string; // Cards, modals
  surfaceMuted: string; // Subtle backgrounds
}

/**
 * Get a contrasting text color (white or black) for a given background
 */
function getContrastColor(background: string): string {
  const whiteContrast = chroma.contrast(background, 'white');
  const blackContrast = chroma.contrast(background, 'black');
  return whiteContrast >= blackContrast ? '#ffffff' : '#000000';
}

/**
 * Get a subtle contrast color (slightly transparent) for secondary text
 */
function getSubtleContrastColor(background: string): string {
  const base = getContrastColor(background);
  return base === '#ffffff' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
}

/**
 * Generate a full color palette from a primary color
 */
export function generatePalette(primaryColor: string): ColorPalette {
  // Parse the color and ensure it's valid
  let base: chroma.Color;
  try {
    base = chroma(primaryColor);
  } catch {
    // Fallback to a default blue if invalid color
    base = chroma(DEFAULT_PRIMARY_COLOR);
  }

  // Get HSL values for manipulation
  const [h, s] = base.hsl();
  // Handle achromatic colors (pure black/white have NaN hue and saturation)
  const hue = Number.isNaN(h) ? 0 : h;
  const rawSaturation = Number.isNaN(s) ? 0 : s;

  // Ensure minimum saturation for a vibrant palette
  const saturation = Math.max(rawSaturation, 0.3);

  // Generate shades by adjusting lightness
  // Lighter shades (50-400) go toward white
  // Darker shades (600-900) go toward black
  const createShade = (lightness: number, sat: number = saturation): string => {
    return chroma.hsl(hue, sat, lightness).hex();
  };

  const accent500 = chroma.hsl(hue, saturation, 0.5).hex();

  return {
    // Accent shades - spread across lightness spectrum
    accent50: createShade(0.95, saturation * 0.3),
    accent100: createShade(0.9, saturation * 0.4),
    accent200: createShade(0.8, saturation * 0.6),
    accent300: createShade(0.7, saturation * 0.8),
    accent400: createShade(0.6),
    accent500,
    accent600: createShade(0.45),
    accent700: createShade(0.35),
    accent800: createShade(0.25),
    accent900: createShade(0.15),

    // Contrast colors
    accentContrast: getContrastColor(accent500),
    accentContrastSubtle: getSubtleContrastColor(accent500),

    // Surface colors - very subtle tint of the accent
    surface: createShade(0.08, saturation * 0.1),
    surfaceElevated: createShade(0.12, saturation * 0.15),
    surfaceMuted: createShade(0.06, saturation * 0.05),
  };
}

/**
 * CSS custom property names for each palette key
 */
const PALETTE_TO_CSS_VAR: Record<keyof ColorPalette, string> = {
  accent50: '--accent-50',
  accent100: '--accent-100',
  accent200: '--accent-200',
  accent300: '--accent-300',
  accent400: '--accent-400',
  accent500: '--accent-500',
  accent600: '--accent-600',
  accent700: '--accent-700',
  accent800: '--accent-800',
  accent900: '--accent-900',
  accentContrast: '--accent-contrast',
  accentContrastSubtle: '--accent-contrast-subtle',
  surface: '--surface',
  surfaceElevated: '--surface-elevated',
  surfaceMuted: '--surface-muted',
};

/**
 * Convert palette to CSS custom properties
 */
export function paletteToCssVars(palette: ColorPalette): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(PALETTE_TO_CSS_VAR)) {
    result[cssVar] = palette[key as keyof ColorPalette];
  }
  return result;
}
