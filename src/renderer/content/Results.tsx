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

type ModalView =
  | { type: 'none' }
  | { type: 'race'; raceNumber: number }
  | { type: 'driver'; driverId: string };

// ===========================================
// POSITION CELL STYLING
// ===========================================

function getPositionStyle(position: number | null, _status: RaceFinishStatus): string {
  if (position === null) {
    // DNF/DNS/DSQ etc - red background
    return 'bg-red-600/40 text-red-300';
  }
  if (position === 1) return 'bg-amber-400/80 text-amber-950 font-bold';
  if (position === 2) return 'bg-gray-300/70 text-gray-800 font-bold';
  if (position === 3) return 'bg-amber-600/60 text-amber-100 font-bold';
  if (position <= 10) return 'bg-blue-600/40 text-blue-200'; // Points finish
  return 'bg-[var(--neutral-700)]/50 text-muted'; // Outside points
}

function formatPosition(position: number | null, status: RaceFinishStatus): string {
  if (position !== null) return String(position);
  // Map status to display text
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
// SEASON RESULTS GRID
// ===========================================

interface ResultCellProps {
  result: DriverRaceResult | undefined;
  onClick?: () => void;
}

function ResultCell({ result, onClick }: ResultCellProps) {
  if (!result) {
    // No result yet (upcoming race)
    return <td className="px-1 py-2 text-center text-xs" />;
  }

  const style = getPositionStyle(result.finishPosition, result.status);
  const text = formatPosition(result.finishPosition, result.status);
  const fastestLapIndicator = result.fastestLap ? 'F' : '';

  return (
    <td className="px-0.5 py-1 text-center">
      <button
        type="button"
        onClick={onClick}
        className={`w-8 h-6 text-xs rounded ${style} hover:brightness-110 transition-all`}
        title={result.fastestLap ? 'Fastest lap' : undefined}
      >
        {text}
        {fastestLapIndicator && <sup className="text-purple-300 ml-0.5">F</sup>}
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
    <th className="px-1 py-2 text-center">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-0.5 hover:text-primary transition-colors group"
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
  isPlayerTeam: boolean;
  onDriverClick: () => void;
  onRaceClick: (raceNumber: number) => void;
}

function DriverRow({
  standing,
  driver,
  team,
  calendar,
  isPlayerTeam,
  onDriverClick,
  onRaceClick,
}: DriverRowProps) {
  const styles = getHighlightedRowStyles(isPlayerTeam);
  const driverName = driver ? `${driver.firstName} ${driver.lastName}` : standing.driverId;

  // Build results lookup: raceNumber -> DriverRaceResult
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
      {/* Position */}
      <td className={`${TABLE_CELL_BASE} text-center font-bold text-primary tabular-nums w-10`}>
        {standing.position}
      </td>

      {/* Driver Name (clickable) */}
      <td className={`${TABLE_CELL_BASE} whitespace-nowrap`}>
        <button
          type="button"
          onClick={onDriverClick}
          className="text-left hover:underline"
          style={styles.nameStyle}
        >
          <span className="font-semibold text-primary" style={styles.nameStyle}>
            {driverName}
          </span>
        </button>
      </td>

      {/* Team */}
      <td className={`${TABLE_CELL_BASE} text-secondary text-sm whitespace-nowrap`}>
        {team?.name ?? standing.teamId}
      </td>

      {/* Race result cells */}
      {calendar.map((entry) => (
        <ResultCell
          key={entry.raceNumber}
          result={resultsByRace.get(entry.raceNumber)}
          onClick={() => entry.completed && onRaceClick(entry.raceNumber)}
        />
      ))}

      {/* Points total */}
      <td className={`${TABLE_CELL_BASE} text-right font-bold text-primary tabular-nums`}>
        {standing.points}
      </td>
    </tr>
  );
}

// ===========================================
// RACE DETAIL MODAL
// ===========================================

interface RaceDetailModalProps {
  result: RaceWeekendResult;
  circuit: Circuit | undefined;
  drivers: Driver[];
  teams: Team[];
  playerTeamId: string;
  onClose: () => void;
  onDriverClick: (driverId: string) => void;
}

function RaceDetailModal({
  result,
  circuit,
  drivers,
  teams,
  playerTeamId,
  onClose,
  onDriverClick,
}: RaceDetailModalProps) {
  const getDriver = (id: string) => drivers.find((d) => d.id === id);
  const getTeam = (id: string) => teams.find((t) => t.id === id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card max-w-5xl max-h-[90vh] overflow-auto m-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FlagIcon country={circuit?.country ?? ''} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-primary">
                {circuit?.name ?? result.circuitId}
              </h2>
              <p className="text-sm text-secondary">Round {result.raceNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Qualifying Results */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-2">
            Qualifying Classification
          </h3>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className={TABLE_HEADER_CLASS}>
                <tr className={TABLE_HEADER_ROW_CLASS}>
                  <HeaderCell className="w-12">Pos</HeaderCell>
                  <HeaderCell align="left">Driver</HeaderCell>
                  <HeaderCell align="left">Team</HeaderCell>
                  <HeaderCell>Time</HeaderCell>
                  <HeaderCell>Gap</HeaderCell>
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
                            className="hover:underline"
                          >
                            <span className="font-semibold" style={rowStyles.nameStyle}>
                              {driver ? `${driver.firstName} ${driver.lastName}` : q.driverId}
                            </span>
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
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-2">
            Race Classification
          </h3>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className={TABLE_HEADER_CLASS}>
                <tr className={TABLE_HEADER_ROW_CLASS}>
                  <HeaderCell className="w-12">Pos</HeaderCell>
                  <HeaderCell align="left">Driver</HeaderCell>
                  <HeaderCell align="left">Team</HeaderCell>
                  <HeaderCell>Laps</HeaderCell>
                  <HeaderCell>Time/Retired</HeaderCell>
                  <HeaderCell>Grid</HeaderCell>
                  <HeaderCell>Pts</HeaderCell>
                </tr>
              </thead>
              <tbody className={TABLE_BODY_CLASS}>
                {result.race
                  .sort((a, b) => {
                    // Classified drivers first (by position), then DNFs
                    if (a.finishPosition !== null && b.finishPosition !== null) {
                      return a.finishPosition - b.finishPosition;
                    }
                    if (a.finishPosition !== null) return -1;
                    if (b.finishPosition !== null) return 1;
                    return b.lapsCompleted - a.lapsCompleted; // DNFs by laps completed
                  })
                  .map((r) => {
                    const driver = getDriver(r.driverId);
                    const team = getTeam(r.teamId);
                    const isPlayer = r.teamId === playerTeamId;
                    const rowStyles = getHighlightedRowStyles(isPlayer);
                    const isFastestLap = r.driverId === result.fastestLapDriverId;

                    return (
                      <tr key={r.driverId} className={rowStyles.rowClass} style={rowStyles.rowStyle}>
                        <td className={`${TABLE_CELL_BASE} text-center font-bold tabular-nums`}>
                          {formatPosition(r.finishPosition, r.status)}
                        </td>
                        <td className={TABLE_CELL_BASE}>
                          <button
                            type="button"
                            onClick={() => onDriverClick(r.driverId)}
                            className="hover:underline"
                          >
                            <span className="font-semibold" style={rowStyles.nameStyle}>
                              {driver ? `${driver.firstName} ${driver.lastName}` : r.driverId}
                            </span>
                          </button>
                          {isFastestLap && (
                            <span className="ml-2 text-purple-400 text-xs">FL</span>
                          )}
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
                              : r.status === 'retired'
                                ? 'Retired'
                                : r.status.toUpperCase()}
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
    </div>
  );
}

// ===========================================
// DRIVER CAREER MODAL
// ===========================================

interface DriverCareerModalProps {
  driver: Driver;
  team: Team | undefined;
  calendar: CalendarEntry[];
  circuits: Circuit[];
  playerTeamId: string;
  onClose: () => void;
  onRaceClick: (raceNumber: number) => void;
}

function DriverCareerModal({
  driver,
  team,
  calendar,
  circuits,
  playerTeamId,
  onClose,
  onRaceClick,
}: DriverCareerModalProps) {
  const getCircuit = (id: string) => circuits.find((c) => c.id === id);
  const isPlayerTeam = driver.teamId === playerTeamId;
  const rowStyles = getHighlightedRowStyles(isPlayerTeam);

  // Build results for this driver
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

  // Calculate season stats
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card max-w-5xl max-h-[90vh] overflow-auto m-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FlagIcon country={driver.nationality} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-primary">
                {driver.firstName} {driver.lastName}
              </h2>
              <p className="text-sm text-secondary">{team?.name ?? 'Free Agent'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Season Stats Summary */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Races', value: stats.races },
            { label: 'Points', value: stats.points },
            { label: 'Wins', value: stats.wins },
            { label: 'Podiums', value: stats.podiums },
            { label: 'DNFs', value: stats.dnfs },
          ].map(({ label, value }) => (
            <div key={label} className="card p-3 text-center">
              <div className="text-2xl font-bold text-primary tabular-nums">{value}</div>
              <div className="text-xs text-muted uppercase">{label}</div>
            </div>
          ))}
        </div>

        {/* Results Grid */}
        <section>
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-2">
            Season Results
          </h3>
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={TABLE_HEADER_CLASS}>
                <tr className={TABLE_HEADER_ROW_CLASS}>
                  <HeaderCell align="left">Team</HeaderCell>
                  {calendar.map((entry) => {
                    const circuit = getCircuit(entry.circuitId);
                    return (
                      <th key={entry.raceNumber} className="px-1 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <FlagIcon country={circuit?.country ?? ''} size="sm" />
                        </div>
                      </th>
                    );
                  })}
                  <HeaderCell>Pts</HeaderCell>
                </tr>
              </thead>
              <tbody className={TABLE_BODY_CLASS}>
                <tr className={rowStyles.rowClass} style={rowStyles.rowStyle}>
                  <td className={`${TABLE_CELL_BASE} whitespace-nowrap text-secondary`}>
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
                        onClick={() => entry.completed && onRaceClick(entry.raceNumber)}
                      />
                    );
                  })}
                  <td className={`${TABLE_CELL_BASE} text-right font-bold tabular-nums`}>
                    {stats.points}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Results() {
  const { gameState, playerTeam } = useDerivedGameState();
  const [modal, setModal] = useState<ModalView>({ type: 'none' });

  const closeModal = () => setModal({ type: 'none' });
  const openRaceDetail = (raceNumber: number) => setModal({ type: 'race', raceNumber });
  const openDriverCareer = (driverId: string) => setModal({ type: 'driver', driverId });

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading results...</p>
      </div>
    );
  }

  const { driverStandings, calendar } = gameState.currentSeason;
  const { drivers, teams, circuits } = gameState;

  const getDriver = (id: string) => drivers.find((d) => d.id === id);
  const getTeam = (id: string) => teams.find((t) => t.id === id);
  const getCircuit = (id: string) => circuits.find((c) => c.id === id);

  // Find race result for modal
  const selectedRace =
    modal.type === 'race'
      ? calendar.find((e) => e.raceNumber === modal.raceNumber)?.result
      : undefined;
  const selectedRaceCircuit =
    modal.type === 'race'
      ? getCircuit(calendar.find((e) => e.raceNumber === modal.raceNumber)?.circuitId ?? '')
      : undefined;

  // Find driver for modal
  const selectedDriver = modal.type === 'driver' ? getDriver(modal.driverId) : undefined;
  const selectedDriverTeam =
    selectedDriver && selectedDriver.teamId ? getTeam(selectedDriver.teamId) : undefined;

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>Season Results</SectionHeading>
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={TABLE_HEADER_CLASS}>
              <tr className={TABLE_HEADER_ROW_CLASS}>
                <HeaderCell className="w-10">Pos</HeaderCell>
                <HeaderCell align="left">Driver</HeaderCell>
                <HeaderCell align="left">Team</HeaderCell>
                {calendar.map((entry) => (
                  <RaceHeaderCell
                    key={entry.raceNumber}
                    entry={entry}
                    circuit={getCircuit(entry.circuitId)}
                    onClick={() => entry.completed && openRaceDetail(entry.raceNumber)}
                  />
                ))}
                <HeaderCell>Pts</HeaderCell>
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
                  isPlayerTeam={standing.teamId === playerTeam.id}
                  onDriverClick={() => openDriverCareer(standing.driverId)}
                  onRaceClick={openRaceDetail}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Race Detail Modal */}
      {modal.type === 'race' && selectedRace && (
        <RaceDetailModal
          result={selectedRace}
          circuit={selectedRaceCircuit}
          drivers={drivers}
          teams={teams}
          playerTeamId={playerTeam.id}
          onClose={closeModal}
          onDriverClick={openDriverCareer}
        />
      )}

      {/* Driver Career Modal */}
      {modal.type === 'driver' && selectedDriver && (
        <DriverCareerModal
          driver={selectedDriver}
          team={selectedDriverTeam}
          calendar={calendar}
          circuits={circuits}
          playerTeamId={playerTeam.id}
          onClose={closeModal}
          onRaceClick={openRaceDetail}
        />
      )}
    </div>
  );
}
