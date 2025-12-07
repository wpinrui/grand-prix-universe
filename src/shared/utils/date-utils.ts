/**
 * Date Utilities for Grand Prix Universe
 *
 * Provides conversion between GameDate (day/month/year) and week numbers.
 * Used for race scheduling (still week-based) while UI shows actual dates.
 */

import type { GameDate } from '../domain/types';

/** Base year that season 1 maps to */
export const BASE_YEAR = 1998;

/** Days per month (non-leap year) */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return DAYS_IN_MONTH[month - 1];
}

/**
 * Get the day of year (1-366) for a GameDate
 */
export function getDayOfYear(date: GameDate): number {
  let dayOfYear = date.day;
  for (let m = 1; m < date.month; m++) {
    dayOfYear += getDaysInMonth(date.year, m);
  }
  return dayOfYear;
}

/**
 * Get the week number (1-52) for a GameDate
 * Week 1 starts on January 1st
 */
export function getWeekNumber(date: GameDate): number {
  const dayOfYear = getDayOfYear(date);
  return Math.ceil(dayOfYear / 7);
}

/**
 * Convert season number to calendar year
 */
export function seasonToYear(season: number): number {
  return BASE_YEAR + season - 1;
}

/**
 * Convert calendar year to season number
 */
export function yearToSeason(year: number): number {
  return year - BASE_YEAR + 1;
}

/**
 * Create a GameDate from year, month, day
 */
export function createGameDate(year: number, month: number, day: number): GameDate {
  return { year, month, day };
}

/**
 * Create a GameDate from season and week (for backward compatibility)
 * Places the date at the start of that week (Monday)
 */
export function createGameDateFromSeasonWeek(season: number, week: number): GameDate {
  const year = seasonToYear(season);
  // Week 1 starts Jan 1, so week N starts on day (N-1)*7 + 1
  let dayOfYear = (week - 1) * 7 + 1;

  // Convert day of year to month/day
  let month = 1;
  while (dayOfYear > getDaysInMonth(year, month)) {
    dayOfYear -= getDaysInMonth(year, month);
    month++;
  }

  return { year, month, day: dayOfYear };
}

/**
 * Advance a GameDate by one day
 */
export function advanceDay(date: GameDate): GameDate {
  let { year, month, day } = date;
  const daysInMonth = getDaysInMonth(year, month);

  day++;
  if (day > daysInMonth) {
    day = 1;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return { year, month, day };
}

/**
 * Get day of week (1-7, Monday=1, Sunday=7)
 * Uses Zeller's formula
 */
export function getDayOfWeek(date: GameDate): number {
  let { year, month } = date;
  const { day } = date;

  // Adjust for Zeller's formula (Jan/Feb are months 13/14 of previous year)
  if (month < 3) {
    month += 12;
    year--;
  }

  const k = year % 100;
  const j = Math.floor(year / 100);

  // Zeller's formula gives 0=Saturday, 1=Sunday, ..., 6=Friday
  const h = (day + Math.floor((13 * (month + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7;

  // Convert to 1=Monday, 7=Sunday
  return ((h + 5) % 7) + 1;
}

/**
 * Check if a date is a Friday (day 5)
 */
export function isFriday(date: GameDate): boolean {
  return getDayOfWeek(date) === 5;
}

/**
 * Format a GameDate for display (e.g., "15 March 1998")
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatGameDate(date: GameDate): string {
  return `${date.day} ${MONTH_NAMES[date.month - 1]} ${date.year}`;
}

/**
 * Format a GameDate for short display (e.g., "15 Mar")
 */
const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatGameDateShort(date: GameDate): string {
  return `${date.day} ${MONTH_SHORT_NAMES[date.month - 1]}`;
}

/**
 * Default pre-season start date (January 1st of season year)
 */
export function getPreSeasonStartDate(season: number): GameDate {
  return createGameDate(seasonToYear(season), 1, 1);
}

/**
 * Default simulation state
 */
export const DEFAULT_SIMULATION_STATE = {
  isSimulating: false,
  speed: 1, // 1 day per second
};
