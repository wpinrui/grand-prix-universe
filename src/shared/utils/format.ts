/**
 * Shared formatting utilities used by both main and renderer processes
 */

import { ChiefRole, Department, DriverRole, StaffQuality } from '../domain';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Interface for any object with firstName and lastName properties
 * Works with Driver, Chief, or any similar entity
 */
export interface HasName {
  firstName: string;
  lastName: string;
}

// =============================================================================
// NAME FORMATTING
// =============================================================================

/**
 * Get full name from any object with firstName and lastName
 * Replaces the repeated `${person.firstName} ${person.lastName}` pattern
 */
export function getFullName(person: HasName): string {
  return `${person.firstName} ${person.lastName}`;
}

// =============================================================================
// ROLE & LABEL CONSTANTS
// =============================================================================

export const DRIVER_ROLE_LABELS: Record<DriverRole, string> = {
  [DriverRole.First]: '1st Driver',
  [DriverRole.Second]: '2nd Driver',
  [DriverRole.Equal]: 'Driver',
  [DriverRole.Test]: 'Test Driver',
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
