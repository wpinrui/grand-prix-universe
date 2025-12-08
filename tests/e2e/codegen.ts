/**
 * Playwright codegen script for Electron
 *
 * Usage:
 * 1. Start the app with debugging: yarn start:debug
 * 2. In another terminal: yarn codegen
 * 3. The Playwright Inspector will open with a Record button
 * 4. Click Record, interact with your app, and it generates code
 *
 * The generated code can be copied into test files.
 */

import { connectToApp } from './utils';

async function connectAndRecord() {
  console.log('Connecting to Electron app via CDP...');
  console.log('Make sure the app is running with: yarn start:debug\n');

  const { browser, page } = await connectToApp();

  console.log('Connected to app window');
  console.log('\n=== Playwright Inspector ===');
  console.log('1. Click the "Record" button (red circle) in the Inspector');
  console.log('2. Interact with your app');
  console.log('3. Code is generated in the Inspector');
  console.log('4. Copy the code to use in your tests');
  console.log('5. Press Ctrl+C here when done\n');

  await page.pause();
  await browser.close();
}

connectAndRecord().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
