import { useState, useMemo } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, HeaderCell } from '../components';
import { FlagIcon } from '../components/FlagIcon';
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
} from '../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type ViewState =
  | { type: 'grid' }
  | { type: 'race'; raceNumber: number }
  | { type: 'driver'; driverId: string };

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

  // Podium positions
  if (position === 1) return 'bg-amber-400/80 text-amber-950 font-bold';
  if (position === 2) return 'bg-gray-300/70 text-gray-800 font-bold';
  if (position === 3) return 'bg-orange-500/60 text-orange-100 font-bold';

  // Points finish - pale green (Wikipedia style)
  if (position <= pointsPositions) return 'bg-[#d4edda]/30 text-[#c3e6cb]';

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
  const driverName = driver ? `${driver.firstName} ${driver.lastName}` : standing.driverId;

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
      <td className="min-w-[140px] px-3 py-2 whitespace-nowrap">
        <button
          type="button"
          onClick={onDriverClick}
          className="text-left hover:underline font-semibold text-primary"
          style={styles.nameStyle}
        >
          {driverName}
        </button>
      </td>
      <td className="min-w-[180px] px-3 py-2 text-secondary text-sm whitespace-nowrap">
        {team?.name ?? standing.teamId}
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
  drivers: Driver[];
  teams: Team[];
  circuits: Circuit[];
  pointsPositions: number;
  playerTeamId: string;
  onRaceClick: (raceNumber: number) => void;
  onDriverClick: (driverId: string) => void;
}

function SeasonGrid({
  driverStandings,
  calendar,
  drivers,
  teams,
  circuits,
  pointsPositions,
  playerTeamId,
  onRaceClick,
  onDriverClick,
}: SeasonGridProps) {
  const getDriver = (id: string) => drivers.find((d) => d.id === id);
  const getTeam = (id: string) => teams.find((t) => t.id === id);
  const getCircuit = (id: string) => circuits.find((c) => c.id === id);

  return (
    <section>
      <SectionHeading>Season Results</SectionHeading>
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={TABLE_HEADER_CLASS}>
            <tr className={TABLE_HEADER_ROW_CLASS}>
              <th className="w-12 px-3 py-3 text-center">Pos</th>
              <th className="min-w-[140px] px-3 py-3 text-left">Driver</th>
              <th className="min-w-[180px] px-3 py-3 text-left">Team</th>
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
  drivers: Driver[];
  teams: Team[];
  playerTeamId: string;
  onBack: () => void;
  onDriverClick: (driverId: string) => void;
}

function RaceDetailView({
  result,
  circuit,
  drivers,
  teams,
  playerTeamId,
  onBack,
  onDriverClick,
}: RaceDetailViewProps) {
  const getDriver = (id: string) => drivers.find((d) => d.id === id);
  const getTeam = (id: string) => teams.find((t) => t.id === id);

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack} />

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <FlagIcon country={circuit?.country ?? ''} size="lg" />
        <div>
          <h2 className="text-2xl font-bold text-primary">{circuit?.name ?? result.circuitId}</h2>
          <p className="text-secondary">Round {result.raceNumber}</p>
        </div>
      </div>

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
                        <button
                          type="button"
                          onClick={() => onDriverClick(q.driverId)}
                          className="hover:underline font-semibold"
                          style={rowStyles.nameStyle}
                        >
                          {driver ? `${driver.firstName} ${driver.lastName}` : q.driverId}
                        </button>
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
              {result.race
                .sort((a, b) => {
                  if (a.finishPosition !== null && b.finishPosition !== null) {
                    return a.finishPosition - b.finishPosition;
                  }
                  if (a.finishPosition !== null) return -1;
                  if (b.finishPosition !== null) return 1;
                  return b.lapsCompleted - a.lapsCompleted;
                })
                .map((r) => {
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
                        <button
                          type="button"
                          onClick={() => onDriverClick(r.driverId)}
                          className="hover:underline font-semibold"
                          style={rowStyles.nameStyle}
                        >
                          {driver ? `${driver.firstName} ${driver.lastName}` : r.driverId}
                        </button>
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
// DRIVER CAREER VIEW
// ===========================================

interface DriverCareerViewProps {
  driver: Driver;
  team: Team | undefined;
  calendar: CalendarEntry[];
  circuits: Circuit[];
  pointsPositions: number;
  playerTeamId: string;
  onBack: () => void;
  onRaceClick: (raceNumber: number) => void;
}

function DriverCareerView({
  driver,
  team,
  calendar,
  circuits,
  pointsPositions,
  playerTeamId,
  onBack,
  onRaceClick,
}: DriverCareerViewProps) {
  const getCircuit = (id: string) => circuits.find((c) => c.id === id);
  const isPlayerTeam = driver.teamId === playerTeamId;
  const rowStyles = getHighlightedRowStyles(isPlayerTeam);

  const driverResults = useMemo(() => {
    const results: Array<{ entry: CalendarEntry; result: DriverRaceResult }> = [];
    for (const entry of calendar) {
      if (entry.result) {
        const driverResult = entry.result.race.find((r) => r.driverId === driver.id);
        if (driverResult) {
          results.push({ entry, result: driverResult });
        }
      }
    }
    return results;
  }, [calendar, driver.id]);

  const stats = useMemo(() => {
    let points = 0;
    let wins = 0;
    let podiums = 0;
    let dnfs = 0;

    for (const { result } of driverResults) {
      points += result.points;
      if (result.finishPosition === 1) wins++;
      if (result.finishPosition !== null && result.finishPosition <= 3) podiums++;
      if (result.finishPosition === null) dnfs++;
    }

    return { points, wins, podiums, dnfs, races: driverResults.length };
  }, [driverResults]);

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack} />

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <FlagIcon country={driver.nationality} size="lg" />
        <div>
          <h2 className="text-2xl font-bold text-primary">
            {driver.firstName} {driver.lastName}
          </h2>
          <p className="text-secondary">{team?.name ?? 'Free Agent'}</p>
        </div>
      </div>

      {/* Season Stats Summary */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Races', value: stats.races },
          { label: 'Points', value: stats.points },
          { label: 'Wins', value: stats.wins },
          { label: 'Podiums', value: stats.podiums },
          { label: 'DNFs', value: stats.dnfs },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4 text-center">
            <div className="text-3xl font-bold text-primary tabular-nums">{value}</div>
            <div className="text-sm text-muted uppercase">{label}</div>
          </div>
        ))}
      </div>

      {/* Results Grid */}
      <section>
        <SectionHeading>Season Results</SectionHeading>
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={TABLE_HEADER_CLASS}>
              <tr className={TABLE_HEADER_ROW_CLASS}>
                <th className="min-w-[180px] px-3 py-3 text-left">Team</th>
                {calendar.map((entry) => {
                  const circuit = getCircuit(entry.circuitId);
                  return (
                    <th key={entry.raceNumber} className="w-9 px-0.5 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5 mx-auto">
                        <FlagIcon country={circuit?.country ?? ''} size="sm" />
                      </div>
                    </th>
                  );
                })}
                <th className="w-14 px-3 py-3 text-right">Pts</th>
              </tr>
            </thead>
            <tbody className={TABLE_BODY_CLASS}>
              <tr className={rowStyles.rowClass} style={rowStyles.rowStyle}>
                <td className="min-w-[180px] px-3 py-2 whitespace-nowrap text-secondary">
                  {team?.name ?? 'N/A'}
                </td>
                {calendar.map((entry) => {
                  const driverResult = driverResults.find(
                    (r) => r.entry.raceNumber === entry.raceNumber
                  )?.result;

                  return (
                    <ResultCell
                      key={entry.raceNumber}
                      result={driverResult}
                      pointsPositions={pointsPositions}
                      onClick={() => entry.completed && onRaceClick(entry.raceNumber)}
                    />
                  );
                })}
                <td className="w-14 px-3 py-2 text-right font-bold tabular-nums">
                  {stats.points}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Results() {
  const { gameState, playerTeam } = useDerivedGameState();
  const [view, setView] = useState<ViewState>({ type: 'grid' });

  const goToGrid = () => setView({ type: 'grid' });
  const goToRace = (raceNumber: number) => setView({ type: 'race', raceNumber });
  const goToDriver = (driverId: string) => setView({ type: 'driver', driverId });

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

  const getDriver = (id: string) => drivers.find((d) => d.id === id);
  const getTeam = (id: string) => teams.find((t) => t.id === id);
  const getCircuit = (id: string) => circuits.find((c) => c.id === id);

  // Race detail view
  if (view.type === 'race') {
    const raceEntry = calendar.find((e) => e.raceNumber === view.raceNumber);
    if (raceEntry?.result) {
      return (
        <RaceDetailView
          result={raceEntry.result}
          circuit={getCircuit(raceEntry.circuitId)}
          drivers={drivers}
          teams={teams}
          playerTeamId={playerTeam.id}
          onBack={goToGrid}
          onDriverClick={goToDriver}
        />
      );
    }
  }

  // Driver career view
  if (view.type === 'driver') {
    const driver = getDriver(view.driverId);
    if (driver) {
      return (
        <DriverCareerView
          driver={driver}
          team={driver.teamId ? getTeam(driver.teamId) : undefined}
          calendar={calendar}
          circuits={circuits}
          pointsPositions={pointsPositions}
          playerTeamId={playerTeam.id}
          onBack={goToGrid}
          onRaceClick={goToRace}
        />
      );
    }
  }

  // Main grid view
  return (
    <SeasonGrid
      driverStandings={driverStandings}
      calendar={calendar}
      drivers={drivers}
      teams={teams}
      circuits={circuits}
      pointsPositions={pointsPositions}
      playerTeamId={playerTeam.id}
      onRaceClick={goToRace}
      onDriverClick={goToDriver}
    />
  );
}
