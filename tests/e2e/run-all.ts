/**
 * Run all E2E tests sequentially
 *
 * Usage: yarn test
 */

import { readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const SEPARATOR = '='.repeat(60);
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
  console.log(`\n${SEPARATOR}`);
  console.log(`Running: ${file}`);
  console.log(SEPARATOR);

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

console.log(`\n${SEPARATOR}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(SEPARATOR);

process.exit(failed > 0 ? 1 : 0);
