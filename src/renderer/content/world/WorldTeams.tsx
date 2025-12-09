import { useState, useEffect } from 'react';
import { useDerivedGameState } from '../../hooks';
import { TeamBadge } from '../../components/TeamBadge';
import { FlagIcon } from '../../components/FlagIcon';
import { SectionHeading, TeamStatsGrid, DriverCard, ChiefCard } from '../../components';
import type { Team, Driver, Chief, DriverStanding } from '../../../shared/domain';

// ===========================================
// TEAM PROFILE CONTENT
// ===========================================

interface TeamProfileContentProps {
  team: Team;
  drivers: Driver[];
  chiefs: Chief[];
  constructorStanding: { position: number; points: number; wins: number } | undefined;
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
      <TeamStatsGrid budget={team.budget} standing={constructorStanding} />

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
