/**
 * Merge F1 race history into drivers.json
 *
 * Reads the fetched f1-race-history.json and merges it into drivers.json,
 * updating each driver's careerHistory field.
 */

const fs = require('fs');
const path = require('path');

const HISTORY_PATH = path.join(__dirname, 'f1-race-history.json');
const DRIVERS_PATH = path.join(__dirname, '..', 'data', 'content', 'drivers.json');

function main() {
  // Load data
  const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  const driversData = JSON.parse(fs.readFileSync(DRIVERS_PATH, 'utf8'));

  console.log(`Loaded ${Object.keys(history).length} drivers from race history`);
  console.log(`Loaded ${driversData.drivers.length} drivers from drivers.json`);

  let updated = 0;
  let notFound = [];

  // Update each driver
  for (const driver of driversData.drivers) {
    const driverHistory = history[driver.id];

    if (driverHistory) {
      // Convert to our CareerSeasonRecord format
      driver.careerHistory = driverHistory.map(season => ({
        season: season.season,
        teamId: season.teamId,
        races: season.races,
        totalPoints: season.totalPoints,
        teamTotalPoints: season.teamTotalPoints,
      }));
      updated++;
      console.log(`  ✓ ${driver.id}: ${driverHistory.length} seasons, ${driverHistory.reduce((sum, s) => sum + s.races.length, 0)} races`);
    } else {
      // No F1 history - remove any existing careerHistory
      if (driver.careerHistory) {
        delete driver.careerHistory;
        console.log(`  - ${driver.id}: removed old careerHistory (no F1 data)`);
      }
      notFound.push(driver.id);
    }
  }

  // Write back
  fs.writeFileSync(DRIVERS_PATH, JSON.stringify(driversData, null, 2));

  console.log(`\nDone!`);
  console.log(`  Updated: ${updated} drivers`);
  console.log(`  No F1 data: ${notFound.length} drivers`);

  if (notFound.length > 0) {
    console.log(`\nDrivers without F1 history (rookies/fictional):`);
    for (const id of notFound) {
      console.log(`  - ${id}`);
    }
  }
}

main();
