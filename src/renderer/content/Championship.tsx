import { useDerivedGameState } from '../hooks';
import { SectionHeading, HeaderCell } from '../components';
import {
  TABLE_CELL_BASE,
  TABLE_HEADER_CLASS,
  TABLE_HEADER_ROW_CLASS,
  TABLE_BODY_CLASS,
  getHighlightedRowStyles,
} from '../utils/theme-styles';
import type {
  DriverStanding,
  ConstructorStanding,
  Driver,
  Team,
} from '../../shared/domain';

// ===========================================
// CONSTANTS
// ===========================================

const CELL_PRIMARY = 'font-bold text-primary tabular-nums';
const CELL_STAT_BASE = `${TABLE_CELL_BASE} text-center tabular-nums`;
const POSITION_COL_CLASS = 'w-16';

// ===========================================
// TABLE COMPONENTS
// ===========================================

interface StatCellProps {
  value: number;
  muted?: boolean;
}

function StatCell({ value, muted }: StatCellProps) {
  const colorClass = muted ? 'text-muted' : 'text-secondary';
  return <td className={`${CELL_STAT_BASE} ${colorClass}`}>{value}</td>;
}

interface PositionCellProps {
  position: number;
}

function PositionCell({ position }: PositionCellProps) {
  return (
    <td className={`${TABLE_CELL_BASE} text-center ${CELL_PRIMARY}`}>
      {position}
    </td>
  );
}

interface PointsCellProps {
  points: number;
}

function PointsCell({ points }: PointsCellProps) {
  return (
    <td className={`${TABLE_CELL_BASE} text-right ${CELL_PRIMARY}`}>
      {points}
    </td>
  );
}

interface DriverRowProps {
  standing: DriverStanding;
  driver: Driver | undefined;
  team: Team | undefined;
  isPlayerTeam: boolean;
}

function DriverRow({ standing, driver, team, isPlayerTeam }: DriverRowProps) {
  const styles = getHighlightedRowStyles(isPlayerTeam);
  const driverName = driver
    ? `${driver.firstName} ${driver.lastName}`
    : standing.driverId;

  return (
    <tr className={styles.rowClass} style={styles.rowStyle}>
      <PositionCell position={standing.position} />
      <td className={TABLE_CELL_BASE}>
        <span className="font-semibold text-primary" style={styles.nameStyle}>
          {driverName}
        </span>
      </td>
      <td className={`${TABLE_CELL_BASE} text-secondary`}>{team?.name ?? standing.teamId}</td>
      <PointsCell points={standing.points} />
      <StatCell value={standing.wins} />
      <StatCell value={standing.podiums} />
      <StatCell value={standing.polePositions} />
      <StatCell value={standing.fastestLaps} />
      <StatCell value={standing.dnfs} muted />
    </tr>
  );
}

interface ConstructorRowProps {
  standing: ConstructorStanding;
  team: Team | undefined;
  isPlayerTeam: boolean;
}

function ConstructorRow({ standing, team, isPlayerTeam }: ConstructorRowProps) {
  const styles = getHighlightedRowStyles(isPlayerTeam);

  return (
    <tr className={styles.rowClass} style={styles.rowStyle}>
      <PositionCell position={standing.position} />
      <td className={TABLE_CELL_BASE}>
        <span className="font-semibold text-primary" style={styles.nameStyle}>
          {team?.name ?? standing.teamId}
        </span>
      </td>
      <PointsCell points={standing.points} />
      <StatCell value={standing.wins} />
      <StatCell value={standing.podiums} />
      <StatCell value={standing.polePositions} />
    </tr>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Championship() {
  const { gameState, playerTeam } = useDerivedGameState();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading championship data...</p>
      </div>
    );
  }

  const { driverStandings, constructorStandings } = gameState.currentSeason;

  // Helper to find driver/team by ID
  const getDriver = (id: string) => gameState.drivers.find((d) => d.id === id);
  const getTeam = (id: string) => gameState.teams.find((t) => t.id === id);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Drivers Championship */}
      <section>
        <SectionHeading>Drivers Championship</SectionHeading>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className={TABLE_HEADER_CLASS}>
              <tr className={TABLE_HEADER_ROW_CLASS}>
                <HeaderCell className={POSITION_COL_CLASS}>Pos</HeaderCell>
                <HeaderCell align="left">Driver</HeaderCell>
                <HeaderCell align="left">Team</HeaderCell>
                <HeaderCell align="right">Points</HeaderCell>
                <HeaderCell>Wins</HeaderCell>
                <HeaderCell>Podiums</HeaderCell>
                <HeaderCell>Poles</HeaderCell>
                <HeaderCell>FL</HeaderCell>
                <HeaderCell>DNF</HeaderCell>
              </tr>
            </thead>
            <tbody className={TABLE_BODY_CLASS}>
              {driverStandings.map((standing) => (
                <DriverRow
                  key={standing.driverId}
                  standing={standing}
                  driver={getDriver(standing.driverId)}
                  team={getTeam(standing.teamId)}
                  isPlayerTeam={standing.teamId === playerTeam.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Constructors Championship */}
      <section>
        <SectionHeading>Constructors Championship</SectionHeading>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className={TABLE_HEADER_CLASS}>
              <tr className={TABLE_HEADER_ROW_CLASS}>
                <HeaderCell className={POSITION_COL_CLASS}>Pos</HeaderCell>
                <HeaderCell align="left">Team</HeaderCell>
                <HeaderCell align="right">Points</HeaderCell>
                <HeaderCell>Wins</HeaderCell>
                <HeaderCell>Podiums</HeaderCell>
                <HeaderCell>Poles</HeaderCell>
              </tr>
            </thead>
            <tbody className={TABLE_BODY_CLASS}>
              {constructorStandings.map((standing) => (
                <ConstructorRow
                  key={standing.teamId}
                  standing={standing}
                  team={getTeam(standing.teamId)}
                  isPlayerTeam={standing.teamId === playerTeam.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
