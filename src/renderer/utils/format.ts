/**
 * Shared formatting utilities
 */

import type { DriverRole } from '../../shared/domain';
import { compareSavesByNewest, type SaveSlotInfo } from '../../shared/ipc';
import { formatGameDate } from '../../shared/utils/date-utils';

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

/**
 * Format a save's in-game date (e.g., "15 March 2025 (in-game)")
 */
export function formatInGameDate(save: SaveSlotInfo): string {
  return `${formatGameDate(save.currentDate)} (in-game)`;
}

/**
 * Format a save's real-world saved date (e.g., "Saved Dec 8, 2025 at 3:45 PM")
 */
export function formatSavedAt(save: SaveSlotInfo): string {
  return `Saved ${formatDateTime(save.savedAt)}`;
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
  /** All saves except primary, sorted newest first (includes both manual and autosaves) */
  history: SaveSlotInfo[];
}

/**
 * Groups saves by gameId.
 * - Saves with the same gameId are grouped together
 * - Primary save is the most recent manual save, or most recent autosave if no manual saves
 * - History contains all other saves (both manual and autosaves)
 */
export function groupSavesByGame(saves: SaveSlotInfo[]): SaveGroup[] {
  // Group by gameId
  const groupMap = new Map<string, SaveSlotInfo[]>();

  for (const save of saves) {
    const existing = groupMap.get(save.gameId) ?? [];
    existing.push(save);
    groupMap.set(save.gameId, existing);
  }

  // Build SaveGroup for each group
  const groups: SaveGroup[] = [];

  for (const [gameId, gameSaves] of groupMap.entries()) {
    gameSaves.sort(compareSavesByNewest);

    // Primary is most recent manual save, or most recent autosave if no manual saves
    const manualSaves = gameSaves.filter((s) => !s.isAutosave);
    const primary = manualSaves[0] ?? gameSaves[0];

    // History is all saves except primary
    const history = gameSaves.filter((s) => s.filename !== primary.filename);

    groups.push({ gameId, primary, history });
  }

  // Sort groups by most recent primary save
  groups.sort((a, b) => compareSavesByNewest(a.primary, b.primary));

  return groups;
}
