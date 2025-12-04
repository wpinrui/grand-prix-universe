/**
 * Core domain types for Grand Prix Universe
 * All rating attributes use 0-100 scale unless otherwise noted
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum Department {
  Commercial = 'commercial',
  Design = 'design',
  Engineering = 'engineering',
  Mechanics = 'mechanics',
}

export enum StaffQuality {
  Trainee = 'trainee',
  Average = 'average',
  Good = 'good',
  VeryGood = 'very-good',
  Excellent = 'excellent',
}

export enum TyreCompound {
  DryHard = 'dry-hard',
  DrySoft = 'dry-soft',
  Intermediate = 'intermediate',
  Wet = 'wet',
}

export enum DriverRole {
  First = 'first',
  Second = 'second',
  Equal = 'equal',
  Test = 'test',
}

export enum ChiefRole {
  Designer = 'designer',
  TechnicalDirector = 'technical-director',
  Mechanic = 'mechanic',
  Commercial = 'commercial',
}

export enum SponsorTier {
  Title = 'title', // Name prefixed to team name (e.g., "Oracle Red Bull Racing")
  Major = 'major', // Significant logo placement, good money
  Minor = 'minor', // Small cash sponsors, logo on car
}

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Team - The central entity representing an F1 team
 */
export interface Team {
  id: string; // kebab-case slug, e.g. "phoenix-racing"
  name: string;
  shortName: string; // 3-letter abbreviation, e.g. "PHX"
  primaryColor: string; // hex color for UI theming
  secondaryColor: string;
  headquarters: string; // country/location
  budget: number; // current balance in dollars
  factoryLevel: number; // 0-100, affects staff/facility limits
}

/**
 * Driver attributes - all 0-100 scale
 */
export interface DriverAttributes {
  pace: number; // 1-lap qualifying speed
  consistency: number; // smaller gap between worst/best variation
  focus: number; // ability to avoid mistakes (incl. terminal crashes)
  overtaking: number; // overtake success rate relative to pace advantage
  wetWeather: number; // performance in rain conditions
  smoothness: number; // lower tyre/component wear per push level
  defending: number; // defense success rate relative to pace disadvantage
}

/**
 * Driver - A racing driver or test driver
 */
export interface Driver {
  id: string; // kebab-case slug
  firstName: string;
  lastName: string;
  nationality: string; // country code, e.g. "GB", "DE"
  dateOfBirth: string; // ISO date string
  teamId: string | null; // null if free agent
  role: DriverRole;
  attributes: DriverAttributes;
  reputation: number; // 0-100, market value (results-biased, recency-biased)
  salary: number; // per-season salary in dollars
  contractEnd: number; // season number when contract expires
}

/**
 * Staff - General team personnel (non-chief, non-driver)
 */
export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  department: Department;
  quality: StaffQuality;
  teamId: string | null;
  salary: number;
  contractEnd: number;
}

/**
 * Chief - Department head with significant impact on team performance
 */
export interface Chief {
  id: string;
  firstName: string;
  lastName: string;
  role: ChiefRole;
  ability: number; // 0-100, critical to department performance
  teamId: string | null;
  salary: number;
  contractEnd: number;
}

// =============================================================================
// TECHNICAL TYPES
// =============================================================================

/**
 * Engine specification - supplied by engine manufacturer
 */
export interface Engine {
  id: string; // e.g. "phoenix-v10-01a"
  manufacturerId: string;
  name: string;
  fuelEfficiency: number; // 0-100, lower fuel consumption
  power: number; // 0-100, straight-line speed
  reliability: number; // 0-100, resistance to failure
  lightness: number; // 0-100, lighter engines improve performance
}

/**
 * Tyre specification - supplied by tyre manufacturer
 */
export interface Tyre {
  id: string;
  manufacturerId: string;
  compound: TyreCompound;
  grip: number; // 0-100
  durability: number; // 0-100, resistance to wear
  temperatureRange: number; // 0-100, optimal operating range width
}

/**
 * Fuel specification - supplied by fuel manufacturer
 */
export interface Fuel {
  id: string;
  manufacturerId: string;
  name: string;
  performance: number; // 0-100, combustion efficiency
  engineTolerance: number; // 0-100, compatibility across engine types
}

/**
 * Car - A physical racing car owned by a team
 */
export interface Car {
  id: string;
  teamId: string;
  chassisId: string; // reference to chassis design
  engineId: string;
  condition: number; // 0-100, degrades with use/damage
  mileage: number; // total miles driven
  isRaceCar: boolean; // false = R&D car
}

// =============================================================================
// CIRCUIT TYPES
// =============================================================================

/**
 * Circuit characteristics - affect car setup and strategy
 */
export interface CircuitCharacteristics {
  speedRating: number; // 0-100, average circuit speed
  downforceRequirement: number; // 0-100, aero needs
  brakingDemand: number; // 0-100, brake stress
  tyreWear: number; // 0-100, surface abrasiveness
  overtakingOpportunity: number; // 0-100, passing ease
  wetWeatherLikelihood: number; // 0-100, rain probability
}

/**
 * Circuit - A racing track on the calendar
 */
export interface Circuit {
  id: string; // e.g. "monaco"
  name: string; // e.g. "Monte Carlo Street Circuit"
  location: string; // city
  country: string;
  lengthKm: number; // lap length in kilometers
  laps: number; // race distance in laps
  characteristics: CircuitCharacteristics;
}

// =============================================================================
// COMMERCIAL TYPES
// =============================================================================

/**
 * Sponsor - A commercial sponsor (team/cash sponsors, not technical suppliers)
 */
export interface Sponsor {
  id: string; // kebab-case slug, e.g. "globex-corp"
  name: string; // display name, e.g. "Globex Corporation"
  industry: string; // e.g. "technology", "finance", "automotive"
  tier: SponsorTier;
  payment: number; // annual payment in dollars
  minReputation: number; // 0-100, team must have at least this reputation
  rivalGroup: string | null; // sponsors in same group are mutually exclusive
}
