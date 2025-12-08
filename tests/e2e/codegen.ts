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

import { chromium } from 'playwright';
import { CDP_URL } from './utils';

async function connectAndRecord() {
  console.log('Connecting to Electron app via CDP...');
  console.log(`Make sure the app is running with: yarn start:debug\n`);

  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    console.log('Connected to browser');

    const contexts = browser.contexts();
    if (contexts.length === 0) {
      console.error('No browser contexts found. Is the app window open?');
      process.exit(1);
    }

    const context = contexts[0];
    const pages = context.pages();

    if (pages.length === 0) {
      console.error('No pages found. Is the app window open?');
      process.exit(1);
    }

    const page = pages[0];
    console.log('Found app window');
    console.log('\n=== Playwright Inspector ===');
    console.log('1. Click the "Record" button (red circle) in the Inspector');
    console.log('2. Interact with your app');
    console.log('3. Code is generated in the Inspector');
    console.log('4. Copy the code to use in your tests');
    console.log('5. Press Ctrl+C here when done\n');

    // This opens the Playwright Inspector with recording capabilities
    // PWDEBUG=1 env var must be set (done via yarn codegen script)
    await page.pause();

    await browser.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      console.error('\nCould not connect to the app.');
      console.error('Make sure you start it first with: yarn start:debug');
    } else {
      throw error;
    }
    process.exit(1);
  }
}

connectAndRecord();
