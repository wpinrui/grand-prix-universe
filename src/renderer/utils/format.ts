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
