/**
 * SaveManager Service
 *
 * Handles saving and loading game state to/from JSON files.
 * Saves are stored in the user's app data directory.
 */

import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { GameState } from '../../shared/domain';
import type { SaveSlotInfo, SaveResult, LoadResult } from '../../shared/ipc';

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

/**
 * Generates a save filename from game state
 * Format: teamId_YYYY-MM-DD_HH-MM-SS.json
 */
function generateFilename(state: GameState): string {
  const teamId = state.player.teamId;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
  return `${teamId}_${dateStr}_${timeStr}${SAVE_EXTENSION}`;
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
    playerName: state.player.name,
    teamId: state.player.teamId,
    teamName: team?.name ?? 'Unknown Team',
    seasonNumber: state.currentDate.season,
    weekNumber: state.currentDate.week,
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
 * SaveManager - Handles save/load operations for game state
 */
export const SaveManager = {
  /**
   * Saves the current game state to a new file
   * Filename is auto-generated from team + timestamp
   */
  async save(state: GameState): Promise<SaveResult> {
    try {
      const savesDir = await getSavesDir();
      const filename = generateFilename(state);
      const filePath = path.join(savesDir, filename);

      // Update lastSavedAt timestamp
      const stateToSave: GameState = {
        ...state,
        lastSavedAt: new Date().toISOString(),
      };

      const jsonData = JSON.stringify(stateToSave, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf-8');

      return { success: true, filename };
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
        } catch {
          // Skip invalid/corrupted save files
          continue;
        }
      }

      // Sort by savedAt, most recent first
      saves.sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );

      return saves;
    } catch {
      // If saves directory doesn't exist or can't be read, return empty
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
    } catch {
      return false;
    }
  },

  /**
   * Checks if a save file exists
   */
  async saveExists(filename: string): Promise<boolean> {
    try {
      const savesDir = await getSavesDir();
      const safeFilename = sanitizeFilename(filename);
      const filePath = path.join(savesDir, safeFilename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Gets the full path to the saves directory
   * Useful for debugging or showing to user
   */
  async getSavesPath(): Promise<string> {
    return getSavesDir();
  },
};
