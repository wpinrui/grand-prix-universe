/**
 * Home Page - Main dashboard for the game
 * Shows quick status of championship, alerts, news, and design progress
 */
import { useMemo, useCallback } from 'react';
import { useDerivedGameState } from '../hooks';
import { useEntityNavigation } from '../utils/entity-navigation';
import {
  StandingsTable,
  NextRaceCard,
  TeamStatusGrid,
  DesignProgressSection,
  DriversAtGlance,
  AlertsWidget,
  MailWidget,
  NewsWidget,
  WidgetHeading,
} from '../components/HomePageWidgets';
import {
  generateHomePageAlerts,
  getUnreadEmails,
  getRecentHeadlines,
} from '../utils/home-alerts';
import { daysBetween } from '../../shared/utils/date-utils';

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Home() {
  const { gameState, playerTeam, nextRace } = useDerivedGameState();
  const navigateToEntity = useEntityNavigation();

  // Early return if no game state
  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading home page...</p>
      </div>
    );
  }

  // Derive data
  const teamState = gameState.teamStates[playerTeam.id];
  const currentSeason = gameState.currentSeason;

  // Get standings
  const driverStandings = currentSeason.driverStandings;
  const constructorStandings = currentSeason.constructorStandings;

  // Player's constructor standing
  const playerConstructorStanding = constructorStandings.find(
    (s) => s.teamId === playerTeam.id
  );

  // Player's drivers
  const teamDrivers = gameState.drivers.filter((d) => d.teamId === playerTeam.id);
  const teamDriverIds = teamDrivers.map((d) => d.id);

  // Driver standings map
  const driverStandingsMap = useMemo(
    () => new Map(driverStandings.map((s) => [s.driverId, s])),
    [driverStandings]
  );

  // Generate alerts
  const alerts = useMemo(
    () => generateHomePageAlerts(gameState, playerTeam),
    [gameState, playerTeam]
  );

  // Get unread emails
  const unreadEmails = useMemo(
    () => getUnreadEmails(gameState.calendarEvents),
    [gameState.calendarEvents]
  );

  // Get recent headlines
  const recentHeadlines = useMemo(
    () => getRecentHeadlines(gameState.calendarEvents, 3),
    [gameState.calendarEvents]
  );

  // Find circuit for next race
  const nextRaceCircuit = nextRace
    ? gameState.circuits.find((c) => c.id === nextRace.circuitId)
    : undefined;

  // Pending parts ready to install (readyDate <= currentDate, not fully installed)
  const readyParts = useMemo(() => {
    if (!teamState) return [];
    return teamState.pendingParts.filter(
      (part) => daysBetween(part.readyDate, gameState.currentDate) >= 0 && part.installedOnCars.length < 2
    );
  }, [teamState, gameState.currentDate]);

  // Navigation handlers
  // Note: These use window.dispatchEvent to communicate with MainLayout
  // This is a simple approach that avoids prop drilling
  const handleNavigate = useCallback((section: string, subItem: string) => {
    window.dispatchEvent(
      new CustomEvent('app:navigate', { detail: { section, subItem } })
    );
  }, []);

  const handleViewWDC = useCallback(() => handleNavigate('championship', 'standings'), [handleNavigate]);
  const handleViewWCC = useCallback(() => handleNavigate('championship', 'standings'), [handleNavigate]);
  const handleViewRaces = useCallback(() => handleNavigate('championship', 'races'), [handleNavigate]);
  const handleViewDesign = useCallback(() => handleNavigate('design', 'summary'), [handleNavigate]);
  const handleViewMail = useCallback(() => handleNavigate('inbox', 'inbox'), [handleNavigate]);
  const handleViewNews = useCallback(() => handleNavigate('inbox', 'news'), [handleNavigate]);
  const handleAlertClick = useCallback(
    (section: string, subItem: string) => handleNavigate(section, subItem),
    [handleNavigate]
  );
  const handleEmailClick = useCallback(
    (_emailId: string) => {
      // Navigate to mail where selecting an email will mark it as read
      handleNavigate('inbox', 'inbox');
    },
    [handleNavigate]
  );
  const handleViewDriver = useCallback(
    (driverId: string) => navigateToEntity('driver', driverId),
    [navigateToEntity]
  );

  return (
    <div className="flex gap-6 h-full max-w-[1600px]">
      {/* LEFT COLUMN - Championship Standings */}
      <aside className="hidden lg:block w-72 shrink-0 space-y-4 overflow-y-auto">
        <StandingsTable
          type="wcc"
          standings={constructorStandings}
          highlightIds={[playerTeam.id]}
          teams={gameState.teams}
          limit={10}
          onViewAll={handleViewWCC}
        />
        <StandingsTable
          type="wdc"
          standings={driverStandings}
          highlightIds={teamDriverIds}
          drivers={gameState.drivers}
          limit={10}
          onViewAll={handleViewWDC}
        />
      </aside>

      {/* CENTER COLUMN - Main Content */}
      <main className="flex-1 min-w-0 space-y-6 overflow-y-auto pb-4">
        {/* Next Race */}
        {nextRace && (
          <NextRaceCard
            nextRace={nextRace}
            circuit={nextRaceCircuit}
            currentDate={gameState.currentDate}
            totalRaces={currentSeason.calendar.length}
            onViewRaces={handleViewRaces}
          />
        )}

        {/* Team Status Grid */}
        <TeamStatusGrid
          budget={playerTeam.budget}
          wccPosition={playerConstructorStanding?.position}
          points={playerConstructorStanding?.points ?? 0}
          wins={playerConstructorStanding?.wins ?? 0}
        />

        {/* Design Progress */}
        {teamState && (
          <DesignProgressSection
            designState={teamState.designState}
            pendingParts={readyParts}
            onViewDesign={handleViewDesign}
          />
        )}

        {/* Drivers at a Glance */}
        <div>
          <WidgetHeading>Your Drivers</WidgetHeading>
          <DriversAtGlance
            drivers={teamDrivers}
            standings={driverStandingsMap}
            onViewDriver={handleViewDriver}
          />
        </div>

        {/* Mail & News side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Unread Mail */}
          <MailWidget
            emails={unreadEmails}
            onViewAll={handleViewMail}
            onEmailClick={handleEmailClick}
          />

          {/* Latest Headlines */}
          <NewsWidget headlines={recentHeadlines} onViewAll={handleViewNews} />
        </div>
      </main>

      {/* RIGHT COLUMN - Alerts */}
      <aside className="w-80 shrink-0 space-y-4 overflow-y-auto">
        {/* Attention Required */}
        <div>
          <WidgetHeading>Attention Required</WidgetHeading>
          <AlertsWidget alerts={alerts} onAlertClick={handleAlertClick} />
        </div>
      </aside>
    </div>
  );
}
