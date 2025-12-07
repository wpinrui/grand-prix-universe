import type { CSSProperties } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../utils/theme-styles';
import type {
  DriverStanding,
  ConstructorStanding,
  Driver,
  Team,
} from '../../shared/domain';

// ===========================================
// CONSTANTS
// ===========================================

const CELL_BASE = 'px-4 py-3';
const CELL_STAT = `${CELL_BASE} text-center text-secondary tabular-nums`;

// ===========================================
// HELPERS
// ===========================================

interface RowStyles {
  rowStyle: CSSProperties;
  rowClass: string;
  nameStyle: CSSProperties;
}

function getRowStyles(isPlayerTeam: boolean): RowStyles {
  return {
    rowStyle: isPlayerTeam ? ACCENT_CARD_STYLE : {},
    rowClass: isPlayerTeam ? 'bg-[var(--accent-900)]/30' : '',
    nameStyle: isPlayerTeam ? ACCENT_TEXT_STYLE : {},
  };
}

// ===========================================
// TABLE COMPONENTS
// ===========================================

interface StatCellProps {
  value: number;
  muted?: boolean;
}

function StatCell({ value, muted }: StatCellProps) {
  const className = muted ? `${CELL_BASE} text-center text-muted tabular-nums` : CELL_STAT;
  return <td className={className}>{value}</td>;
}

interface PositionCellProps {
  position: number;
}

function PositionCell({ position }: PositionCellProps) {
  return (
    <td className={`${CELL_BASE} text-center font-bold text-primary tabular-nums`}>
      {position}
    </td>
  );
}

interface PointsCellProps {
  points: number;
}

function PointsCell({ points }: PointsCellProps) {
  return (
    <td className={`${CELL_BASE} text-right font-bold text-primary tabular-nums`}>
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
  const styles = getRowStyles(isPlayerTeam);
  const driverName = driver
    ? `${driver.firstName} ${driver.lastName}`
    : standing.driverId;

  return (
    <tr className={styles.rowClass} style={styles.rowStyle}>
      <PositionCell position={standing.position} />
      <td className={CELL_BASE}>
        <span className="font-semibold text-primary" style={styles.nameStyle}>
          {driverName}
        </span>
      </td>
      <td className={`${CELL_BASE} text-secondary`}>{team?.name ?? standing.teamId}</td>
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
  const styles = getRowStyles(isPlayerTeam);

  return (
    <tr className={styles.rowClass} style={styles.rowStyle}>
      <PositionCell position={standing.position} />
      <td className={CELL_BASE}>
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
            <thead className="surface-inset border-b border-[var(--neutral-600)]">
              <tr className="text-xs font-semibold text-muted uppercase tracking-wider">
                <th className={`${CELL_BASE} text-center w-16`}>Pos</th>
                <th className={`${CELL_BASE} text-left`}>Driver</th>
                <th className={`${CELL_BASE} text-left`}>Team</th>
                <th className={`${CELL_BASE} text-right`}>Points</th>
                <th className={`${CELL_BASE} text-center`}>Wins</th>
                <th className={`${CELL_BASE} text-center`}>Podiums</th>
                <th className={`${CELL_BASE} text-center`}>Poles</th>
                <th className={`${CELL_BASE} text-center`}>FL</th>
                <th className={`${CELL_BASE} text-center`}>DNF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--neutral-700)]">
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
            <thead className="surface-inset border-b border-[var(--neutral-600)]">
              <tr className="text-xs font-semibold text-muted uppercase tracking-wider">
                <th className={`${CELL_BASE} text-center w-16`}>Pos</th>
                <th className={`${CELL_BASE} text-left`}>Team</th>
                <th className={`${CELL_BASE} text-right`}>Points</th>
                <th className={`${CELL_BASE} text-center`}>Wins</th>
                <th className={`${CELL_BASE} text-center`}>Podiums</th>
                <th className={`${CELL_BASE} text-center`}>Poles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--neutral-700)]">
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
