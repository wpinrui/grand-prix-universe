/**
 * Fetch F1 Race History from Ergast API
 *
 * This script fetches race results for 2020-2024 seasons and transforms them
 * into our CareerSeasonRecord format for drivers.json
 *
 * Usage: node scripts/fetch-f1-history.js
 */

const fs = require('fs');
const path = require('path');

// Jolpica F1 API base URL (Ergast replacement)
// See: https://github.com/jolpica/jolpica-f1
const API_BASE = 'https://api.jolpi.ca/ergast/f1';

// Seasons to fetch (entire modern F1 era for career data)
const START_YEAR = 2010;
const END_YEAR = 2024;
const SEASONS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

// Map Ergast driver IDs to our driver IDs
// Only include drivers that exist in our drivers.json
const DRIVER_ID_MAP = {
  // Current grid (2025)
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

  // Recent ex-F1 drivers in our game
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

  // Historical drivers in our game (2010+)
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

  // Skip drivers not in our game
  'mazepin': null,
  'haryanto': null,
  'merhi': null,
  'stevens': null,
};

// Map Ergast team IDs to our team IDs
const TEAM_ID_MAP = {
  'red_bull': 'red-bull-racing',
  'ferrari': 'ferrari',
  'mclaren': 'mclaren',
  'mercedes': 'mercedes',
  'aston_martin': 'aston-martin',
  'alpine': 'alpine',
  'alphatauri': 'racing-bulls',
  'rb': 'racing-bulls',
  'haas': 'haas',
  'williams': 'williams',
  'alfa': 'kick-sauber',
  'sauber': 'kick-sauber',
  'racing_point': 'aston-martin', // Racing Point became Aston Martin
  'renault': 'alpine', // Renault became Alpine
  'toro_rosso': 'racing-bulls', // Toro Rosso became AlphaTauri/RB
};

// Sleep helper for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch JSON from URL with retry logic
async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);
    if (response.ok) {
      return response.json();
    }
    if (response.status === 429) {
      // Rate limited - wait and retry
      const waitTime = (i + 1) * 5000; // 5s, 10s, 15s
      console.log(`    Rate limited, waiting ${waitTime / 1000}s...`);
      await sleep(waitTime);
      continue;
    }
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  throw new Error(`Max retries exceeded: ${url}`);
}

// Fetch all race results for a season (with pagination)
async function fetchSeasonResults(season) {
  console.log(`Fetching ${season} season data...`);

  let allRaces = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${API_BASE}/${season}/results.json?limit=${limit}&offset=${offset}`;
    const data = await fetchJson(url);

    const races = data.MRData.RaceTable.Races;
    if (races.length === 0) break;

    allRaces = allRaces.concat(races);
    offset += limit;

    // Check if we got all results
    const total = parseInt(data.MRData.total);
    if (offset >= total) break;

    await sleep(1000); // Rate limit between pages
  }

  // Deduplicate races by round (API may return duplicates across pages)
  const uniqueRaces = [];
  const seenRounds = new Set();
  for (const race of allRaces) {
    if (!seenRounds.has(race.round)) {
      seenRounds.add(race.round);
      uniqueRaces.push(race);
    }
  }

  console.log(`  Found ${uniqueRaces.length} races`);
  return uniqueRaces;
}

// Fetch constructor standings for team points
async function fetchConstructorStandings(season) {
  const url = `${API_BASE}/${season}/constructorStandings.json`;
  const data = await fetchJson(url);

  const standings = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
  const teamPoints = {};

  for (const standing of standings) {
    const teamId = TEAM_ID_MAP[standing.Constructor.constructorId];
    if (teamId) {
      teamPoints[teamId] = parseFloat(standing.points);
    }
  }

  return teamPoints;
}

// Process race results into our format
function processSeasonData(races, teamPoints, season) {
  // Build driver season data
  const driverSeasons = {};

  for (const race of races) {
    const raceNumber = parseInt(race.round);
    const raceName = race.raceName;
    const circuitId = race.Circuit.circuitId;

    for (const result of race.Results) {
      const ergastDriverId = result.Driver.driverId;
      const ourDriverId = DRIVER_ID_MAP[ergastDriverId];

      if (!ourDriverId) continue; // Skip drivers not in our game

      const ergastTeamId = result.Constructor.constructorId;
      const ourTeamId = TEAM_ID_MAP[ergastTeamId];

      if (!ourTeamId) continue; // Skip unknown teams

      // Initialize driver season if needed
      if (!driverSeasons[ourDriverId]) {
        driverSeasons[ourDriverId] = {
          season,
          teamId: ourTeamId,
          races: [],
          totalPoints: 0,
        };
      }

      // Parse position (null if DNF/DNS)
      let position = parseInt(result.position);
      if (isNaN(position) || result.status !== 'Finished' && !result.status.includes('Lap')) {
        // DNF but completed some laps still gets classified
        if (result.status.includes('Lap') || result.status === 'Finished') {
          position = parseInt(result.position);
        } else {
          position = null;
        }
      }

      const points = parseFloat(result.points) || 0;

      driverSeasons[ourDriverId].races.push({
        round: raceNumber,
        name: raceName,
        circuitId,
        position,
        points,
        status: result.status,
      });

      driverSeasons[ourDriverId].totalPoints += points;
    }
  }

  // Add team points to each driver's season
  for (const driverId of Object.keys(driverSeasons)) {
    const driverSeason = driverSeasons[driverId];
    driverSeason.teamTotalPoints = teamPoints[driverSeason.teamId] || 0;
  }

  return driverSeasons;
}

// Main function
async function main() {
  console.log('Fetching F1 race history from Ergast API...\n');

  const allDriverData = {};

  for (const season of SEASONS) {
    try {
      const races = await fetchSeasonResults(season);
      await sleep(2000); // Rate limit

      const teamPoints = await fetchConstructorStandings(season);
      await sleep(2000);

      const seasonData = processSeasonData(races, teamPoints, season);

      // Merge into allDriverData
      for (const [driverId, data] of Object.entries(seasonData)) {
        if (!allDriverData[driverId]) {
          allDriverData[driverId] = [];
        }
        allDriverData[driverId].push(data);
      }

      console.log(`  Processed ${Object.keys(seasonData).length} drivers\n`);
    } catch (err) {
      console.error(`Error fetching ${season}: ${err.message}`);
    }
  }

  // Sort each driver's seasons by year (most recent first)
  for (const driverId of Object.keys(allDriverData)) {
    allDriverData[driverId].sort((a, b) => b.season - a.season);
  }

  // Output to file
  const outputPath = path.join(__dirname, 'f1-race-history.json');
  fs.writeFileSync(outputPath, JSON.stringify(allDriverData, null, 2));

  console.log(`\nDone! Output written to: ${outputPath}`);
  console.log(`Total drivers: ${Object.keys(allDriverData).length}`);

  // Print summary
  console.log('\nDriver summary:');
  for (const [driverId, seasons] of Object.entries(allDriverData)) {
    const totalRaces = seasons.reduce((sum, s) => sum + s.races.length, 0);
    console.log(`  ${driverId}: ${seasons.length} seasons, ${totalRaces} races`);
  }
}

main().catch(console.error);
