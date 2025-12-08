/**
 * E2E test for News screen
 *
 * Prerequisites:
 * 1. Run `yarn start:debug` in a separate terminal
 * 2. Start a new game or load a save
 */

import { connectToApp, verifyStep } from './utils';

async function runNewsScreenTest() {
  console.log('\n=== News Screen Test ===\n');

  const { browser, page } = await connectToApp();

  // Navigate to News screen
  await verifyStep(page, 'Click TEAM section', async () => {
    await page.click('text=TEAM');
  });

  await verifyStep(page, 'Click News in bottom bar', async () => {
    await page.click('[data-testid="subnav-news"], button:has-text("News")');
  });

  await verifyStep(page, 'Verify News heading displays', async () => {
    await page.waitForSelector('text=News', { timeout: 3000 });
  });

  // Check for either empty state or news content
  await verifyStep(page, 'Verify news content area exists', async () => {
    // Either empty state message or news items should be visible
    const emptyState = page.locator('text=No news yet');
    const newsCard = page.locator('.card');

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasCard = await newsCard.isVisible().catch(() => false);

    if (!hasEmptyState && !hasCard) {
      throw new Error('Neither empty state nor news card is visible');
    }

    if (hasEmptyState) {
      console.log('    (Empty state shown - no headlines in current save)');
    } else {
      console.log('    (News items displayed)');
    }
  });

  console.log('\n✓ News screen test complete\n');
  await page.pause(); // Final manual verification
  await browser.close();
}

runNewsScreenTest().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
