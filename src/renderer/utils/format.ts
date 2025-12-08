/**
 * Shared formatting utilities
 */

import type { DriverRole } from '../../shared/domain';
import type { SaveSlotInfo } from '../../shared/ipc';

// ===========================================
// DRIVER ROLE LABELS
// ===========================================

export const DRIVER_ROLE_LABELS: Record<DriverRole, string> = {
  first: '1st Driver',
  second: '2nd Driver',
  equal: 'Driver',
  test: 'Test Driver',
};

// ===========================================
// CURRENCY FORMATTERS
// ===========================================

/**
 * Format a number as USD currency (e.g., $1,000,000)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number in compact form (e.g., 1.5M, 500K)
 */
export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `${(amount / 1_000).toFixed(0)}K`;
}

/**
 * Format annual salary (e.g., $1.5M/yr)
 */
export function formatAnnualSalary(amount: number): string {
  return `$${formatCompact(amount)}/yr`;
}

// ===========================================
// DATE/TIME FORMATTERS
// ===========================================

/**
 * Format an ISO date string as a readable date/time (e.g., "Dec 6, 2025 at 3:45 PM")
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ===========================================
// SAVE FILE FORMATTERS
// ===========================================

/**
 * Format a save's display name (e.g., "Ferrari - John Smith")
 */
export function getSaveDisplayName(save: SaveSlotInfo): string {
  return `${save.teamName} - ${save.playerName}`;
}

// ===========================================
// SAVE GROUPING
// ===========================================

/**
 * A group of saves from the same playthrough
 */
export interface SaveGroup {
  gameId: string;
  /** Most recent non-autosave, or most recent autosave if no manual saves exist */
  primary: SaveSlotInfo;
  /** All autosaves for this game, sorted newest first */
  autosaves: SaveSlotInfo[];
}

/**
 * Groups saves by gameId.
 * - Saves with the same gameId are grouped together
 * - Legacy saves (empty gameId) are each treated as their own group
 * - Primary save is the most recent manual save, or most recent autosave if no manual saves
 * - Autosaves are collected separately for the dropdown
 */
export function groupSavesByGame(saves: SaveSlotInfo[]): SaveGroup[] {
  // First, separate by gameId
  const groupMap = new Map<string, SaveSlotInfo[]>();

  for (const save of saves) {
    // Treat each legacy save as its own unique group
    const key = save.gameId || `legacy-${save.filename}`;
    const existing = groupMap.get(key) ?? [];
    existing.push(save);
    groupMap.set(key, existing);
  }

  // Build SaveGroup for each group
  const groups: SaveGroup[] = [];

  for (const [gameId, gameSaves] of groupMap.entries()) {
    // Sort by savedAt (newest first) - already sorted from backend but be safe
    gameSaves.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );

    // Separate manual saves and autosaves
    const manualSaves = gameSaves.filter((s) => !s.isAutosave);
    const autosaves = gameSaves.filter((s) => s.isAutosave);

    // Primary is most recent manual save, or most recent autosave if no manual saves
    const primary = manualSaves[0] ?? autosaves[0];

    groups.push({
      gameId: gameId.startsWith('legacy-') ? '' : gameId,
      primary,
      autosaves,
    });
  }

  // Sort groups by most recent primary save
  groups.sort(
    (a, b) =>
      new Date(b.primary.savedAt).getTime() - new Date(a.primary.savedAt).getTime()
  );

  return groups;
}
