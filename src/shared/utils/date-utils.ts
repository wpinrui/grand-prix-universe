/**
 * Date Utilities for Grand Prix Universe
 *
 * Provides conversion between GameDate (day/month/year) and week numbers.
 * Used for race scheduling (still week-based) while UI shows actual dates.
 */

import type { GameDate, SimulationState } from '../domain/types';

/** Base year that season 1 maps to */
export const BASE_YEAR = 2025;

/** Days per month (non-leap year) */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Full month names for display */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Short month names for calendar strip */
const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Short day names (Monday = 1) */
const SHORT_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day of week constants (1=Monday, 7=Sunday) */
export const DayOfWeek = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
} as const;

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
 * Get the week number (1-53) for a GameDate
 * Week 1 starts on January 1st; week 53 possible in late December
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
 * Check if a date is a Friday
 */
export function isFriday(date: GameDate): boolean {
  return getDayOfWeek(date) === DayOfWeek.Friday;
}

/**
 * Format a GameDate for display (e.g., "15 March 2025")
 */
export function formatGameDate(date: GameDate): string {
  return `${date.day} ${MONTH_NAMES[date.month - 1]} ${date.year}`;
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
export const DEFAULT_SIMULATION_STATE: SimulationState = {
  isSimulating: false,
  speed: 1, // 1 day per second
};

/**
 * Subtract one day from a GameDate
 */
export function subtractDay(date: GameDate): GameDate {
  let { year, month, day } = date;

  day--;
  if (day < 1) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    day = getDaysInMonth(year, month);
  }

  return { year, month, day };
}

/**
 * Get short weekday name (Mon, Tue, etc.)
 */
export function getShortDayName(date: GameDate): string {
  const dayOfWeek = getDayOfWeek(date);
  return SHORT_DAY_NAMES[dayOfWeek - 1];
}

/**
 * Get short month name (Jan, Feb, etc.)
 */
export function getShortMonthName(date: GameDate): string {
  return SHORT_MONTH_NAMES[date.month - 1];
}

/**
 * Check if two GameDates are the same day
 */
export function isSameDay(a: GameDate, b: GameDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Get array of days for the calendar strip
 * Returns 9 days: 1 past, current, 7 future
 */
export function getCalendarStripDays(currentDate: GameDate): GameDate[] {
  const days: GameDate[] = [];

  // 1 day in the past
  days.push(subtractDay(currentDate));

  // Current day
  days.push(currentDate);

  // 7 days in the future
  let nextDay = currentDate;
  for (let i = 0; i < 7; i++) {
    nextDay = advanceDay(nextDay);
    days.push(nextDay);
  }

  return days;
}
