/**
 * Add championship positions to existing F1 career history data
 * Much faster than re-fetching everything - just fetches driver standings
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.jolpi.ca/ergast/f1';
const START_YEAR = 2010;
const END_YEAR = 2024;

// Map Ergast driver IDs to our driver IDs
const DRIVER_ID_MAP = {
  'max_verstappen': 'max-verstappen',
  'leclerc': 'charles-leclerc',
  'norris': 'lando-norris',
  'russell': 'george-russell',
  'piastri': 'oscar-piastri',
  'hamilton': 'lewis-hamilton',
  'sainz': 'carlos-sainz',
  'alonso': 'fernando-alonso',
  'hulkenberg': 'nico-hulkenberg',
  'albon': 'alex-albon',
  'gasly': 'pierre-gasly',
  'bottas': 'valtteri-bottas',
  'ocon': 'esteban-ocon',
  'perez': 'sergio-perez',
  'tsunoda': 'yuki-tsunoda',
  'stroll': 'lance-stroll',
  'colapinto': 'franco-colapinto',
  'lawson': 'liam-lawson',
  'bearman': 'oliver-bearman',
  'ricciardo': 'daniel-ricciardo',
  'magnussen': 'kevin-magnussen',
  'kevin_magnussen': 'kevin-magnussen',
  'zhou': 'zhou-guanyu',
  'latifi': 'nicholas-latifi',
  'de_vries': 'nyck-de-vries',
  'sargeant': 'logan-sargeant',
  'vettel': 'sebastian-vettel',
  'raikkonen': 'kimi-raikkonen',
  'giovinazzi': 'antonio-giovinazzi',
  'mick_schumacher': 'mick-schumacher',
  'kvyat': 'daniil-kvyat',
  'grosjean': 'romain-grosjean',
  'rosberg': 'nico-rosberg',
  'button': 'jenson-button',
  'massa': 'felipe-massa',
  'maldonado': 'pastor-maldonado',
  'ericsson': 'marcus-ericsson',
  'gutierrez': 'esteban-gutierrez',
  'jolyon_palmer': 'jolyon-palmer',
  'wehrlein': 'pascal-wehrlein',
  'nasr': 'felipe-nasr',
  'vergne': 'jean-eric-vergne',
  'buemi': 'sebastien-buemi',
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    if (response.status === 429) {
      const wait = (i + 1) * 5000;
      console.log(`  Rate limited, waiting ${wait/1000}s...`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${response.status}`);
  }
  throw new Error('Max retries');
}

async function fetchDriverStandings(season) {
  const url = `${API_BASE}/${season}/driverStandings.json`;
  const data = await fetchJson(url);

  const standings = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
  const positions = {};

  for (const s of standings) {
    const ourId = DRIVER_ID_MAP[s.Driver.driverId];
    if (ourId) {
      positions[ourId] = parseInt(s.position);
    }
  }

  return positions;
}

async function main() {
  // Load existing data
  const driversPath = path.join(__dirname, '..', 'data', 'content', 'drivers.json');
  const driversFile = JSON.parse(fs.readFileSync(driversPath, 'utf8'));
  const drivers = driversFile.drivers;

  console.log('Fetching championship positions...\n');

  // Collect all positions by season
  const positionsBySeason = {};

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    console.log(`Fetching ${year}...`);
    try {
      positionsBySeason[year] = await fetchDriverStandings(year);
      console.log(`  Got ${Object.keys(positionsBySeason[year]).length} drivers`);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      positionsBySeason[year] = {};
    }
    await sleep(2000);
  }

  // Update drivers.json
  let updated = 0;
  for (const driver of drivers) {
    if (!driver.careerHistory) continue;

    for (const season of driver.careerHistory) {
      const positions = positionsBySeason[season.season];
      if (positions && positions[driver.id]) {
        season.championshipPosition = positions[driver.id];
        updated++;
      }
    }
  }

  fs.writeFileSync(driversPath, JSON.stringify(driversFile, null, 2));
  console.log(`\nDone! Updated ${updated} season records in drivers.json`);
}

main().catch(console.error);
