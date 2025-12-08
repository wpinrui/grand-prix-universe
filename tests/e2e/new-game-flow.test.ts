/**
 * Test: New Game Flow
 *
 * Verifies: Title Screen → Player Name → Team Select
 *
 * Run with:
 *   Terminal 1: yarn start:debug
 *   Terminal 2: yarn test:one tests/e2e/new-game-flow.test.ts
 */

import { connectToApp, verifyStep } from './utils';

async function runNewGameFlowTest() {
  console.log('Connecting to app...');
  const { browser, page } = await connectToApp();

  console.log('\n=== NEW GAME FLOW TEST ===\n');

  // Step 1: Title Screen
  await verifyStep(page, 'Title Screen loaded', async () => {
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
    await page.waitForSelector('button:has-text("OK"):not([disabled])');
    await page.click('button:has-text("OK")');
  });

  // Step 5: Team Select Screen
  await verifyStep(page, 'Team Select screen loaded', async () => {
    await page.waitForSelector('text=Select Team');
  });

  console.log('\n=== TEST COMPLETE ===');
  console.log('Close the app window or press Ctrl+C to exit\n');

  await page.pause();
  await browser.close();
}

runNewGameFlowTest().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
