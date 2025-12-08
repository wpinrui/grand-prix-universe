/**
 * E2E test for Finance screen
 *
 * Prerequisites:
 * 1. Run `yarn start:debug` in a separate terminal
 * 2. Start a new game or load a save
 */

import { connectToApp, verifyStep } from './utils';

async function runFinanceScreenTest() {
  console.log('\n=== Finance Screen Test ===\n');

  const { browser, page } = await connectToApp();

  // Navigate to Finance screen
  await verifyStep(page, 'Click TEAM section', async () => {
    await page.click('text=TEAM');
  });

  await verifyStep(page, 'Click Finance in bottom bar', async () => {
    await page.click('[data-testid="subnav-finance"], button:has-text("Finance")');
  });

  // Verify main sections are visible
  await verifyStep(page, 'Verify Current Budget card displays', async () => {
    await page.waitForSelector('text=Current Budget', { timeout: 3000 });
  });

  await verifyStep(page, 'Verify budget amount is formatted', async () => {
    // Budget should show as currency (e.g., $50,000,000)
    const budgetAmount = page.locator('text=/\\$[\\d,]+/').first();
    await budgetAmount.waitFor({ timeout: 3000 });
  });

  await verifyStep(page, 'Verify Annual Income section displays', async () => {
    await page.waitForSelector('text=Annual Income', { timeout: 3000 });
  });

  await verifyStep(page, 'Verify Annual Expenses section displays', async () => {
    await page.waitForSelector('text=Annual Expenses', { timeout: 3000 });
  });

  await verifyStep(page, 'Verify Season Projection section displays', async () => {
    await page.waitForSelector('text=Season Projection', { timeout: 3000 });
  });

  await verifyStep(page, 'Verify totals are calculated', async () => {
    // Check for Total Income row
    const totalIncome = page.locator('text=Total Income');
    await totalIncome.waitFor({ timeout: 3000 });

    // Check for Total Expenses row
    const totalExpenses = page.locator('text=Total Expenses');
    await totalExpenses.waitFor({ timeout: 3000 });

    // Check for projected balance
    const projectedBalance = page.locator('text=Projected Year-End Balance');
    await projectedBalance.waitFor({ timeout: 3000 });
  });

  console.log('\n=== Finance screen test complete ===\n');
  await page.pause(); // Final manual verification
  await browser.close();
}

runFinanceScreenTest().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
