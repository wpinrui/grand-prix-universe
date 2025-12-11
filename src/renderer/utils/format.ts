/**
 * Shared formatting utilities
 */

import {
  type DriverRole,
  Department,
  StaffQuality,
  ChiefRole,
} from '../../shared/domain';
import { compareSavesByNewest, type SaveSlotInfo } from '../../shared/ipc';
import { formatGameDate, seasonToYear } from '../../shared/utils/date-utils';

// ===========================================
// ROLE & LABEL CONSTANTS
// ===========================================

export const DRIVER_ROLE_LABELS: Record<DriverRole, string> = {
  first: '1st Driver',
  second: '2nd Driver',
  equal: 'Driver',
  test: 'Test Driver',
};

export const DEPARTMENT_LABELS: Record<Department, string> = {
  [Department.Commercial]: 'Commercial',
  [Department.Design]: 'Design',
  [Department.Mechanics]: 'Mechanics',
};

export const CHIEF_ROLE_LABELS: Record<ChiefRole, string> = {
  [ChiefRole.Commercial]: 'Commercial Manager',
  [ChiefRole.Designer]: 'Chief Designer',
  [ChiefRole.Mechanic]: 'Chief Mechanic',
};

export const STAFF_QUALITY_LABELS: Record<StaffQuality, string> = {
  [StaffQuality.Excellent]: 'Excellent',
  [StaffQuality.VeryGood]: 'Very Good',
  [StaffQuality.Good]: 'Good',
  [StaffQuality.Average]: 'Average',
  [StaffQuality.Trainee]: 'Trainee',
};

// ===========================================
// DISPLAY ORDER ARRAYS
// ===========================================

/** Display order for departments (Design first as most important) */
export const DEPARTMENT_ORDER: Department[] = [
  Department.Design,
  Department.Mechanics,
  Department.Commercial,
];

/** Display order for staff quality (best to worst) */
export const STAFF_QUALITY_ORDER: StaffQuality[] = [
  StaffQuality.Excellent,
  StaffQuality.VeryGood,
  StaffQuality.Good,
  StaffQuality.Average,
  StaffQuality.Trainee,
];

/** Display order for chief roles */
export const CHIEF_ROLE_ORDER: ChiefRole[] = [
  ChiefRole.Designer,
  ChiefRole.Mechanic,
  ChiefRole.Commercial,
];

/** Maps ChiefRole to its corresponding Department */
export const ROLE_TO_DEPARTMENT: Record<ChiefRole, Department> = {
  [ChiefRole.Commercial]: Department.Commercial,
  [ChiefRole.Designer]: Department.Design,
  [ChiefRole.Mechanic]: Department.Mechanics,
};

// ===========================================
// NUMBER FORMATTERS
// ===========================================

/**
 * Format a number as an ordinal (e.g., 1st, 2nd, 3rd, 4th)
 */
export function formatOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

/**
 * Pluralize a word based on count (e.g., "1 week", "2 weeks")
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}

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
// CONTRACT FORMATTERS
// ===========================================

/**
 * Format a season number as a contract end date (e.g., "31 Dec 2025")
 */
export function formatContractEnd(seasonNumber: number): string {
  const year = seasonToYear(seasonNumber);
  return `31 Dec ${year}`;
}

/**
 * Format a contract line with salary and end date (e.g., "$1.5M/yr · Contract ends 31 Dec 2025")
 */
export function formatContractLine(salary: number, contractEnd: number): string {
  return `${formatAnnualSalary(salary)} · Contract ends ${formatContractEnd(contractEnd)}`;
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
// HISTORICAL RACE STATUS HELPERS
// ===========================================

/**
 * Check if a historical race status indicates retirement/DNF
 * Used for displaying career history from real F1 data (Ergast API format)
 */
export function isHistoricalRetiredStatus(status: string): boolean {
  return status !== 'Finished' && !status.includes('Lap');
}

/**
 * Get Tailwind classes for historical position styling (career history tables)
 * Matches FIA Results styling with podium colors and points position highlighting
 * @param position - Finishing position (null if DNF)
 * @param status - Ergast API status string
 * @param pointsPositions - Number of positions that score points (default 10 for F1)
 */
export function getHistoricalPositionStyle(
  position: number | null,
  status: string,
  pointsPositions = 10
): string {
  if (isHistoricalRetiredStatus(status)) return 'bg-purple-600/50 text-purple-200';
  if (position === 1) return 'bg-amber-400/80 text-amber-950 font-bold';
  if (position === 2) return 'bg-gray-300/70 text-gray-800 font-bold';
  if (position === 3) return 'bg-orange-500/60 text-orange-100 font-bold';
  if (position !== null && position <= pointsPositions) return 'bg-[#99b382] text-neutral-900';
  return 'bg-[var(--neutral-700)]/50 text-muted';
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
