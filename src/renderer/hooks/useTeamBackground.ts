/// <reference types="vite/client" />
import { useMemo } from 'react';

/**
 * Special team ID that selects from ALL available backgrounds.
 * Use this for screens that aren't team-specific (title, name entry, etc.)
 */
export const TEAM_ID_ALL = 'all';

/** Folder name for generic (non-team-specific) backgrounds */
const GENERIC_FOLDER = 'generic';

// Import all background images using Vite's glob import
// This creates a map of path -> module
// @ts-expect-error - import.meta.glob is a Vite-specific feature handled at build time
const backgroundModules: Record<string, { default: string }> = import.meta.glob(
  '../assets/backgrounds/**/*.{jpg,jpeg,png}',
  { eager: true }
);

// Parse the imported modules into a structured format
interface BackgroundImages {
  [teamId: string]: string[];
}

function getBackgroundImages(): BackgroundImages {
  const images: BackgroundImages = {};

  for (const [path, module] of Object.entries(backgroundModules)) {
    // Path format: ../assets/backgrounds/{teamId}/{filename}.jpg
    const match = path.match(/\/backgrounds\/([^/]+)\//);
    if (match) {
      const teamId = match[1];
      if (!images[teamId]) {
        images[teamId] = [];
      }
      images[teamId].push(module.default);
    }
  }

  return images;
}

// Cache the parsed images
const BACKGROUND_IMAGES = getBackgroundImages();

// Session storage key for persisting background selection
const STORAGE_KEY = 'gpu-team-background';

interface StoredBackground {
  teamId: string;
  imageUrl: string;
}

function getStoredBackground(): StoredBackground | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

function storeBackground(teamId: string, imageUrl: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ teamId, imageUrl }));
  } catch {
    // Ignore storage errors
  }
}

// Cache all backgrounds flattened (for 'all' queries)
const ALL_BACKGROUNDS = Object.values(BACKGROUND_IMAGES).flat();

/**
 * Get available backgrounds for a team.
 * - 'all' returns all backgrounds
 * - Specific team ID returns team + generic backgrounds
 */
function getBackgroundsForTeam(teamId: string): string[] {
  if (teamId === TEAM_ID_ALL) {
    return ALL_BACKGROUNDS;
  }
  const teamBackgrounds = BACKGROUND_IMAGES[teamId] ?? [];
  const genericBackgrounds = BACKGROUND_IMAGES[GENERIC_FOLDER] ?? [];
  return [...teamBackgrounds, ...genericBackgrounds];
}

/**
 * Hook to get a random team background image.
 * - Selects randomly from team-specific + generic backgrounds
 * - Persists selection in sessionStorage for consistency
 *
 * @param teamId - Team ID, or 'all' for any image, or null for no background
 */
export function useTeamBackground(teamId: string | null): string | null {
  return useMemo(() => {
    if (!teamId) return null;

    // Check if we have a stored background for this key
    const stored = getStoredBackground();
    if (stored && stored.teamId === teamId) {
      return stored.imageUrl;
    }

    const backgrounds = getBackgroundsForTeam(teamId);

    if (backgrounds.length === 0) {
      return null;
    }

    // Select a random background
    const randomIndex = Math.floor(Math.random() * backgrounds.length);
    const selectedImage = backgrounds[randomIndex];

    // Persist the selection
    storeBackground(teamId, selectedImage);

    return selectedImage;
  }, [teamId]);
}
