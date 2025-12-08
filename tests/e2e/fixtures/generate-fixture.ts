/**
 * Fixture Generator for E2E Tests
 *
 * Generates a valid GameState JSON file with completed race data.
 * Run with: npx ts-node tests/e2e/fixtures/generate-fixture.ts
 *
 * Output: tests/e2e/fixtures/results-test-save.json
 *
 * To use the fixture:
 * 1. Run this script to generate the JSON
 * 2. Copy the output file to your app's save directory
 *    (Windows: %APPDATA%/grand-prix-universe/saves/)
 * 3. Load it from Options -> Saved Games in the app
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  GameState,
  Team,
  Driver,
  Circuit,
  Chief,
  Sponsor,
  Manufacturer,
  GameRules,
  SeasonRegulations,
  CalendarEntry,
  DriverStanding,
  ConstructorStanding,
  RaceWeekendResult,
  DriverQualifyingResult,
  DriverRaceResult,
  DriverRuntimeState,
  TeamRuntimeState,
  DepartmentStaffCounts,
  DepartmentMorale,
  ActiveSponsorDeal,
  ActiveManufacturerContract,
} from '../../../src/shared/domain';
import {
  GamePhase,
  Department,
  StaffQuality,
  RaceFinishStatus,
  WeatherCondition,
  ManufacturerType,
  ManufacturerDealType,
  SponsorTier,
} from '../../../src/shared/domain';

const DATA_DIR = path.join(__dirname, '../../../data');
const OUTPUT_PATH = path.join(__dirname, 'results-test-save.json');

// Helper to read JSON config files
function readJson<T>(relativePath: string): T {
  const fullPath = path.join(DATA_DIR, relativePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

// Generate a race result for all drivers
function generateRaceResult(
  raceNumber: number,
  circuitId: string,
  seasonNumber: number,
  drivers: Driver[],
  pointsSystem: number[]
): RaceWeekendResult {
  // Get drivers with race seats (sorted by team order for predictable results)
  const racingDrivers = drivers
    .filter((d) => d.teamId !== null && (d.role === 'first' || d.role === 'second'))
    .sort((a, b) => a.teamId!.localeCompare(b.teamId!));

  // Generate qualifying results (randomize a bit based on race number)
  const qualifying: DriverQualifyingResult[] = racingDrivers.map((driver, index) => {
    const gridPosition = ((index + raceNumber) % racingDrivers.length) + 1;
    const baseTime = 80000; // 1:20.000
    const gap = gridPosition === 1 ? 0 : (gridPosition - 1) * 150 + Math.random() * 50;

    return {
      driverId: driver.id,
      teamId: driver.teamId!,
      gridPosition,
      bestLapTime: baseTime + gap,
      gapToPole: gap,
    };
  }).sort((a, b) => a.gridPosition - b.gridPosition);

  // Generate race results (some variation from grid)
  const raceResults: DriverRaceResult[] = qualifying.map((q, index) => {
    // Shuffle finish positions slightly
    const finishPosition = Math.max(1, Math.min(racingDrivers.length, q.gridPosition + Math.floor(Math.random() * 5 - 2)));
    const isRetired = Math.random() < 0.1; // 10% chance of retirement

    return {
      driverId: q.driverId,
      teamId: q.teamId,
      finishPosition: isRetired ? null : finishPosition,
      gridPosition: q.gridPosition,
      lapsCompleted: isRetired ? Math.floor(Math.random() * 40) + 10 : 55,
      totalTime: isRetired ? undefined : 5400000 + (finishPosition - 1) * 15000, // ~1:30:00 + gaps
      gapToWinner: finishPosition === 1 || isRetired ? undefined : (finishPosition - 1) * 15000,
      points: isRetired ? 0 : (pointsSystem[finishPosition - 1] ?? 0),
      fastestLap: finishPosition === 1 && !isRetired,
      fastestLapTime: 78500 + Math.random() * 1000,
      status: isRetired ? RaceFinishStatus.Retired : RaceFinishStatus.Finished,
      pitStops: 2,
    };
  });

  // Sort race results by finish position (finishers first, then DNFs)
  raceResults.sort((a, b) => {
    if (a.finishPosition === null && b.finishPosition === null) return 0;
    if (a.finishPosition === null) return 1;
    if (b.finishPosition === null) return -1;
    return a.finishPosition - b.finishPosition;
  });

  // Assign proper positions after sorting
  let position = 1;
  for (const result of raceResults) {
    if (result.finishPosition !== null) {
      result.finishPosition = position++;
      result.points = pointsSystem[result.finishPosition - 1] ?? 0;
    }
  }

  const winner = raceResults.find((r) => r.finishPosition === 1);

  return {
    raceNumber,
    circuitId,
    seasonNumber,
    qualifying,
    race: raceResults,
    weather: WeatherCondition.Dry,
    fastestLapDriverId: winner?.driverId ?? racingDrivers[0].id,
    fastestLapTime: 78500,
  };
}

// Calculate standings from race results
function calculateStandings(
  calendar: CalendarEntry[],
  drivers: Driver[],
  teams: Team[]
): { driverStandings: DriverStanding[]; constructorStandings: ConstructorStanding[] } {
  const driverPoints: Record<string, { points: number; wins: number; podiums: number; poles: number; fastLaps: number; dnfs: number; teamId: string }> = {};
  const teamPoints: Record<string, { points: number; wins: number; podiums: number; poles: number }> = {};

  // Initialize
  for (const driver of drivers) {
    if (driver.teamId) {
      driverPoints[driver.id] = { points: 0, wins: 0, podiums: 0, poles: 0, fastLaps: 0, dnfs: 0, teamId: driver.teamId };
    }
  }
  for (const team of teams) {
    teamPoints[team.id] = { points: 0, wins: 0, podiums: 0, poles: 0 };
  }

  // Accumulate from completed races
  for (const entry of calendar) {
    if (!entry.completed || !entry.result) continue;

    for (const quali of entry.result.qualifying) {
      if (quali.gridPosition === 1) {
        if (driverPoints[quali.driverId]) driverPoints[quali.driverId].poles++;
        if (teamPoints[quali.teamId]) teamPoints[quali.teamId].poles++;
      }
    }

    for (const race of entry.result.race) {
      const dp = driverPoints[race.driverId];
      const tp = teamPoints[race.teamId];
      if (dp) {
        dp.points += race.points;
        if (race.finishPosition === 1) dp.wins++;
        if (race.finishPosition !== null && race.finishPosition <= 3) dp.podiums++;
        if (race.fastestLap) dp.fastLaps++;
        if (race.finishPosition === null) dp.dnfs++;
      }
      if (tp) {
        tp.points += race.points;
        if (race.finishPosition === 1) tp.wins++;
        if (race.finishPosition !== null && race.finishPosition <= 3) tp.podiums++;
      }
    }
  }

  // Convert to standings arrays
  const driverStandings: DriverStanding[] = Object.entries(driverPoints)
    .map(([driverId, stats]) => ({
      driverId,
      teamId: stats.teamId,
      points: stats.points,
      position: 0, // Set after sorting
      wins: stats.wins,
      podiums: stats.podiums,
      polePositions: stats.poles,
      fastestLaps: stats.fastLaps,
      dnfs: stats.dnfs,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  driverStandings.forEach((s, i) => { s.position = i + 1; });

  const constructorStandings: ConstructorStanding[] = Object.entries(teamPoints)
    .map(([teamId, stats]) => ({
      teamId,
      points: stats.points,
      position: 0,
      wins: stats.wins,
      podiums: stats.podiums,
      polePositions: stats.poles,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  constructorStandings.forEach((s, i) => { s.position = i + 1; });

  return { driverStandings, constructorStandings };
}

function main() {
  console.log('Generating test fixture...');

  // Load config data
  const teamsData = readJson<{ teams: Team[] }>('content/teams.json');
  const driversData = readJson<{ drivers: Driver[] }>('content/drivers.json');
  const circuitsData = readJson<{ circuits: Circuit[] }>('content/circuits.json');
  const chiefsData = readJson<{ chiefs: Chief[] }>('content/chiefs.json');
  const sponsorsData = readJson<{ sponsors: Sponsor[] }>('content/sponsors.json');
  const manufacturersData = readJson<{ manufacturers: Manufacturer[] }>('content/manufacturers.json');
  const rulesData = readJson<GameRules>('config/rules.json');
  const regulationsData = readJson<{ seasons: SeasonRegulations[]; default: SeasonRegulations }>('config/regulations.json');
  const scheduleData = readJson<{ schedule: Array<{ circuitId: string; weekNumber: number }> }>('content/race-schedule.json');

  const teams = teamsData.teams;
  const drivers = driversData.drivers;
  const circuits = circuitsData.circuits;
  const chiefs = chiefsData.chiefs;
  const sponsors = sponsorsData.sponsors;
  const manufacturers = manufacturersData.manufacturers;

  // Use first team as player team
  const playerTeam = teams[0];
  const seasonNumber = 1;
  const pointsSystem = rulesData.points.system;

  // Build calendar with 3 completed races
  const COMPLETED_RACES = 3;
  const calendar: CalendarEntry[] = scheduleData.schedule.map((item, index) => {
    const raceNumber = index + 1;
    const completed = raceNumber <= COMPLETED_RACES;

    const entry: CalendarEntry = {
      raceNumber,
      circuitId: item.circuitId,
      weekNumber: item.weekNumber,
      completed,
      cancelled: false,
    };

    if (completed) {
      entry.result = generateRaceResult(raceNumber, item.circuitId, seasonNumber, drivers, pointsSystem);
    }

    return entry;
  });

  // Calculate standings
  const { driverStandings, constructorStandings } = calculateStandings(calendar, drivers, teams);

  // Build runtime states
  const driverStates: Record<string, DriverRuntimeState> = {};
  for (const driver of drivers) {
    driverStates[driver.id] = {
      morale: 70,
      fitness: 100,
      fatigue: 10,
      injuryWeeksRemaining: 0,
      banRacesRemaining: 0,
      isAngry: false,
      engineUnitsUsed: 1,
      gearboxRaceCount: COMPLETED_RACES,
    };
  }

  const teamStates: Record<string, TeamRuntimeState> = {};
  for (const team of teams) {
    const morale: DepartmentMorale = {
      [Department.Commercial]: 70,
      [Department.Design]: 70,
      [Department.Engineering]: 70,
      [Department.Mechanics]: 70,
    };
    teamStates[team.id] = {
      morale,
      sponsorSatisfaction: {},
      staffCounts: team.initialStaffCounts,
      setupPoints: 50,
      developmentTesting: { handlingPercentage: 50, handlingProblemsFound: [] },
    };
  }

  // Build sponsor deals
  const sponsorDeals: ActiveSponsorDeal[] = [];
  for (const team of teams) {
    for (const sponsorId of team.initialSponsorIds) {
      const sponsor = sponsors.find((s) => s.id === sponsorId);
      if (sponsor) {
        sponsorDeals.push({
          sponsorId,
          teamId: team.id,
          tier: sponsor.tier,
          annualPayment: sponsor.payment,
          bonusLevel: 0,
          guaranteed: false,
          startSeason: 1,
          endSeason: 3,
        });
        teamStates[team.id].sponsorSatisfaction[sponsorId] = 60;
      }
    }
  }

  // Build manufacturer contracts
  const manufacturerContracts: ActiveManufacturerContract[] = [];
  for (const team of teams) {
    const engineManufacturer = manufacturers.find((m) => m.id === team.initialEngineManufacturerId);
    if (engineManufacturer) {
      manufacturerContracts.push({
        manufacturerId: engineManufacturer.id,
        teamId: team.id,
        type: ManufacturerType.Engine,
        dealType: ManufacturerDealType.Customer,
        annualCost: engineManufacturer.annualCost,
        bonusLevel: 0,
        startSeason: 1,
        endSeason: 3,
      });
    }
  }

  // Current date: week after last completed race
  const lastCompletedRace = calendar.find((c) => c.raceNumber === COMPLETED_RACES);
  const currentWeek = (lastCompletedRace?.weekNumber ?? 10) + 1;
  const currentDate = { year: 2025, month: Math.floor(currentWeek / 4) + 1, day: 15 };

  // Build complete GameState
  const gameState: GameState = {
    version: '1.0.0',
    gameId: 'test-fixture-' + Date.now(),
    createdAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),

    player: {
      name: 'Test Player',
      teamId: playerTeam.id,
      careerStartSeason: 1,
    },

    currentDate,
    phase: GamePhase.BetweenRaces,
    simulation: { isSimulating: false, speed: 1 },

    calendarEvents: [],

    currentSeason: {
      seasonNumber,
      calendar,
      driverStandings,
      constructorStandings,
      regulations: regulationsData.default,
    },

    teams,
    drivers,
    chiefs,
    sponsors,
    manufacturers,
    circuits,

    driverStates,
    teamStates,

    sponsorDeals,
    manufacturerContracts,

    pastSeasons: [],
    rules: rulesData,
  };

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(gameState, null, 2));
  console.log(`\nFixture generated: ${OUTPUT_PATH}`);
  console.log(`\nTo use this fixture:`);
  console.log(`1. Copy the file to your saves directory:`);
  console.log(`   Windows: %APPDATA%/grand-prix-universe/saves/`);
  console.log(`   Mac: ~/Library/Application Support/grand-prix-universe/saves/`);
  console.log(`   Linux: ~/.config/grand-prix-universe/saves/`);
  console.log(`2. Rename it to include a valid timestamp if needed`);
  console.log(`3. Load it from Options -> Saved Games in the app`);
}

main();
