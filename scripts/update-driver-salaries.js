/**
 * Update Driver Salaries Based on Perceived Reputation
 *
 * Combined perceived value formula (three components, max 1.0):
 * 1. Contribution ratio (0-0.375): weighted avg of (driver pts / team pts) with 0.8^i decay
 * 2. Championship position (0-0.375): normalized position (1st = 0.375, 20th = 0)
 * 3. Experience scalar (0-0.25): based on career achievements
 *    - 0.00: No F1 experience
 *    - 0.05: Has raced in F1
 *    - 0.10: Has scored points
 *    - 0.15: Has scored a podium
 *    - 0.20: Has won a race
 *    - 0.25: Has won a championship
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
const MIN_RACES_FOR_FULL_SEASON = 10; // Exclude part-time/substitute seasons

/**
 * Calculate experience scalar based on career achievements.
 * Returns 0-0.25 based on highest achievement:
 * - 0.00: No F1 experience
 * - 0.05: Has raced in F1
 * - 0.10: Has scored points
 * - 0.15: Has scored a podium
 * - 0.20: Has won a race
 * - 0.25: Has won a championship
 */
function calculateExperienceScalar(careerHistory) {
  if (!careerHistory || careerHistory.length === 0) {
    return 0.00; // No F1 experience
  }

  let hasRaced = false;
  let hasPoints = false;
  let hasPodium = false;
  let hasWin = false;
  let hasChampionship = false;

  for (const season of careerHistory) {
    // Check for championship
    if (season.championshipPosition === 1) {
      hasChampionship = true;
    }

    // Check individual races
    for (const race of season.races || []) {
      hasRaced = true;
      if (race.points > 0) hasPoints = true;
      if (race.position !== null && race.position <= 3) hasPodium = true;
      if (race.position === 1) hasWin = true;
    }
  }

  // Return highest achievement scalar
  if (hasChampionship) return 0.25;
  if (hasWin) return 0.20;
  if (hasPodium) return 0.15;
  if (hasPoints) return 0.10;
  if (hasRaced) return 0.05;
  return 0.00;
}

/**
 * Calculate perceived value from career history using three components:
 * 1. Contribution ratio (0-0.375): weighted avg of (driver pts / team pts)
 * 2. Championship position (0-0.375): normalized position (1st = 0.375, 20th = 0)
 * 3. Experience scalar (0-0.25): based on career achievements
 *
 * Returns a value from 0 to 1.0.
 */
function calculatePerceivedValue(careerHistory) {
  // Calculate experience scalar (0-0.25)
  const experienceScalar = calculateExperienceScalar(careerHistory);

  if (!careerHistory || careerHistory.length === 0) {
    return 0.375 + experienceScalar; // Neutral base (0.5 * 0.75) + experience
  }

  // Filter out part-time/substitute seasons (fewer than 10 races)
  const fullSeasons = careerHistory.filter(
    (season) => (season.races?.length || 0) >= MIN_RACES_FOR_FULL_SEASON
  );

  if (fullSeasons.length === 0) {
    return 0.375 + experienceScalar; // No full seasons, use neutral base
  }

  // Sort by season descending (most recent first)
  const sorted = [...fullSeasons].sort((a, b) => b.season - a.season);
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
    return 0.375 + experienceScalar;
  }

  // Components: contribution (0-0.375) + position (0-0.375) + experience (0-0.25) = 0-1.0
  const contributionComponent = (contributionWeightedSum / totalWeight) * 0.375;
  const positionComponent = (positionWeightedSum / totalWeight) * 0.375;

  return contributionComponent + positionComponent + experienceScalar;
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
