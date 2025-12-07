import type { CSSProperties } from 'react';
import { useDerivedGameState } from '../hooks';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../utils/theme-styles';
import type {
  DriverStanding,
  ConstructorStanding,
  Driver,
  Team,
} from '../../shared/domain';

// ===========================================
// SHARED COMPONENTS
// ===========================================

interface SectionHeadingProps {
  children: React.ReactNode;
}

function SectionHeading({ children }: SectionHeadingProps) {
  return (
    <h2 className="text-lg font-bold text-primary uppercase tracking-wide mb-4 flex items-center gap-3">
      <span>{children}</span>
      <div className="flex-1 h-px bg-[var(--neutral-600)]" />
    </h2>
  );
}

// ===========================================
// TABLE COMPONENTS
// ===========================================

interface DriverRowProps {
  standing: DriverStanding;
  driver: Driver | undefined;
  team: Team | undefined;
  isPlayerTeam: boolean;
}

function DriverRow({ standing, driver, team, isPlayerTeam }: DriverRowProps) {
  const rowStyle: CSSProperties = isPlayerTeam ? ACCENT_CARD_STYLE : {};
  const nameStyle: CSSProperties = isPlayerTeam ? ACCENT_TEXT_STYLE : {};

  const driverName = driver
    ? `${driver.firstName} ${driver.lastName}`
    : standing.driverId;

  return (
    <tr className={isPlayerTeam ? 'bg-[var(--accent-900)]/30' : ''} style={rowStyle}>
      <td className="px-4 py-3 text-center font-bold text-primary tabular-nums">
        {standing.position}
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-primary" style={nameStyle}>
          {driverName}
        </span>
      </td>
      <td className="px-4 py-3 text-secondary">{team?.name ?? standing.teamId}</td>
      <td className="px-4 py-3 text-right font-bold text-primary tabular-nums">
        {standing.points}
      </td>
      <td className="px-4 py-3 text-center text-secondary tabular-nums">{standing.wins}</td>
      <td className="px-4 py-3 text-center text-secondary tabular-nums">{standing.podiums}</td>
      <td className="px-4 py-3 text-center text-secondary tabular-nums">{standing.polePositions}</td>
      <td className="px-4 py-3 text-center text-secondary tabular-nums">{standing.fastestLaps}</td>
      <td className="px-4 py-3 text-center text-muted tabular-nums">{standing.dnfs}</td>
    </tr>
  );
}

interface ConstructorRowProps {
  standing: ConstructorStanding;
  team: Team | undefined;
  isPlayerTeam: boolean;
}

function ConstructorRow({ standing, team, isPlayerTeam }: ConstructorRowProps) {
  const rowStyle: CSSProperties = isPlayerTeam ? ACCENT_CARD_STYLE : {};
  const nameStyle: CSSProperties = isPlayerTeam ? ACCENT_TEXT_STYLE : {};

  return (
    <tr className={isPlayerTeam ? 'bg-[var(--accent-900)]/30' : ''} style={rowStyle}>
      <td className="px-4 py-3 text-center font-bold text-primary tabular-nums">
        {standing.position}
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-primary" style={nameStyle}>
          {team?.name ?? standing.teamId}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-bold text-primary tabular-nums">
        {standing.points}
      </td>
      <td className="px-4 py-3 text-center text-secondary tabular-nums">{standing.wins}</td>
      <td className="px-4 py-3 text-center text-secondary tabular-nums">{standing.podiums}</td>
      <td className="px-4 py-3 text-center text-secondary tabular-nums">{standing.polePositions}</td>
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
                <th className="px-4 py-3 text-center w-16">Pos</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Team</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-center">Wins</th>
                <th className="px-4 py-3 text-center">Podiums</th>
                <th className="px-4 py-3 text-center">Poles</th>
                <th className="px-4 py-3 text-center">FL</th>
                <th className="px-4 py-3 text-center">DNF</th>
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
                <th className="px-4 py-3 text-center w-16">Pos</th>
                <th className="px-4 py-3 text-left">Team</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-center">Wins</th>
                <th className="px-4 py-3 text-center">Podiums</th>
                <th className="px-4 py-3 text-center">Poles</th>
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
