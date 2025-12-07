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

/**
 * Country name to emoji flag mapping
 * Uses regional indicator symbols to form flag emojis
 */
const COUNTRY_TO_CODE: Record<string, string> = {
  'Australia': 'AU',
  'Austria': 'AT',
  'Azerbaijan': 'AZ',
  'Bahrain': 'BH',
  'Belgium': 'BE',
  'Brazil': 'BR',
  'Canada': 'CA',
  'China': 'CN',
  'France': 'FR',
  'Germany': 'DE',
  'Hungary': 'HU',
  'Italy': 'IT',
  'Japan': 'JP',
  'Mexico': 'MX',
  'Monaco': 'MC',
  'Netherlands': 'NL',
  'Portugal': 'PT',
  'Qatar': 'QA',
  'Russia': 'RU',
  'Saudi Arabia': 'SA',
  'Singapore': 'SG',
  'Spain': 'ES',
  'Turkey': 'TR',
  'UAE': 'AE',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  'UK': 'GB',
  'United States': 'US',
  'USA': 'US',
};

/**
 * Get emoji flag for a country name
 */
export function getCountryFlag(country: string): string {
  const code = COUNTRY_TO_CODE[country];
  if (!code) return '🏁'; // Default racing flag if country not found

  // Convert country code to regional indicator symbols
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/** Race weekend session types */
export type RaceSessionType = 'Practice' | 'Qualifying' | 'Race';

/**
 * Get the Friday of a given week number for a year
 * Week 1 contains January 1st
 */
export function getFridayOfWeek(year: number, weekNumber: number): GameDate {
  // Start from Jan 1st
  let date = createGameDate(year, 1, 1);

  // Move to the correct week (week 1 = days 1-7, etc.)
  const targetDayOfYear = (weekNumber - 1) * 7 + 1;
  for (let d = 1; d < targetDayOfYear; d++) {
    date = advanceDay(date);
  }

  // Now find Friday of this week
  const currentDayOfWeek = getDayOfWeek(date);
  let daysToFriday = DayOfWeek.Friday - currentDayOfWeek;
  if (daysToFriday < 0) daysToFriday += 7;

  for (let d = 0; d < daysToFriday; d++) {
    date = advanceDay(date);
  }

  return date;
}

/**
 * Check if a date falls on a race weekend (Fri/Sat/Sun) for a given race week
 * Returns the session type if it does, null otherwise
 */
export function getRaceSessionForDate(
  date: GameDate,
  raceWeekNumber: number
): RaceSessionType | null {
  const friday = getFridayOfWeek(date.year, raceWeekNumber);
  const saturday = advanceDay(friday);
  const sunday = advanceDay(saturday);

  if (isSameDay(date, friday)) return 'Practice';
  if (isSameDay(date, saturday)) return 'Qualifying';
  if (isSameDay(date, sunday)) return 'Race';

  return null;
}

/**
 * Calculate days between two GameDates (b - a)
 * Returns positive if b is after a, negative if before
 */
export function daysBetween(a: GameDate, b: GameDate): number {
  const daysInYearA = isLeapYear(a.year) ? 366 : 365;
  const daysInYearB = isLeapYear(b.year) ? 366 : 365;

  if (a.year === b.year) {
    return getDayOfYear(b) - getDayOfYear(a);
  }

  // Different years - calculate through year boundaries
  let days = 0;

  if (b.year > a.year) {
    // Days remaining in year a
    days += daysInYearA - getDayOfYear(a);
    // Full years between
    for (let y = a.year + 1; y < b.year; y++) {
      days += isLeapYear(y) ? 366 : 365;
    }
    // Days into year b
    days += getDayOfYear(b);
  } else {
    // b is before a (negative result)
    days -= daysInYearB - getDayOfYear(b);
    for (let y = b.year + 1; y < a.year; y++) {
      days -= isLeapYear(y) ? 366 : 365;
    }
    days -= getDayOfYear(a);
  }

  return days;
}

/**
 * Get the Sunday (race day) of a race week
 */
export function getRaceSunday(year: number, weekNumber: number): GameDate {
  const friday = getFridayOfWeek(year, weekNumber);
  return advanceDay(advanceDay(friday));
}
