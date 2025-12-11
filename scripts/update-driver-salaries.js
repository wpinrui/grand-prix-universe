/**
 * Update Driver Salaries Based on Perceived Reputation
 *
 * Uses the perceived value formula from driver-evaluator.ts:
 * - Weighted average of (driver points / team points) over past seasons
 * - Exponential decay (0.8^i) with most recent seasons weighted more
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

/**
 * Calculate perceived value from career history using exponential decay.
 * Returns a value from 0 to 1 representing the driver's contribution ratio.
 */
function calculatePerceivedValue(careerHistory) {
  if (!careerHistory || careerHistory.length === 0) {
    return 0.5;
  }

  // Sort by season descending (most recent first)
  const sorted = [...careerHistory].sort((a, b) => b.season - a.season);
  const limited = sorted.slice(0, MAX_HISTORY_YEARS);

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < limited.length; i++) {
    const record = limited[i];
    const weight = Math.pow(DECAY_FACTOR, i);

    // Calculate contribution ratio (driver points / team points)
    const ratio = record.teamTotalPoints > 0
      ? record.totalPoints / record.teamTotalPoints
      : 0.5;

    weightedSum += ratio * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
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
