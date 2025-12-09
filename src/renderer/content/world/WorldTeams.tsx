import { useState, useEffect, useRef } from 'react';
import { useDerivedGameState } from '../../hooks';
import { TeamProfileContent } from '../../components';
import type { DriverStanding, ConstructorStanding } from '../../../shared/domain';

/** Used for sorting teams without standings to the end */
const NO_STANDING_POSITION = 999;

interface WorldTeamsProps {
  initialTeamId?: string | null;
}

export function WorldTeams({ initialTeamId }: WorldTeamsProps) {
  const { gameState, playerTeam } = useDerivedGameState();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const appliedInitialRef = useRef<string | null>(null);

  // Set initial team only once per navigation (don't override user selections)
  useEffect(() => {
    if (initialTeamId && initialTeamId !== appliedInitialRef.current) {
      appliedInitialRef.current = initialTeamId;
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
    <div className="max-w-6xl">
      <TeamProfileContent
        team={selectedTeam}
        drivers={teamDrivers}
        chiefs={teamChiefs}
        constructorStanding={constructorStanding}
        driverStandingsMap={driverStandingsMap}
        allTeams={sortedTeams}
        onTeamSelect={setSelectedTeamId}
      />
    </div>
  );
}
