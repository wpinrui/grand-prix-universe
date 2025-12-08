/**
 * Shared utilities for E2E tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, Page } from 'playwright';

export const CDP_URL = 'http://localhost:9222';

/**
 * Get the app's saves directory path
 */
export function getSavesDir(): string {
  const appData = process.env.APPDATA || path.join(process.env.HOME || '', 'AppData', 'Roaming');
  return path.join(appData, 'grand-prix-universe', 'saves');
}

/**
 * Install a fixture save file to the app's saves directory
 * Returns the filename that was installed
 */
export function installFixture(fixtureName: string): string {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const sourcePath = path.join(fixturesDir, fixtureName);
  const savesDir = getSavesDir();

  // Ensure saves directory exists
  if (!fs.existsSync(savesDir)) {
    fs.mkdirSync(savesDir, { recursive: true });
  }

  // Generate a valid save filename with timestamp
  const gameId = 'test-' + Date.now();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const destFilename = `${gameId}_${dateStr}_${timeStr}.json`;
  const destPath = path.join(savesDir, destFilename);

  // Read fixture and update gameId
  const content = fs.readFileSync(sourcePath, 'utf-8');
  const state = JSON.parse(content);
  state.gameId = gameId;
  state.lastSavedAt = now.toISOString();

  // Write to saves directory
  fs.writeFileSync(destPath, JSON.stringify(state, null, 2));

  console.log(`Fixture installed: ${destFilename}`);
  return destFilename;
}

/**
 * Connect to the running Electron app via CDP
 * Returns the browser and first page
 */
export async function connectToApp(): Promise<{ browser: Browser; page: Page }> {
  let browser: Browser;

  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      throw new Error('Could not connect. Run `yarn start:debug` first.');
    }
    throw error;
  }

  const contexts = browser.contexts();
  if (contexts.length === 0) {
    await browser.close();
    throw new Error('No browser contexts found. Is the app window open?');
  }

  const pages = contexts[0].pages();
  if (pages.length === 0) {
    await browser.close();
    throw new Error('No pages found. Is the app window open?');
  }

  return { browser, page: pages[0] };
}

/**
 * Run a test step with pass/fail logging
 * On failure, pauses for manual inspection
 */
export async function verifyStep(
  page: Page,
  description: string,
  action: () => Promise<void>
): Promise<void> {
  console.log(`▶ ${description}`);
  try {
    await action();
    console.log(`  ✓ Passed`);
  } catch (error) {
    console.log(`  ✗ Failed: ${(error as Error).message}`);
    console.log('\n  Pausing for manual inspection...');
    await page.pause();
  }
}
