import { useState, useEffect } from 'react';
import { useDerivedGameState } from '../../hooks';
import { TeamProfileContent } from '../../components';
import type { DriverStanding, ConstructorStanding } from '../../../shared/domain';

/** Used for sorting teams without standings to the end */
const NO_STANDING_POSITION = 999;

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

  // Build lookup maps for O(1) access
  const constructorStandingsMap = new Map<string, ConstructorStanding>(
    gameState.currentSeason.constructorStandings.map((s) => [s.teamId, s])
  );
  const driverStandingsMap = new Map<string, DriverStanding>(
    gameState.currentSeason.driverStandings.map((s) => [s.driverId, s])
  );

  // Sort teams by constructor standings position
  const sortedTeams = [...teams].sort((a, b) => {
    const posA = constructorStandingsMap.get(a.id)?.position ?? NO_STANDING_POSITION;
    const posB = constructorStandingsMap.get(b.id)?.position ?? NO_STANDING_POSITION;
    return posA - posB;
  });

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? sortedTeams[0];
  const teamDrivers = drivers.filter((d) => d.teamId === selectedTeam.id);
  const teamChiefs = chiefs.filter((c) => c.teamId === selectedTeam.id);
  const constructorStanding = constructorStandingsMap.get(selectedTeam.id);

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
            const standing = constructorStandingsMap.get(team.id);
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
