import { useMemo } from 'react';

// Import all background images using Vite's glob import
// This creates a map of path -> module
const backgroundModules = import.meta.glob<{ default: string }>(
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

    let backgrounds: string[];

    if (teamId === 'all') {
      // Use all available images
      backgrounds = ALL_BACKGROUNDS;
    } else {
      // Combine team-specific and generic backgrounds
      const teamBackgrounds = BACKGROUND_IMAGES[teamId] ?? [];
      const genericBackgrounds = BACKGROUND_IMAGES['generic'] ?? [];
      backgrounds = [...teamBackgrounds, ...genericBackgrounds];
    }

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
