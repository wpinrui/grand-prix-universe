import { useDerivedGameState } from '../hooks';
import { TeamBadge } from '../components/TeamBadge';
import { FlagIcon } from '../components/FlagIcon';
import { SectionHeading, TeamStatsGrid, DriverCard, ChiefCard } from '../components';
import type { DriverStanding } from '../../shared/domain';

// ===========================================
// MAIN COMPONENT
// ===========================================

export function TeamProfile() {
  const { gameState, playerTeam } = useDerivedGameState();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading team data...</p>
      </div>
    );
  }

  const teamDrivers = gameState.drivers.filter((driver) => driver.teamId === playerTeam.id);
  const teamChiefs = gameState.chiefs.filter((chief) => chief.teamId === playerTeam.id);

  // Get championship standings
  const constructorStanding = gameState.currentSeason.constructorStandings.find(
    (s) => s.teamId === playerTeam.id
  );
  const driverStandingsMap = new Map<string, DriverStanding>(
    gameState.currentSeason.driverStandings.map((s) => [s.driverId, s])
  );

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Team Header */}
      <div className="flex items-start gap-6">
        <TeamBadge team={playerTeam} className="w-24 h-20" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            {playerTeam.name}
          </h1>
          <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">
            {playerTeam.description}
          </p>
        </div>
        {/* Location with Flag */}
        <div className="flex items-center gap-2 text-secondary">
          <FlagIcon country={playerTeam.headquarters} size="md" />
          <span className="font-medium">{playerTeam.headquarters}</span>
        </div>
      </div>

      {/* Team Stats Grid */}
      <TeamStatsGrid budget={playerTeam.budget} standing={constructorStanding} />

      {/* Drivers Section */}
      <section>
        <SectionHeading>Drivers</SectionHeading>
        {teamDrivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                standing={driverStandingsMap.get(driver.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted">No drivers contracted</p>
        )}
      </section>

      {/* Chiefs Section */}
      <section>
        <SectionHeading>Department Chiefs</SectionHeading>
        {teamChiefs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamChiefs.map((chief) => (
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
