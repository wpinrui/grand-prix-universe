import { useState, useMemo, useEffect } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, HeaderCell, Dropdown } from '../components';
import { FlagIcon } from '../components/FlagIcon';
import { seasonToYear } from '../../shared/utils/date-utils';
import {
  isHistoricalRetiredStatus,
  getHistoricalPositionStyle,
  getMedalPositionStyle,
  getFullName,
} from '../utils/format';
import {
  TABLE_CELL_BASE,
  TABLE_HEADER_CLASS,
  TABLE_HEADER_ROW_CLASS,
  TABLE_BODY_CLASS,
  getHighlightedRowStyles,
  GHOST_BUTTON_CLASSES,
} from '../utils/theme-styles';
import type {
  CalendarEntry,
  Circuit,
  Driver,
  Team,
  DriverStanding,
  RaceWeekendResult,
  DriverRaceResult,
  RaceFinishStatus,
  CareerSeasonRecord,
  HistoricalRaceResult,
} from '../../shared/domain';

// ===========================================
// HISTORICAL CIRCUIT ID TO COUNTRY MAPPING
// ===========================================
// Maps Ergast API circuit IDs to country names for flag display

const HISTORICAL_CIRCUIT_COUNTRY: Record<string, string> = {
  albert_park: 'Australia',
  americas: 'United States',
  bahrain: 'Bahrain',
  baku: 'Azerbaijan',
  buddh: 'India',
  catalunya: 'Spain',
  hockenheimring: 'Germany',
  hungaroring: 'Hungary',
  imola: 'Italy',
  interlagos: 'Brazil',
  istanbul: 'Turkey',
  jeddah: 'Saudi Arabia',
  losail: 'Qatar',
  marina_bay: 'Singapore',
  miami: 'United States',
  monaco: 'Monaco',
  monza: 'Italy',
  mugello: 'Italy',
  nurburgring: 'Germany',
  portimao: 'Portugal',
  red_bull_ring: 'Austria',
  ricard: 'France',
  rodriguez: 'Mexico',
  sepang: 'Malaysia',
  shanghai: 'China',
  silverstone: 'United Kingdom',
  sochi: 'Russia',
  spa: 'Belgium',
  suzuka: 'Japan',
  valencia: 'Spain',
  vegas: 'United States',
  villeneuve: 'Canada',
  yas_marina: 'United Arab Emirates',
  yeongam: 'South Korea',
  zandvoort: 'Netherlands',
};

function getHistoricalCircuitCountry(circuitId: string): string {
  return HISTORICAL_CIRCUIT_COUNTRY[circuitId] ?? '';
}

// ===========================================
// TYPES
// ===========================================

type ViewState =
  | { type: 'grid' }
  | { type: 'race'; raceNumber: number };

// ===========================================
// ENTITY LOOKUP HELPERS
// ===========================================

interface EntityLookups {
  getDriver: (id: string) => Driver | undefined;
  getTeam: (id: string) => Team | undefined;
  getCircuit: (id: string) => Circuit | undefined;
}

function createEntityLookups(
  drivers: Driver[],
  teams: Team[],
  circuits: Circuit[]
): EntityLookups {
  return {
    getDriver: (id: string) => drivers.find((d) => d.id === id),
    getTeam: (id: string) => teams.find((t) => t.id === id),
    getCircuit: (id: string) => circuits.find((c) => c.id === id),
  };
}

function formatDriverName(driver: Driver | undefined, fallbackId: string): string {
  return driver ? getFullName(driver) : fallbackId;
}

function sortRaceResults(results: DriverRaceResult[]): DriverRaceResult[] {
  return [...results].sort((a, b) => {
    if (a.finishPosition !== null && b.finishPosition !== null) {
      return a.finishPosition - b.finishPosition;
    }
    if (a.finishPosition !== null) return -1;
    if (b.finishPosition !== null) return 1;
    return b.lapsCompleted - a.lapsCompleted;
  });
}

// ===========================================
// POSITION CELL STYLING
// ===========================================

function getPositionStyle(
  position: number | null,
  status: RaceFinishStatus,
  pointsPositions: number
): string {
  // Handle non-classified finishes by status
  if (position === null) {
    switch (status) {
      case 'disqualified':
        return 'bg-neutral-900 text-neutral-400 font-bold'; // Black for DSQ
      case 'retired':
        return 'bg-purple-600/50 text-purple-200'; // Purple for Ret
      case 'dns':
      case 'dnq':
        return 'bg-red-600/40 text-red-300'; // Red for DNS/DNQ
      default:
        return 'bg-red-600/40 text-red-300'; // Red fallback
    }
  }

  // Podium positions (use shared medal styling)
  const medalStyle = getMedalPositionStyle(position);
  if (medalStyle) return medalStyle;

  // Points finish - pale green (Wikipedia style)
  if (position <= pointsPositions) return 'bg-[#99b382] text-neutral-900';

  // Outside points
  return 'bg-[var(--neutral-700)]/50 text-muted';
}

function formatPosition(position: number | null, status: RaceFinishStatus): string {
  if (position !== null) return String(position);
  const statusMap: Partial<Record<RaceFinishStatus, string>> = {
    retired: 'Ret',
    disqualified: 'DSQ',
    dns: 'DNS',
    dnq: 'DNQ',
  };
  return statusMap[status] ?? 'DNF';
}

function formatLapTime(timeMs: number): string {
  const totalSeconds = timeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`;
}

function formatGap(gapMs: number | undefined, lapsBehind: number | undefined): string {
  if (lapsBehind && lapsBehind > 0) {
    return `+${lapsBehind} lap${lapsBehind > 1 ? 's' : ''}`;
  }
  if (gapMs !== undefined && gapMs > 0) {
    return `+${(gapMs / 1000).toFixed(3)}`;
  }
  return '';
}

// ===========================================
// SHARED COMPONENTS
// ===========================================

interface BackButtonProps {
  onClick: () => void;
  label?: string;
}

function BackButton({ onClick, label = 'Back to Results' }: BackButtonProps) {
  return (
    <button type="button" onClick={onClick} className={`${GHOST_BUTTON_CLASSES} mb-4`}>
      &larr; {label}
    </button>
  );
}

interface DetailHeaderProps {
  flagCountry: string;
  title: string;
  subtitle: string;
}

function DetailHeader({ flagCountry, title, subtitle }: DetailHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <FlagIcon country={flagCountry} size="md" />
      <div>
        <h2 className="text-2xl font-bold text-primary">{title}</h2>
        <p className="text-secondary">{subtitle}</p>
      </div>
    </div>
  );
}

interface ClickableDriverNameProps {
  driver: Driver | undefined;
  fallbackId: string;
  onClick: () => void;
  nameStyle?: React.CSSProperties;
  className?: string;
}

function ClickableDriverName({
  driver,
  fallbackId,
  onClick,
  nameStyle,
  className = '',
}: ClickableDriverNameProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hover:underline font-semibold cursor-pointer ${className}`}
      style={nameStyle}
    >
      {formatDriverName(driver, fallbackId)}
    </button>
  );
}

// ===========================================
// SEASON RESULTS GRID
// ===========================================

interface ResultCellProps {
  result: DriverRaceResult | undefined;
  pointsPositions: number;
  onClick?: () => void;
}

function ResultCell({ result, pointsPositions, onClick }: ResultCellProps) {
  if (!result) {
    return <td className="w-9 px-0.5 py-1 text-center" />;
  }

  const style = getPositionStyle(result.finishPosition, result.status, pointsPositions);
  const text = formatPosition(result.finishPosition, result.status);

  return (
    <td className="w-9 px-0.5 py-1 text-center">
      <button
        type="button"
        onClick={onClick}
        className={`w-8 h-6 text-xs rounded ${style} hover:brightness-110 transition-all`}
      >
        {text}
      </button>
    </td>
  );
}

interface RaceHeaderCellProps {
  entry: CalendarEntry;
  circuit: Circuit | undefined;
  onClick: () => void;
}

function RaceHeaderCell({ entry, circuit, onClick }: RaceHeaderCellProps) {
  const countryCode = circuit?.country?.slice(0, 3).toUpperCase() ?? '???';

  return (
    <th className="w-9 px-0.5 py-2 text-center">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-0.5 hover:text-primary transition-colors group mx-auto"
        title={circuit?.name ?? entry.circuitId}
      >
        <FlagIcon country={circuit?.country ?? ''} size="sm" />
        <span className="text-[10px] text-muted group-hover:text-secondary uppercase">
          {countryCode}
        </span>
      </button>
    </th>
  );
}

interface DriverRowProps {
  standing: DriverStanding;
  driver: Driver | undefined;
  team: Team | undefined;
  calendar: CalendarEntry[];
  pointsPositions: number;
  isPlayerTeam: boolean;
  onDriverClick: () => void;
  onRaceClick: (raceNumber: number) => void;
}

function DriverRow({
  standing,
  driver,
  team,
  calendar,
  pointsPositions,
  isPlayerTeam,
  onDriverClick,
  onRaceClick,
}: DriverRowProps) {
  const styles = getHighlightedRowStyles(isPlayerTeam);

  const resultsByRace = useMemo(() => {
    const map = new Map<number, DriverRaceResult>();
    for (const entry of calendar) {
      if (entry.result) {
        const driverResult = entry.result.race.find((r) => r.driverId === standing.driverId);
        if (driverResult) {
          map.set(entry.raceNumber, driverResult);
        }
      }
    }
    return map;
  }, [calendar, standing.driverId]);

  return (
    <tr className={styles.rowClass} style={styles.rowStyle}>
      <td className="w-12 px-3 py-2 text-center font-bold text-primary tabular-nums">
        {standing.position}
      </td>
      <td className="w-40 px-3 py-2 whitespace-nowrap">
        <ClickableDriverName
          driver={driver}
          fallbackId={standing.driverId}
          onClick={onDriverClick}
          nameStyle={styles.nameStyle}
          className="text-left text-primary"
        />
      </td>
      <td className="w-28 px-2 py-2 text-secondary text-sm whitespace-nowrap">
        {team?.shortName ?? standing.teamId}
      </td>
      {calendar.map((entry) => (
        <ResultCell
          key={entry.raceNumber}
          result={resultsByRace.get(entry.raceNumber)}
          pointsPositions={pointsPositions}
          onClick={() => entry.completed && onRaceClick(entry.raceNumber)}
        />
      ))}
      <td className="w-14 px-3 py-2 text-right font-bold text-primary tabular-nums">
        {standing.points}
      </td>
    </tr>
  );
}

interface SeasonGridProps {
  driverStandings: DriverStanding[];
  calendar: CalendarEntry[];
  lookups: EntityLookups;
  pointsPositions: number;
  playerTeamId: string;
  drivers: Driver[];
  teams: Team[];
  currentSeasonYear: number;
  onRaceClick: (raceNumber: number) => void;
  onDriverClick: (driverId: string) => void;
}

function SeasonGrid({
  driverStandings,
  calendar,
  lookups,
  pointsPositions,
  playerTeamId,
  drivers,
  teams,
  currentSeasonYear,
  onRaceClick,
  onDriverClick,
}: SeasonGridProps) {
  const { getDriver, getTeam, getCircuit } = lookups;

  // Build season options: current game season + all historical F1 seasons from ALL drivers
  const seasonOptions = useMemo((): SeasonOption[] => {
    const options: SeasonOption[] = [];

    // Current game season
    options.push({
      value: 'current',
      label: `${currentSeasonYear} (Current)`,
      type: 'current',
      year: currentSeasonYear,
    });

    // Collect all unique historical years from all drivers' career history
    const historicalYears = new Set<number>();
    for (const driver of drivers) {
      if (driver.careerHistory) {
        for (const season of driver.careerHistory) {
          historicalYears.add(season.season);
        }
      }
    }

    // Sort descending and add as options
    const sortedYears = Array.from(historicalYears).sort((a, b) => b - a);
    for (const year of sortedYears) {
      options.push({
        value: `f1-${year}`,
        label: `${year} (F1)`,
        type: 'historical',
        year,
      });
    }

    return options;
  }, [drivers, currentSeasonYear]);

  const [selectedSeason, setSelectedSeason] = useState<string>('current');

  // Always has at least the current season option, so fallback is guaranteed to exist
  const selectedSeasonOption = seasonOptions.find((s) => s.value === selectedSeason) ?? seasonOptions[0];
  const isHistorical = selectedSeasonOption.type === 'historical';

  // Build historical season data for all drivers
  const historicalData = useMemo(() => {
    if (!isHistorical) return null;

    const year = selectedSeasonOption.year;
    const driverData: Array<{
      driverId: string;
      driver: Driver;
      season: CareerSeasonRecord;
      team: Team | undefined;
    }> = [];

    for (const driver of drivers) {
      if (driver.careerHistory) {
        const season = driver.careerHistory.find((s) => s.season === year);
        if (season) {
          driverData.push({
            driverId: driver.id,
            driver,
            season,
            team: teams.find((t) => t.id === season.teamId),
          });
        }
      }
    }

    // Sort by championship position (if available) or total points
    driverData.sort((a, b) => {
      const posA = a.season.championshipPosition ?? 999;
      const posB = b.season.championshipPosition ?? 999;
      if (posA !== posB) return posA - posB;
      return b.season.totalPoints - a.season.totalPoints;
    });

    // Collect all unique races across all drivers for header display
    const raceMap = new Map<number, { round: number; name: string; circuitId: string }>();
    for (const { season } of driverData) {
      for (const race of season.races) {
        if (!raceMap.has(race.round)) {
          raceMap.set(race.round, { round: race.round, name: race.name, circuitId: race.circuitId });
        }
      }
    }
    const races = Array.from(raceMap.values()).sort((a, b) => a.round - b.round);

    return { driverData, races, year };
  }, [isHistorical, selectedSeasonOption.year, drivers, teams]);

  // Render historical season grid
  if (isHistorical && historicalData) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionHeading className="mb-0">{historicalData.year} Season Results</SectionHeading>
          <div className="w-48">
            <Dropdown
              value={selectedSeason}
              onChange={setSelectedSeason}
              options={seasonOptions.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>
        </div>
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={TABLE_HEADER_CLASS}>
              <tr className={TABLE_HEADER_ROW_CLASS}>
                <th className="w-12 px-3 py-3 text-center">Pos</th>
                <th className="w-40 px-3 py-3 text-left">Driver</th>
                <th className="w-28 px-2 py-3 text-left">Team</th>
                {historicalData.races.map((race) => {
                  const country = getHistoricalCircuitCountry(race.circuitId);
                  const countryCode = country.slice(0, 3).toUpperCase() || '???';
                  return (
                    <th key={race.round} className="w-9 px-0.5 py-2 text-center">
                      <div
                        className="flex flex-col items-center gap-0.5 mx-auto"
                        title={race.name}
                      >
                        <FlagIcon country={country} size="sm" />
                        <span className="text-[10px] text-muted uppercase">{countryCode}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="w-14 px-3 py-3 text-right">Pts</th>
              </tr>
            </thead>
            <tbody className={TABLE_BODY_CLASS}>
              {historicalData.driverData.map(({ driverId, driver, season, team }, index) => (
                <tr
                  key={driverId}
                  className="border-b border-[var(--neutral-700)] hover:bg-[var(--neutral-800)]/50"
                >
                  <td className="w-12 px-3 py-2 text-center font-bold text-primary tabular-nums">
                    {season.championshipPosition ?? index + 1}
                  </td>
                  <td className="w-40 px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onDriverClick(driverId)}
                      className="hover:underline font-semibold text-left text-primary cursor-pointer"
                    >
                      {getFullName(driver)}
                    </button>
                  </td>
                  <td className="w-28 px-2 py-2 text-secondary text-sm whitespace-nowrap">
                    {team?.shortName ?? season.teamId}
                  </td>
                  {historicalData.races.map((raceInfo) => {
                    const race = season.races.find((r) => r.round === raceInfo.round);
                    if (!race) {
                      return <td key={raceInfo.round} className="w-9 px-0.5 py-1 text-center" />;
                    }
                    return (
                      <HistoricalResultCell
                        key={raceInfo.round}
                        result={race}
                        pointsPositions={10} // F1 top 10 score points
                      />
                    );
                  })}
                  <td className="w-14 px-3 py-2 text-right font-bold text-primary tabular-nums">
                    {season.totalPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // Render current season grid
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading className="mb-0">Season Results</SectionHeading>
        {seasonOptions.length > 1 && (
          <div className="w-48">
            <Dropdown
              value={selectedSeason}
              onChange={setSelectedSeason}
              options={seasonOptions.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>
        )}
      </div>
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={TABLE_HEADER_CLASS}>
            <tr className={TABLE_HEADER_ROW_CLASS}>
              <th className="w-12 px-3 py-3 text-center">Pos</th>
              <th className="w-40 px-3 py-3 text-left">Driver</th>
              <th className="w-28 px-2 py-3 text-left">Team</th>
              {calendar.map((entry) => (
                <RaceHeaderCell
                  key={entry.raceNumber}
                  entry={entry}
                  circuit={getCircuit(entry.circuitId)}
                  onClick={() => entry.completed && onRaceClick(entry.raceNumber)}
                />
              ))}
              <th className="w-14 px-3 py-3 text-right">Pts</th>
            </tr>
          </thead>
          <tbody className={TABLE_BODY_CLASS}>
            {driverStandings.map((standing) => (
              <DriverRow
                key={standing.driverId}
                standing={standing}
                driver={getDriver(standing.driverId)}
                team={getTeam(standing.teamId)}
                calendar={calendar}
                pointsPositions={pointsPositions}
                isPlayerTeam={standing.teamId === playerTeamId}
                onDriverClick={() => onDriverClick(standing.driverId)}
                onRaceClick={onRaceClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ===========================================
// RACE DETAIL VIEW
// ===========================================

interface RaceDetailViewProps {
  result: RaceWeekendResult;
  circuit: Circuit | undefined;
  lookups: EntityLookups;
  playerTeamId: string;
  onBack: () => void;
  onDriverClick: (driverId: string) => void;
}

function RaceDetailView({
  result,
  circuit,
  lookups,
  playerTeamId,
  onBack,
  onDriverClick,
}: RaceDetailViewProps) {
  const { getDriver, getTeam } = lookups;

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack} />
      <DetailHeader
        flagCountry={circuit?.country ?? ''}
        title={circuit?.name ?? result.circuitId}
        subtitle={`Round ${result.raceNumber}`}
      />

      {/* Qualifying Results */}
      <section>
        <SectionHeading>Qualifying Classification</SectionHeading>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className={TABLE_HEADER_CLASS}>
              <tr className={TABLE_HEADER_ROW_CLASS}>
                <HeaderCell className="w-14">Pos</HeaderCell>
                <HeaderCell align="left">Driver</HeaderCell>
                <HeaderCell align="left">Team</HeaderCell>
                <HeaderCell className="w-28">Time</HeaderCell>
                <HeaderCell className="w-24">Gap</HeaderCell>
              </tr>
            </thead>
            <tbody className={TABLE_BODY_CLASS}>
              {result.qualifying
                .sort((a, b) => a.gridPosition - b.gridPosition)
                .map((q) => {
                  const driver = getDriver(q.driverId);
                  const team = getTeam(q.teamId);
                  const isPlayer = q.teamId === playerTeamId;
                  const rowStyles = getHighlightedRowStyles(isPlayer);

                  return (
                    <tr key={q.driverId} className={rowStyles.rowClass} style={rowStyles.rowStyle}>
                      <td className={`${TABLE_CELL_BASE} text-center font-bold tabular-nums`}>
                        {q.gridPosition}
                      </td>
                      <td className={TABLE_CELL_BASE}>
                        <ClickableDriverName
                          driver={driver}
                          fallbackId={q.driverId}
                          onClick={() => onDriverClick(q.driverId)}
                          nameStyle={rowStyles.nameStyle}
                        />
                      </td>
                      <td className={`${TABLE_CELL_BASE} text-secondary`}>
                        {team?.name ?? q.teamId}
                      </td>
                      <td className={`${TABLE_CELL_BASE} text-center tabular-nums`}>
                        {formatLapTime(q.bestLapTime)}
                      </td>
                      <td className={`${TABLE_CELL_BASE} text-center tabular-nums text-muted`}>
                        {q.gapToPole > 0 ? `+${(q.gapToPole / 1000).toFixed(3)}` : ''}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Race Results */}
      <section>
        <SectionHeading>Race Classification</SectionHeading>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className={TABLE_HEADER_CLASS}>
              <tr className={TABLE_HEADER_ROW_CLASS}>
                <HeaderCell className="w-14">Pos</HeaderCell>
                <HeaderCell align="left">Driver</HeaderCell>
                <HeaderCell align="left">Team</HeaderCell>
                <HeaderCell className="w-16">Laps</HeaderCell>
                <HeaderCell className="w-32">Time/Status</HeaderCell>
                <HeaderCell className="w-16">Grid</HeaderCell>
                <HeaderCell className="w-14">Pts</HeaderCell>
              </tr>
            </thead>
            <tbody className={TABLE_BODY_CLASS}>
              {sortRaceResults(result.race).map((r) => {
                  const driver = getDriver(r.driverId);
                  const team = getTeam(r.teamId);
                  const isPlayer = r.teamId === playerTeamId;
                  const rowStyles = getHighlightedRowStyles(isPlayer);

                  return (
                    <tr key={r.driverId} className={rowStyles.rowClass} style={rowStyles.rowStyle}>
                      <td className={`${TABLE_CELL_BASE} text-center font-bold tabular-nums`}>
                        {formatPosition(r.finishPosition, r.status)}
                      </td>
                      <td className={TABLE_CELL_BASE}>
                        <ClickableDriverName
                          driver={driver}
                          fallbackId={r.driverId}
                          onClick={() => onDriverClick(r.driverId)}
                          nameStyle={rowStyles.nameStyle}
                        />
                      </td>
                      <td className={`${TABLE_CELL_BASE} text-secondary`}>
                        {team?.name ?? r.teamId}
                      </td>
                      <td className={`${TABLE_CELL_BASE} text-center tabular-nums`}>
                        {r.lapsCompleted}
                      </td>
                      <td className={`${TABLE_CELL_BASE} text-center tabular-nums`}>
                        {r.finishPosition === 1
                          ? r.totalTime
                            ? formatLapTime(r.totalTime)
                            : ''
                          : r.finishPosition !== null
                            ? formatGap(r.gapToWinner, r.lapsBehind)
                            : formatPosition(null, r.status)}
                      </td>
                      <td className={`${TABLE_CELL_BASE} text-center tabular-nums text-muted`}>
                        {r.gridPosition}
                      </td>
                      <td className={`${TABLE_CELL_BASE} text-center font-bold tabular-nums`}>
                        {r.points > 0 ? r.points : ''}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ===========================================
// HISTORICAL SEASON TYPES & COMPONENTS
// ===========================================

/** Season option for the dropdown */
interface SeasonOption {
  value: string;
  label: string;
  type: 'current' | 'historical';
  year: number;
}

/** Cell for historical race result */
interface HistoricalResultCellProps {
  result: HistoricalRaceResult;
  pointsPositions: number;
}

function HistoricalResultCell({ result, pointsPositions }: HistoricalResultCellProps) {
  const isRetired = isHistoricalRetiredStatus(result.status);
  const style = getHistoricalPositionStyle(result.position, result.status, pointsPositions);
  const text = isRetired ? 'Ret' : String(result.position);

  return (
    <td className="w-9 px-0.5 py-1 text-center">
      <div
        className={`w-8 h-6 text-xs rounded flex items-center justify-center mx-auto ${style}`}
        title={`${result.name}: ${result.position !== null ? `P${result.position}` : 'DNF'} - ${result.points} pts (${result.status})`}
      >
        {text}
      </div>
    </td>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

interface ResultsProps {
  initialRaceNumber?: number | null;
  onRaceViewed?: () => void;
  onNavigateToDriver?: (driverId: string) => void;
}

export function Results({ initialRaceNumber, onRaceViewed, onNavigateToDriver }: ResultsProps) {
  const { gameState, playerTeam } = useDerivedGameState();
  const [view, setView] = useState<ViewState>({ type: 'grid' });

  // Navigate to specific race when initialRaceNumber is provided
  useEffect(() => {
    if (initialRaceNumber !== null && initialRaceNumber !== undefined) {
      setView({ type: 'race', raceNumber: initialRaceNumber });
      onRaceViewed?.();
    }
  }, [initialRaceNumber, onRaceViewed]);

  const goToGrid = () => setView({ type: 'grid' });
  const goToRace = (raceNumber: number) => setView({ type: 'race', raceNumber });
  const goToDriver = (driverId: string) => onNavigateToDriver?.(driverId);

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading results...</p>
      </div>
    );
  }

  const { driverStandings, calendar } = gameState.currentSeason;
  const { drivers, teams, circuits, rules } = gameState;

  // Number of positions that score points (based on points system array length)
  const pointsPositions = rules.points.system.length;

  // Create lookups once and pass to child components
  const lookups = createEntityLookups(drivers, teams, circuits);
  const { getCircuit } = lookups;

  // Race detail view
  if (view.type === 'race') {
    const raceEntry = calendar.find((e) => e.raceNumber === view.raceNumber);
    if (raceEntry?.result) {
      return (
        <RaceDetailView
          result={raceEntry.result}
          circuit={getCircuit(raceEntry.circuitId)}
          lookups={lookups}
          playerTeamId={playerTeam.id}
          onBack={goToGrid}
          onDriverClick={goToDriver}
        />
      );
    }
  }

  // Main grid view
  return (
    <SeasonGrid
      driverStandings={driverStandings}
      calendar={calendar}
      lookups={lookups}
      pointsPositions={pointsPositions}
      playerTeamId={playerTeam.id}
      drivers={drivers}
      teams={teams}
      currentSeasonYear={seasonToYear(gameState.currentSeason.seasonNumber)}
      onRaceClick={goToRace}
      onDriverClick={goToDriver}
    />
  );
}
