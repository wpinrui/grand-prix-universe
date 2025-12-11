/**
 * Fetch missing F1 years (2023-2024) and merge with existing data
 * Fixed to handle pagination properly
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.jolpi.ca/ergast/f1';
const SEASONS = [2023, 2024];

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
  'sargeant': 'logan-sargeant',
  'de_vries': 'nyck-de-vries',
};

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
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      if (response.status === 429) {
        const wait = (i + 1) * 10000;
        console.log(`  Rate limited, waiting ${wait/1000}s...`);
        await sleep(wait);
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(5000);
    }
  }
}

async function fetchAllResults(season) {
  console.log(`\nFetching ${season} results...`);

  const allRaces = new Map(); // round -> race data with results
  let offset = 0;
  const limit = 100;
  let total = 0;

  do {
    const url = `${API_BASE}/${season}/results.json?limit=${limit}&offset=${offset}`;
    console.log(`  Fetching offset ${offset}...`);
    const data = await fetchJson(url);
    total = parseInt(data.MRData.total);

    // Merge races - the API returns races with partial results per page
    for (const race of data.MRData.RaceTable.Races) {
      const round = race.round;
      if (!allRaces.has(round)) {
        allRaces.set(round, {
          round: parseInt(round),
          name: race.raceName,
          circuitId: race.Circuit.circuitId,
          results: [],
        });
      }
      // Add results from this page
      for (const result of race.Results) {
        allRaces.get(round).results.push(result);
      }
    }

    offset += limit;
    await sleep(2000); // Rate limit
  } while (offset < total);

  console.log(`  Total: ${allRaces.size} races, ${total} results`);
  return Array.from(allRaces.values());
}

async function fetchSeason(season) {
  const races = await fetchAllResults(season);

  await sleep(3000);

  // Fetch standings
  console.log(`  Fetching constructor standings...`);
  const standingsUrl = `${API_BASE}/${season}/constructorStandings.json`;
  const standingsData = await fetchJson(standingsUrl);
  const standings = standingsData.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];

  const teamPoints = {};
  for (const s of standings) {
    const teamId = TEAM_ID_MAP[s.Constructor.constructorId];
    if (teamId) teamPoints[teamId] = parseFloat(s.points);
  }

  // Process driver data
  const driverSeasons = {};

  for (const race of races) {
    for (const result of race.results) {
      const driverId = DRIVER_ID_MAP[result.Driver.driverId];
      const teamId = TEAM_ID_MAP[result.Constructor.constructorId];
      if (!driverId || !teamId) continue;

      if (!driverSeasons[driverId]) {
        driverSeasons[driverId] = {
          season,
          teamId,
          races: [],
          totalPoints: 0,
        };
      }

      let position = parseInt(result.position);
      if (isNaN(position)) position = null;
      const points = parseFloat(result.points) || 0;

      driverSeasons[driverId].races.push({
        round: race.round,
        name: race.name,
        circuitId: race.circuitId,
        position,
        points,
        status: result.status,
      });

      driverSeasons[driverId].totalPoints += points;
    }
  }

  // Sort races by round for each driver
  for (const d of Object.values(driverSeasons)) {
    d.races.sort((a, b) => a.round - b.round);
    d.teamTotalPoints = teamPoints[d.teamId] || 0;
  }

  return driverSeasons;
}

async function main() {
  // Load existing data
  const existingPath = path.join(__dirname, 'f1-race-history.json');
  let allData = {};
  if (fs.existsSync(existingPath)) {
    allData = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
    console.log(`Loaded existing data for ${Object.keys(allData).length} drivers`);
  }

  for (const season of SEASONS) {
    await sleep(5000); // Wait between seasons
    try {
      const seasonData = await fetchSeason(season);
      console.log(`  Processed ${Object.keys(seasonData).length} drivers`);

      for (const [driverId, data] of Object.entries(seasonData)) {
        if (!allData[driverId]) allData[driverId] = [];
        // Remove existing season if present
        allData[driverId] = allData[driverId].filter(s => s.season !== season);
        allData[driverId].push(data);
        allData[driverId].sort((a, b) => b.season - a.season);
      }
    } catch (err) {
      console.error(`Error fetching ${season}:`, err.message);
    }
  }

  fs.writeFileSync(existingPath, JSON.stringify(allData, null, 2));
  console.log('\nDone! Updated f1-race-history.json');

  // Print summary
  console.log('\nSummary for 2023-2024:');
  for (const [driverId, seasons] of Object.entries(allData)) {
    const s23 = seasons.find(s => s.season === 2023);
    const s24 = seasons.find(s => s.season === 2024);
    if (s23 || s24) {
      console.log(`  ${driverId}: 2023=${s23?.races.length || 0} races, 2024=${s24?.races.length || 0} races`);
    }
  }
}

main().catch(console.error);
