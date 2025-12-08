/**
 * Test: Results Screen
 *
 * Tests the Season Results grid, Race Detail view, and Driver Career view.
 *
 * Prerequisites:
 *   1. Run fixture generator: npx ts-node tests/e2e/fixtures/generate-fixture.ts
 *   2. Run the app: yarn start:debug
 *   3. Run this test: yarn test:one tests/e2e/results-screen.test.ts
 *
 * The test will install the fixture and prompt you to load it.
 */

import { connectToApp, verifyStep, installFixture } from './utils';

async function runResultsScreenTest() {
  // Install fixture first
  console.log('Installing test fixture...');
  installFixture('results-test-save.json');

  console.log('Connecting to app...');
  const { browser, page } = await connectToApp();

  console.log('\n=== RESULTS SCREEN TEST ===\n');
  console.log('IMPORTANT: Load the test save file from Options -> Saved Games');
  console.log('Look for the most recent save named "Test Player - McLaren"\n');

  await page.pause(); // Wait for user to load the save

  // Step 1: Navigate to FIA section
  await verifyStep(page, 'Click FIA section in sidebar', async () => {
    await page.click('text=FIA');
  });

  // Step 2: Navigate to Results
  await verifyStep(page, 'Click Results sub-item', async () => {
    await page.click('text=Results');
    await page.waitForSelector('text=Season Results', { timeout: 5000 });
  });

  // Step 3: Verify grid structure
  await verifyStep(page, 'Season Results grid is displayed', async () => {
    await page.waitForSelector('table');
    // Check for driver standings columns
    await page.waitForSelector('text=Pos');
    await page.waitForSelector('text=Driver');
    await page.waitForSelector('text=Team');
    await page.waitForSelector('text=Pts');
  });

  // Step 4: Verify race results are visible (colored cells)
  await verifyStep(page, 'Race result cells are visible', async () => {
    // The fixture has 3 completed races, should see colored result cells
    // Look for any cell with position styling (gold for 1st, silver for 2nd, etc.)
    const resultCells = await page.locator('button').filter({ hasText: /^[1-9]|Ret|DSQ$/ }).count();
    if (resultCells < 10) {
      throw new Error(`Expected at least 10 result cells, found ${resultCells}`);
    }
  });

  // Step 5: Click on a completed race to view details
  await verifyStep(page, 'Click on a completed race column header', async () => {
    // Click on a flag icon in the header to go to race details
    const flagButton = page.locator('th button').first();
    await flagButton.click();
    await page.waitForSelector('text=Qualifying Classification', { timeout: 5000 });
  });

  // Step 6: Verify Race Detail view structure
  await verifyStep(page, 'Race Detail view shows qualifying and race tables', async () => {
    await page.waitForSelector('text=Qualifying Classification');
    await page.waitForSelector('text=Race Classification');
    // Check for qualifying columns
    await page.waitForSelector('text=Time');
    await page.waitForSelector('text=Gap');
    // Check for race columns
    await page.waitForSelector('text=Laps');
    await page.waitForSelector('text=Grid');
  });

  // Step 7: Test back navigation
  await verifyStep(page, 'Click Back to Results button', async () => {
    await page.click('text=Back to Results');
    await page.waitForSelector('text=Season Results', { timeout: 5000 });
  });

  // Step 8: Click on a driver name to view career
  await verifyStep(page, 'Click on a driver name in the grid', async () => {
    // Find a driver name button and click it
    const driverButton = page.locator('td button').filter({ hasText: /\w+ \w+/ }).first();
    await driverButton.click();
    // Should show driver's season stats
    await page.waitForSelector('text=Races', { timeout: 5000 });
    await page.waitForSelector('text=Points');
    await page.waitForSelector('text=Wins');
  });

  // Step 9: Verify Driver Career view structure
  await verifyStep(page, 'Driver Career view shows stats summary', async () => {
    await page.waitForSelector('text=Podiums');
    await page.waitForSelector('text=DNFs');
  });

  // Step 10: Test back navigation from driver view
  await verifyStep(page, 'Click Back to Results from driver view', async () => {
    await page.click('text=Back to Results');
    await page.waitForSelector('text=Season Results', { timeout: 5000 });
  });

  // Step 11: Test navigation from Races screen
  await verifyStep(page, 'Navigate to Races screen', async () => {
    await page.click('text=Races');
    await page.waitForSelector('text=Season Calendar', { timeout: 5000 });
  });

  // Step 12: Click Report button on completed race
  await verifyStep(page, 'Click Report button on a completed race', async () => {
    const reportButton = page.locator('button').filter({ hasText: 'Report' }).first();
    await reportButton.click();
    // Should navigate to Results and show race detail
    await page.waitForSelector('text=Qualifying Classification', { timeout: 5000 });
  });

  console.log('\n=== TEST COMPLETE ===');
  console.log('Review the Results screen visually, then close the app or press Ctrl+C\n');

  await page.pause();
  await browser.close();
}

runResultsScreenTest().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
