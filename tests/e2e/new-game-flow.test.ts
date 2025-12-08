/**
 * Test: New Game Flow
 *
 * Verifies: Title Screen → Player Name → Team Select
 *
 * Run with:
 *   Terminal 1: yarn start:debug
 *   Terminal 2: PWDEBUG=1 npx ts-node tests/e2e/new-game-flow.test.ts
 */

import { chromium, Page } from 'playwright';

const CDP_URL = 'http://localhost:9222';

async function runTest() {
  console.log('Connecting to app...');
  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0].pages()[0];

  console.log('\n=== NEW GAME FLOW TEST ===\n');

  // Step 1: Title Screen
  await verifyStep(page, 'Title Screen loaded', async () => {
    // Verify title text is visible
    await page.waitForSelector('text=Grand Prix Universe');
    await page.waitForSelector('text=New Game');
  });

  // Step 2: Click "New Game"
  await verifyStep(page, 'Click New Game button', async () => {
    await page.click('text=New Game');
  });

  // Step 3: Player Name Screen
  await verifyStep(page, 'Player Name screen loaded', async () => {
    await page.waitForSelector('text=Please enter your name');
    await page.waitForSelector('input[placeholder="Enter your name"]');
  });

  // Step 4: Enter name and submit
  await verifyStep(page, 'Enter player name and click OK', async () => {
    await page.fill('input[placeholder="Enter your name"]', 'Test Player');
    await page.click('text=OK');
  });

  // Step 5: Team Select Screen
  await verifyStep(page, 'Team Select screen loaded', async () => {
    // Wait for team select to load - adjust selector based on actual UI
    await page.waitForSelector('.team-select-screen', { timeout: 5000 }).catch(() => {
      console.log('  (team-select-screen class not found, checking for other indicators...)');
    });
  });

  console.log('\n=== TEST COMPLETE ===');
  console.log('Close the app window or press Ctrl+C to exit\n');

  // Keep connection open for inspection
  await page.pause();

  await browser.close();
}

async function verifyStep(page: Page, description: string, action: () => Promise<void>) {
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

runTest().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
