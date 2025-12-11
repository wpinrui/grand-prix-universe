/**
 * Update Driver Salaries Based on Perceived Reputation
 *
 * Combined perceived value formula (two equal components):
 * 1. Contribution ratio (0-0.5): weighted avg of (driver pts / team pts) with 0.8^i decay
 * 2. Championship position (0-0.5): normalized position (1st = 0.5, 20th = 0)
 *
 * This prevents the flaw where a driver on a weak team (e.g., Alex Albon scoring
 * 70% of Williams' points) ranks higher than a race winner on a strong team
 * (e.g., Oscar Piastri scoring 34% of McLaren's points).
 *
 * Salary distribution:
 * - 100th percentile: $20M
 * - 0th percentile: $2M
 * - Quadratic distribution (percentile^2) to create more separation at top
 *
 * Usage: node scripts/update-driver-salaries.js
 */

const fs = require('fs');
const path = require('path');

// Constants from driver-evaluator.ts
const DECAY_FACTOR = 0.8;
const MAX_HISTORY_YEARS = 5;
const MARKET_VALUE_FLOOR = 2_000_000;
const MARKET_VALUE_CEILING = 20_000_000;
const GRID_SIZE = 20; // Number of drivers on the F1 grid

/**
 * Calculate perceived value from career history using two equal components:
 * 1. Contribution ratio (0-0.5): weighted avg of (driver pts / team pts)
 * 2. Championship position (0-0.5): normalized position (1st = 0.5, 20th = 0)
 *
 * Returns a value from 0 to 1.
 */
function calculatePerceivedValue(careerHistory) {
  if (!careerHistory || careerHistory.length === 0) {
    return 0.5;
  }

  // Sort by season descending (most recent first)
  const sorted = [...careerHistory].sort((a, b) => b.season - a.season);
  const limited = sorted.slice(0, MAX_HISTORY_YEARS);

  let contributionWeightedSum = 0;
  let positionWeightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < limited.length; i++) {
    const record = limited[i];
    const weight = Math.pow(DECAY_FACTOR, i);

    // Component 1: Contribution ratio (driver points / team points)
    const contributionRatio = record.teamTotalPoints > 0
      ? record.totalPoints / record.teamTotalPoints
      : 0.5;
    contributionWeightedSum += contributionRatio * weight;

    // Component 2: Championship position (normalized: 1st = 1.0, 20th = 0)
    const position = record.championshipPosition ?? GRID_SIZE; // Default to last if missing
    const positionNormalized = (GRID_SIZE - position) / (GRID_SIZE - 1);
    positionWeightedSum += positionNormalized * weight;

    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0.5;
  }

  // Each component contributes 0-0.5 to the final value (0-1 total)
  const contributionComponent = (contributionWeightedSum / totalWeight) * 0.5;
  const positionComponent = (positionWeightedSum / totalWeight) * 0.5;

  return contributionComponent + positionComponent;
}

/**
 * Calculate salary using quadratic distribution.
 * percentile^2 means top drivers get much more than linear distribution.
 */
function calculateSalary(percentile) {
  // Quadratic distribution - squares the percentile
  const quadraticPercentile = Math.pow(percentile, 2);
  const salary = MARKET_VALUE_FLOOR + quadraticPercentile * (MARKET_VALUE_CEILING - MARKET_VALUE_FLOOR);
  // Round to nearest 100k
  return Math.round(salary / 100_000) * 100_000;
}

async function main() {
  const driversPath = path.join(__dirname, '..', 'data', 'content', 'drivers.json');
  const driversFile = JSON.parse(fs.readFileSync(driversPath, 'utf8'));
  const drivers = driversFile.drivers;

  console.log('Calculating perceived values...\n');

  // Calculate perceived value for drivers with F1 seats (have teamId)
  const f1Drivers = drivers.filter(d => d.teamId !== null);
  const driverValues = f1Drivers.map(d => ({
    id: d.id,
    name: `${d.firstName} ${d.lastName}`,
    perceivedValue: calculatePerceivedValue(d.careerHistory),
    currentSalary: d.salary,
  }));

  // Sort by perceived value ascending (for percentile calculation)
  driverValues.sort((a, b) => a.perceivedValue - b.perceivedValue);

  // Calculate percentile and new salary for each driver
  const numDrivers = driverValues.length;
  for (let i = 0; i < numDrivers; i++) {
    const percentile = numDrivers > 1 ? i / (numDrivers - 1) : 0.5;
    driverValues[i].percentile = percentile;
    driverValues[i].newSalary = calculateSalary(percentile);
  }

  // Sort by new salary descending for display
  driverValues.sort((a, b) => b.newSalary - a.newSalary);

  console.log('Driver salaries (ranked by perceived value):\n');
  console.log('Rank | Driver                    | Perceived | Percentile | Old Salary   | New Salary');
  console.log('-----|---------------------------|-----------|------------|--------------|------------');

  for (let i = 0; i < driverValues.length; i++) {
    const d = driverValues[i];
    const rank = (i + 1).toString().padStart(2);
    const name = d.name.padEnd(25);
    const perceived = d.perceivedValue.toFixed(3).padStart(9);
    const percentile = (d.percentile * 100).toFixed(1).padStart(8) + '%';
    const oldSalary = ('$' + (d.currentSalary / 1_000_000).toFixed(1) + 'M').padStart(12);
    const newSalary = ('$' + (d.newSalary / 1_000_000).toFixed(1) + 'M').padStart(10);
    console.log(`  ${rank} | ${name} | ${perceived} | ${percentile} | ${oldSalary} | ${newSalary}`);
  }

  // Update drivers.json
  const salaryMap = new Map(driverValues.map(d => [d.id, d.newSalary]));
  let updated = 0;

  for (const driver of drivers) {
    if (salaryMap.has(driver.id)) {
      driver.salary = salaryMap.get(driver.id);
      updated++;
    }
  }

  fs.writeFileSync(driversPath, JSON.stringify(driversFile, null, 2));
  console.log(`\nDone! Updated ${updated} driver salaries in drivers.json`);
}

main().catch(console.error);
