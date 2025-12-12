/// <reference types="vite/client" />

// Import all team logos using Vite's glob import
// @ts-expect-error - import.meta.glob is a Vite-specific feature handled at build time
const logoModules: Record<string, { default: string }> = import.meta.glob(
  '../assets/logos/*.webp',
  { eager: true }
);

// Parse into team ID -> logo URL map
const teamLogos: Record<string, string> = {};

for (const [path, module] of Object.entries(logoModules)) {
  // Path format: ../assets/logos/{teamId}.webp
  const match = path.match(/\/logos\/([^/]+)\.webp$/);
  if (match) {
    const teamId = match[1];
    teamLogos[teamId] = module.default;
  }
}

/**
 * Get the logo URL for a team by ID.
 * Returns undefined if no logo found.
 */
export function getTeamLogo(teamId: string): string | undefined {
  return teamLogos[teamId];
}
