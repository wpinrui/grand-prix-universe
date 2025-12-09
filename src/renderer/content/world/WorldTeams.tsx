import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useDerivedGameState } from '../../hooks';
import { TeamBadge } from '../../components/TeamBadge';
import { FlagIcon } from '../../components/FlagIcon';
import { SectionHeading } from '../../components';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../../utils/theme-styles';
import {
  formatCurrency,
  formatAnnualSalary,
  DRIVER_ROLE_LABELS,
  CHIEF_ROLE_LABELS,
} from '../../utils/format';
import type {
  Team,
  Driver,
  Chief,
  DriverStanding,
  ConstructorStanding,
} from '../../../shared/domain';
import { seasonToYear } from '../../../shared/utils/date-utils';

// ===========================================
// FORMATTERS
// ===========================================

function formatOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

function formatContractEnd(seasonNumber: number): string {
  const year = seasonToYear(seasonNumber);
  return `31 Dec ${year}`;
}

function formatContractLine(salary: number, contractEnd: number): string {
  return `${formatAnnualSalary(salary)} · Contract ends ${formatContractEnd(contractEnd)}`;
}

// ===========================================
// SHARED COMPONENTS
// ===========================================

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}

function StatCard({ label, value, accent = false }: StatCardProps) {
  const cardStyle: CSSProperties = accent ? ACCENT_CARD_STYLE : {};
  const valueStyle: CSSProperties = accent ? ACCENT_TEXT_STYLE : {};

  return (
    <div className="card p-5" style={cardStyle}>
      <div className="text-sm font-medium text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-xl font-bold text-primary" style={valueStyle}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: React.ReactNode; label?: string }) {
  return (
    <div className="text-muted">
      <span className="font-medium text-secondary">{value}</span>
      {label && <span className="ml-1">{label}</span>}
    </div>
  );
}

// ===========================================
// DRIVER & CHIEF CARDS
// ===========================================

interface DriverCardProps {
  driver: Driver;
  standing: DriverStanding | undefined;
}

function DriverCard({ driver, standing }: DriverCardProps) {
  return (
    <div className="card p-4 flex gap-4">
      <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0 surface-inset flex items-center justify-center">
        {driver.photoUrl ? (
          <img
            src={driver.photoUrl}
            alt={`${driver.firstName} ${driver.lastName}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs text-muted">No Photo</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-primary">
            {driver.firstName} {driver.lastName}
          </span>
          <FlagIcon country={driver.nationality} size="sm" />
        </div>
        <div className="text-sm font-medium text-secondary">
          {DRIVER_ROLE_LABELS[driver.role] ?? driver.role}
        </div>
        <div className="flex gap-4 mt-2 text-xs">
          <MiniStat value={standing ? formatOrdinal(standing.position) : '-'} />
          <MiniStat value={standing?.points ?? 0} label="Pts" />
          <MiniStat value={standing?.wins ?? 0} label="Wins" />
        </div>
        <div className="text-xs text-muted mt-1">
          {formatContractLine(driver.salary, driver.contractEnd)}
        </div>
      </div>
    </div>
  );
}

interface ChiefCardProps {
  chief: Chief;
}

function ChiefCard({ chief }: ChiefCardProps) {
  return (
    <div className="card p-3">
      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
        {CHIEF_ROLE_LABELS[chief.role] ?? chief.role}
      </div>
      <div className="font-bold text-primary">
        {chief.firstName} {chief.lastName}
      </div>
      <div className="text-xs text-muted mt-2 space-y-0.5">
        <div>Ability: {chief.ability}</div>
        <div>{formatContractLine(chief.salary, chief.contractEnd)}</div>
      </div>
    </div>
  );
}

// ===========================================
// TEAM PROFILE CONTENT
// ===========================================

interface TeamProfileContentProps {
  team: Team;
  drivers: Driver[];
  chiefs: Chief[];
  constructorStanding: ConstructorStanding | undefined;
  driverStandingsMap: Map<string, DriverStanding>;
}

function TeamProfileContent({
  team,
  drivers,
  chiefs,
  constructorStanding,
  driverStandingsMap,
}: TeamProfileContentProps) {
  return (
    <div className="space-y-8">
      {/* Team Header */}
      <div className="flex items-start gap-6">
        <TeamBadge team={team} className="w-24 h-20" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary tracking-tight">{team.name}</h1>
          <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">{team.description}</p>
        </div>
        <div className="flex items-center gap-2 text-secondary">
          <FlagIcon country={team.headquarters} size="md" />
          <span className="font-medium">{team.headquarters}</span>
        </div>
      </div>

      {/* Team Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Budget" value={formatCurrency(team.budget)} accent />
        <StatCard label="Championship" value={constructorStanding ? `P${constructorStanding.position}` : '-'} />
        <StatCard label="Points" value={constructorStanding?.points ?? 0} />
        <StatCard label="Wins" value={constructorStanding?.wins ?? 0} />
      </div>

      {/* Drivers Section */}
      <section>
        <SectionHeading>Drivers</SectionHeading>
        {drivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drivers.map((driver) => (
              <DriverCard key={driver.id} driver={driver} standing={driverStandingsMap.get(driver.id)} />
            ))}
          </div>
        ) : (
          <p className="text-muted">No drivers contracted</p>
        )}
      </section>

      {/* Chiefs Section */}
      <section>
        <SectionHeading>Department Chiefs</SectionHeading>
        {chiefs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {chiefs.map((chief) => (
              <ChiefCard key={chief.id} chief={chief} />
            ))}
          </div>
        ) : (
          <p className="text-muted">No chiefs assigned</p>
        )}
      </section>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

interface WorldTeamsProps {
  initialTeamId?: string | null;
}

export function WorldTeams({ initialTeamId }: WorldTeamsProps) {
  const { gameState, playerTeam } = useDerivedGameState();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Set initial team when available
  useEffect(() => {
    if (initialTeamId) {
      setSelectedTeamId(initialTeamId);
    } else if (selectedTeamId === null && playerTeam) {
      setSelectedTeamId(playerTeam.id);
    }
  }, [initialTeamId, playerTeam, selectedTeamId]);

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading teams...</p>
      </div>
    );
  }

  const { teams, drivers, chiefs } = gameState;

  // Sort teams by constructor standings position
  const sortedTeams = [...teams].sort((a, b) => {
    const standingA = gameState.currentSeason.constructorStandings.find((s) => s.teamId === a.id);
    const standingB = gameState.currentSeason.constructorStandings.find((s) => s.teamId === b.id);
    return (standingA?.position ?? 999) - (standingB?.position ?? 999);
  });

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? sortedTeams[0];
  const teamDrivers = drivers.filter((d) => d.teamId === selectedTeam.id);
  const teamChiefs = chiefs.filter((c) => c.teamId === selectedTeam.id);

  const constructorStanding = gameState.currentSeason.constructorStandings.find(
    (s) => s.teamId === selectedTeam.id
  );
  const driverStandingsMap = new Map<string, DriverStanding>(
    gameState.currentSeason.driverStandings.map((s) => [s.driverId, s])
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Team Selector */}
      <div className="flex items-center gap-4">
        <label htmlFor="team-select" className="text-sm font-medium text-secondary">
          Select Team:
        </label>
        <select
          id="team-select"
          value={selectedTeam.id}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="surface-primary border border-subtle rounded-lg px-4 py-2 text-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)]"
        >
          {sortedTeams.map((team) => {
            const standing = gameState.currentSeason.constructorStandings.find(
              (s) => s.teamId === team.id
            );
            const isPlayer = team.id === playerTeam.id;
            return (
              <option key={team.id} value={team.id}>
                {standing ? `P${standing.position} - ` : ''}{team.name}{isPlayer ? ' (You)' : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Team Profile */}
      <TeamProfileContent
        team={selectedTeam}
        drivers={teamDrivers}
        chiefs={teamChiefs}
        constructorStanding={constructorStanding}
        driverStandingsMap={driverStandingsMap}
      />
    </div>
  );
}
