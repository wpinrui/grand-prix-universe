/**
 * Team theme hook
 *
 * Generates a color palette from the player's team primary color
 * and applies it as CSS custom properties on the document root.
 */

import { useEffect } from 'react';
import {
  generatePalette,
  paletteToCssVars,
  DEFAULT_PRIMARY_COLOR,
} from '../utils/color-palette';

/**
 * Apply team-based theming to the entire app.
 * Sets CSS custom properties on :root based on the team's primary color.
 *
 * @param primaryColor - The team's primary color (hex). Falls back to default if null.
 */
export function useTeamTheme(primaryColor: string | null): void {
  useEffect(() => {
    const color = primaryColor ?? DEFAULT_PRIMARY_COLOR;
    const palette = generatePalette(color);
    const cssVars = paletteToCssVars(palette);

    // Apply all CSS variables to document root
    const root = document.documentElement;
    for (const [property, value] of Object.entries(cssVars)) {
      root.style.setProperty(property, value);
    }

    // Cleanup: remove CSS variables when component unmounts
    return () => {
      for (const property of Object.keys(cssVars)) {
        root.style.removeProperty(property);
      }
    };
  }, [primaryColor]);
}
