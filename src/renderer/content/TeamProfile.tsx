import { useDerivedGameState } from '../hooks';
import { TeamProfileContent } from '../components';
import { useEntityNavigation } from '../utils/entity-navigation';
import type { DriverStanding } from '../../shared/domain';

export function TeamProfile() {
  const { gameState, playerTeam } = useDerivedGameState();
  const navigateToEntity = useEntityNavigation();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading team data...</p>
      </div>
    );
  }

  const teamDrivers = gameState.drivers.filter((driver) => driver.teamId === playerTeam.id);
  const teamChiefs = gameState.chiefs.filter((chief) => chief.teamId === playerTeam.id);

  const constructorStanding = gameState.currentSeason.constructorStandings.find(
    (s) => s.teamId === playerTeam.id
  );
  const driverStandingsMap = new Map<string, DriverStanding>(
    gameState.currentSeason.driverStandings.map((s) => [s.driverId, s])
  );

  return (
    <div className="max-w-6xl">
      <TeamProfileContent
        team={playerTeam}
        drivers={teamDrivers}
        chiefs={teamChiefs}
        constructorStanding={constructorStanding}
        driverStandingsMap={driverStandingsMap}
        allTeams={gameState.teams}
        onTeamSelect={(teamId) => navigateToEntity('team', teamId)}
        principalName={gameState.player.name}
      />
    </div>
  );
}
