/**
 * Shared formatting utilities
 */

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
