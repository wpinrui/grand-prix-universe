/**
 * E2E test for Mail screen
 *
 * Prerequisites:
 * 1. Run `yarn start:debug` in a separate terminal
 * 2. Start a new game or load a save
 */

import { connectToApp, verifyStep } from './utils';

async function runMailScreenTest() {
  console.log('\n=== Mail Screen Test ===\n');

  const { browser, page } = await connectToApp();

  // Navigate to Mail screen
  await verifyStep(page, 'Click TEAM section', async () => {
    await page.click('text=TEAM');
  });

  await verifyStep(page, 'Click Mail in bottom bar', async () => {
    await page.click('[data-testid="subnav-mail"], button:has-text("Mail")');
  });

  await verifyStep(page, 'Verify Mail heading displays', async () => {
    await page.waitForSelector('text=Mail', { timeout: 3000 });
  });

  // Check for either empty state or mail content
  await verifyStep(page, 'Verify mail content area exists', async () => {
    // Either empty state message or mail items should be visible
    const emptyState = page.locator('text=No messages yet');
    const mailCard = page.locator('.card');

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasCard = await mailCard.isVisible().catch(() => false);

    if (!hasEmptyState && !hasCard) {
      throw new Error('Neither empty state nor mail card is visible');
    }

    if (hasEmptyState) {
      console.log('    (Empty state shown - no emails in current save)');
    } else {
      console.log('    (Mail items displayed)');
    }
  });

  console.log('\n✓ Mail screen test complete\n');
  await page.pause(); // Final manual verification
  await browser.close();
}

runMailScreenTest().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
