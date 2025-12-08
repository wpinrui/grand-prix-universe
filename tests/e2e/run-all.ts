/**
 * Run all E2E tests sequentially
 *
 * Usage: yarn test:e2e:all
 */

import { readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const testsDir = __dirname;
const testFiles = readdirSync(testsDir).filter((f) => f.endsWith('.test.ts'));

if (testFiles.length === 0) {
  console.log('No test files found');
  process.exit(0);
}

console.log(`Found ${testFiles.length} test file(s):\n`);
testFiles.forEach((f) => console.log(`  - ${f}`));
console.log('');

let passed = 0;
let failed = 0;

for (const file of testFiles) {
  const filePath = join(testsDir, file);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${file}`);
  console.log('='.repeat(60));

  try {
    execSync(`npx ts-node "${filePath}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    passed++;
  } catch {
    failed++;
    console.error(`\n✗ ${file} failed`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
