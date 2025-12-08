/**
 * Shared utilities for E2E tests
 */

import { chromium, Browser, Page } from 'playwright';

export const CDP_URL = 'http://localhost:9222';

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
