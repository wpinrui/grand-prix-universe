/**
 * Color palette generation utilities using chroma-js
 *
 * Generates Material You-style color palettes from a single primary color.
 * All colors are adjusted to ensure readable contrast.
 */

import chroma from 'chroma-js';

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
    base = chroma('#3b82f6');
  }

  // Get HSL values for manipulation
  const [h, s] = base.hsl();
  const hue = Number.isNaN(h) ? 0 : h; // Handle achromatic colors

  // Ensure minimum saturation for a vibrant palette
  const saturation = Math.max(s, 0.3);

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
 * Convert palette to CSS custom properties
 */
export function paletteToCssVars(palette: ColorPalette): Record<string, string> {
  return {
    '--accent-50': palette.accent50,
    '--accent-100': palette.accent100,
    '--accent-200': palette.accent200,
    '--accent-300': palette.accent300,
    '--accent-400': palette.accent400,
    '--accent-500': palette.accent500,
    '--accent-600': palette.accent600,
    '--accent-700': palette.accent700,
    '--accent-800': palette.accent800,
    '--accent-900': palette.accent900,
    '--accent-contrast': palette.accentContrast,
    '--accent-contrast-subtle': palette.accentContrastSubtle,
    '--surface': palette.surface,
    '--surface-elevated': palette.surfaceElevated,
    '--surface-muted': palette.surfaceMuted,
  };
}
