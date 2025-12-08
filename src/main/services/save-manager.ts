/**
 * SaveManager Service
 *
 * Handles saving and loading game state to/from JSON files.
 * Saves are stored in the user's app data directory.
 */

import { createHash } from 'crypto';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { GameState } from '../../shared/domain';
import type { SaveSlotInfo, SaveResult, LoadResult } from '../../shared/ipc';
import { yearToSeason, getWeekNumber } from '../../shared/utils/date-utils';

/** Directory name for saves within userData */
const SAVES_DIR = 'saves';

/** File extension for save files */
const SAVE_EXTENSION = '.json';

/**
 * Gets the saves directory path, creating it if it doesn't exist
 */
async function getSavesDir(): Promise<string> {
  const savesDir = path.join(app.getPath('userData'), SAVES_DIR);
  await fs.mkdir(savesDir, { recursive: true });
  return savesDir;
}

/** Prefix for autosave files */
const AUTOSAVE_PREFIX = 'auto_';

/**
 * Generates a save filename from game state
 * Format: [auto_]gameId_YYYY-MM-DD_HH-MM-SS.json
 * - auto_ prefix indicates autosave
 * - gameId links saves from the same playthrough
 */
function generateFilename(state: GameState, isAutosave: boolean): string {
  const prefix = isAutosave ? AUTOSAVE_PREFIX : '';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
  return `${prefix}${state.gameId}_${dateStr}_${timeStr}${SAVE_EXTENSION}`;
}

/**
 * Checks if a filename represents an autosave
 */
function isAutosaveFile(filename: string): boolean {
  return filename.startsWith(AUTOSAVE_PREFIX);
}

/**
 * Extracts gameId from a filename.
 * Format: [auto_]gameId_YYYY-MM-DD_HH-MM-SS.json
 */
function extractGameIdFromFilename(filename: string): string {
  // Remove auto_ prefix if present
  const baseName = filename.startsWith(AUTOSAVE_PREFIX)
    ? filename.slice(AUTOSAVE_PREFIX.length)
    : filename;
  // gameId is the first segment (UUID) before the date
  const firstUnderscore = baseName.indexOf('_');
  if (firstUnderscore === -1) return '';
  return baseName.slice(0, firstUnderscore);
}

/**
 * Extracts save metadata from a game state
 */
function extractSaveInfo(
  filename: string,
  state: GameState,
  fileSize: number
): SaveSlotInfo {
  const team = state.teams.find((t) => t.id === state.player.teamId);
  return {
    filename,
    gameId: state.gameId,
    isAutosave: isAutosaveFile(filename),
    playerName: state.player.name,
    teamId: state.player.teamId,
    teamName: team?.name ?? 'Unknown Team',
    seasonNumber: yearToSeason(state.currentDate.year),
    weekNumber: getWeekNumber(state.currentDate),
    savedAt: state.lastSavedAt,
    fileSize,
  };
}

/**
 * Sanitizes a filename to prevent path traversal attacks.
 * Strips any directory components, returning only the base filename.
 */
function sanitizeFilename(filename: string): string {
  return path.basename(filename);
}

/**
 * Validates that a loaded object matches the GameState structure
 * Basic validation - checks required top-level fields exist
 */
function isValidGameState(data: unknown): data is GameState {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.version === 'string' &&
    typeof obj.gameId === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.lastSavedAt === 'string' &&
    typeof obj.player === 'object' &&
    typeof obj.currentDate === 'object' &&
    typeof obj.phase === 'string' &&
    typeof obj.currentSeason === 'object' &&
    Array.isArray(obj.teams) &&
    Array.isArray(obj.drivers)
  );
}

/**
 * Creates a content hash of game state for comparison.
 * Excludes lastSavedAt since that changes every save.
 */
function hashGameState(state: GameState): string {
  // Create a copy without the timestamp fields that change every save
  const stateForHash = {
    ...state,
    lastSavedAt: undefined,
    createdAt: undefined,
  };
  const jsonStr = JSON.stringify(stateForHash);
  return createHash('sha256').update(jsonStr).digest('hex');
}

/**
 * SaveManager - Handles save/load operations for game state
 */
export const SaveManager = {
  /**
   * Saves the current game state to a new file
   * @param state - The game state to save
   * @param isAutosave - Whether this is an autosave (affects filename prefix)
   */
  async save(state: GameState, isAutosave = false): Promise<SaveResult> {
    try {
      const savesDir = await getSavesDir();
      const filename = generateFilename(state, isAutosave);
      const filePath = path.join(savesDir, filename);

      // Update lastSavedAt timestamp
      const savedAt = new Date().toISOString();
      const stateToSave: GameState = {
        ...state,
        lastSavedAt: savedAt,
      };

      const jsonData = JSON.stringify(stateToSave, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf-8');

      return { success: true, filename, savedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to save game: ${message}` };
    }
  },

  /**
   * Loads a game state from a save file
   */
  async load(filename: string): Promise<LoadResult> {
    try {
      const savesDir = await getSavesDir();
      const safeFilename = sanitizeFilename(filename);
      const filePath = path.join(savesDir, safeFilename);

      const jsonData = await fs.readFile(filePath, 'utf-8');
      const data: unknown = JSON.parse(jsonData);

      if (!isValidGameState(data)) {
        return { success: false, error: 'Invalid save file format' };
      }

      return { success: true, state: data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to load game: ${message}` };
    }
  },

  /**
   * Lists all available save files with metadata
   * Sorted by savedAt date, most recent first
   */
  async listSaves(): Promise<SaveSlotInfo[]> {
    try {
      const savesDir = await getSavesDir();
      const files = await fs.readdir(savesDir);
      const saveFiles = files.filter((f) => f.endsWith(SAVE_EXTENSION));

      const saves: SaveSlotInfo[] = [];

      for (const filename of saveFiles) {
        try {
          const filePath = path.join(savesDir, filename);
          const [jsonData, stats] = await Promise.all([
            fs.readFile(filePath, 'utf-8'),
            fs.stat(filePath),
          ]);

          const data: unknown = JSON.parse(jsonData);
          if (isValidGameState(data)) {
            saves.push(extractSaveInfo(filename, data, stats.size));
          }
        } catch (error) {
          // Skip invalid/corrupted save files, but log for debugging
          console.warn(`[SaveManager] Skipping invalid save file: ${filename}`, error);
        }
      }

      // Sort by savedAt, most recent first
      saves.sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );

      return saves;
    } catch (error) {
      // If saves directory doesn't exist or can't be read, return empty
      console.warn('[SaveManager] Could not read saves directory', error);
      return [];
    }
  },

  /**
   * Deletes a save file
   */
  async deleteSave(filename: string): Promise<boolean> {
    try {
      const savesDir = await getSavesDir();
      const safeFilename = sanitizeFilename(filename);
      const filePath = path.join(savesDir, safeFilename);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.warn(`[SaveManager] Failed to delete save: ${filename}`, error);
      return false;
    }
  },

  /**
   * Gets the most recent autosave for a specific game
   * Returns null if no autosaves exist for this game
   */
  async getLatestAutosave(gameId: string): Promise<GameState | null> {
    if (!gameId) return null;

    try {
      const savesDir = await getSavesDir();
      const files = await fs.readdir(savesDir);

      // Filter to autosaves for this specific game
      const autosaveFiles = files.filter(
        (f) =>
          f.endsWith(SAVE_EXTENSION) &&
          isAutosaveFile(f) &&
          extractGameIdFromFilename(f) === gameId
      );

      if (autosaveFiles.length === 0) return null;

      // Sort by modification time, most recent first
      const filesWithStats = await Promise.all(
        autosaveFiles.map(async (filename) => {
          const filePath = path.join(savesDir, filename);
          const stats = await fs.stat(filePath);
          return { filename, mtime: stats.mtime.getTime() };
        })
      );
      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      // Load the most recent autosave
      const latestFilename = filesWithStats[0].filename;
      const filePath = path.join(savesDir, latestFilename);
      const jsonData = await fs.readFile(filePath, 'utf-8');
      const data: unknown = JSON.parse(jsonData);

      if (!isValidGameState(data)) return null;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Smart autosave that skips if state is identical to last autosave.
   * Returns success with skipped=true if no save was needed.
   */
  async autoSave(state: GameState): Promise<SaveResult & { skipped?: boolean }> {
    try {
      // Get the latest autosave for this game
      const lastAutosave = await SaveManager.getLatestAutosave(state.gameId);

      if (lastAutosave) {
        // Compare hashes to check if state has changed
        const currentHash = hashGameState(state);
        const lastHash = hashGameState(lastAutosave);

        if (currentHash === lastHash) {
          // State is identical - skip the save
          return { success: true, skipped: true };
        }
      }

      // State has changed - perform the autosave
      return SaveManager.save(state, true);
    } catch (error) {
      // On any error, fall back to normal save
      console.warn('[SaveManager] AutoSave comparison failed, saving anyway:', error);
      return SaveManager.save(state, true);
    }
  },
};
