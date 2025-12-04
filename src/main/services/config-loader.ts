/**
 * ConfigLoader Service
 *
 * Loads game configuration and content data from JSON files.
 * Supports override directory for modding/real data overlays.
 *
 * Priority: /data/override/ > /data/content/ > /data/config/
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Team, Driver, Circuit, Sponsor, Manufacturer, Chief } from '../../shared/domain';

// JSON file wrapper types
interface TeamsFile {
  teams: Team[];
}

interface DriversFile {
  drivers: Driver[];
}

interface CircuitsFile {
  circuits: Circuit[];
}

interface SponsorsFile {
  sponsors: Sponsor[];
}

interface ManufacturersFile {
  manufacturers: Manufacturer[];
}

interface ChiefsFile {
  chiefs: Chief[];
}

/**
 * Get the base data directory path.
 * In development: project root /data
 * In production: app resources /data
 */
function getDataPath(): string {
  const appPath = app.getAppPath();
  // In production, appPath points to the asar archive
  // In development, it points to the project root
  return path.join(appPath, 'data');
}

/**
 * Read and parse a JSON file.
 * Returns null if file doesn't exist.
 */
function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Failed to read JSON file: ${filePath}`, error);
    return null;
  }
}

/**
 * Load a content file with override support.
 * If override exists, it completely replaces the content file.
 */
function loadContentFile<T>(filename: string): T | null {
  const dataPath = getDataPath();

  // Check override first (highest priority)
  const overridePath = path.join(dataPath, 'override', filename);
  const overrideData = readJsonFile<T>(overridePath);
  if (overrideData !== null) {
    return overrideData;
  }

  // Fall back to content
  const contentPath = path.join(dataPath, 'content', filename);
  return readJsonFile<T>(contentPath);
}

/**
 * Load a config file (no override support for config).
 */
function loadConfigFile<T>(filename: string): T | null {
  const dataPath = getDataPath();
  const configPath = path.join(dataPath, 'config', filename);
  return readJsonFile<T>(configPath);
}

// Unified cache for all content types
type CacheKey = 'teams' | 'drivers' | 'circuits' | 'sponsors' | 'manufacturers' | 'chiefs';
const cache: Record<CacheKey, unknown[] | null> = {
  teams: null,
  drivers: null,
  circuits: null,
  sponsors: null,
  manufacturers: null,
  chiefs: null,
};

/**
 * Generic cached content loader.
 * Eliminates repetition across getTeams/getDrivers/getCircuits.
 */
function getCachedContent<TFile, TItem>(
  cacheKey: CacheKey,
  filename: string,
  extractor: (file: TFile) => TItem[]
): TItem[] {
  // Return cached data if available
  if (cache[cacheKey] !== null) {
    return cache[cacheKey] as TItem[];
  }

  const data = loadContentFile<TFile>(filename);
  if (!data) {
    cache[cacheKey] = [];
    return [];
  }

  // Guard against malformed JSON where the expected array is not actually an array
  const extracted = extractor(data);
  cache[cacheKey] = Array.isArray(extracted) ? extracted : [];
  return cache[cacheKey] as TItem[];
}

/**
 * ConfigLoader - Singleton service for loading game data
 */
export const ConfigLoader = {
  getTeams(): Team[] {
    return getCachedContent<TeamsFile, Team>('teams', 'teams.json', (f) => f.teams);
  },

  getTeamById(id: string): Team | undefined {
    return this.getTeams().find((team) => team.id === id);
  },

  getDrivers(): Driver[] {
    return getCachedContent<DriversFile, Driver>('drivers', 'drivers.json', (f) => f.drivers);
  },

  getDriverById(id: string): Driver | undefined {
    return this.getDrivers().find((driver) => driver.id === id);
  },

  getDriversByTeamId(teamId: string): Driver[] {
    return this.getDrivers().filter((driver) => driver.teamId === teamId);
  },

  getCircuits(): Circuit[] {
    return getCachedContent<CircuitsFile, Circuit>('circuits', 'circuits.json', (f) => f.circuits);
  },

  getCircuitById(id: string): Circuit | undefined {
    return this.getCircuits().find((circuit) => circuit.id === id);
  },

  getSponsors(): Sponsor[] {
    return getCachedContent<SponsorsFile, Sponsor>('sponsors', 'sponsors.json', (f) => f.sponsors);
  },

  getSponsorById(id: string): Sponsor | undefined {
    return this.getSponsors().find((sponsor) => sponsor.id === id);
  },

  getManufacturers(): Manufacturer[] {
    return getCachedContent<ManufacturersFile, Manufacturer>(
      'manufacturers',
      'manufacturers.json',
      (f) => f.manufacturers
    );
  },

  getManufacturerById(id: string): Manufacturer | undefined {
    return this.getManufacturers().find((manufacturer) => manufacturer.id === id);
  },

  getChiefs(): Chief[] {
    return getCachedContent<ChiefsFile, Chief>('chiefs', 'staff.json', (f) => f.chiefs);
  },

  getChiefById(id: string): Chief | undefined {
    return this.getChiefs().find((chief) => chief.id === id);
  },

  clearCache(): void {
    cache.teams = null;
    cache.drivers = null;
    cache.circuits = null;
    cache.sponsors = null;
    cache.manufacturers = null;
    cache.chiefs = null;
  },

  /** Get the data directory path (for debugging). */
  getDataPath,

  /** Load a config file by name. Config files don't support override. */
  loadConfig: loadConfigFile,
};
