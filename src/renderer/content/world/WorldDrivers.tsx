/**
 * World Drivers page - view any driver's profile
 * FM24-inspired comprehensive driver profile with all stats and status panels.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useDerivedGameState } from '../../hooks';
import {
  DriverProfileContent,
  extractRecentResults,
  extractCareerHistory,
  getContractRelationship,
} from '../../components';
import type { DriverStanding } from '../../../shared/domain';
import { FREE_AGENT_COLORS } from '../../utils/face-generator';

interface WorldDriversProps {
  initialDriverId?: string | null;
}

export function WorldDrivers({ initialDriverId }: WorldDriversProps) {
  const { gameState, playerTeam } = useDerivedGameState();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(initialDriverId ?? null);
  const lastAppliedInitialRef = useRef<string | null>(initialDriverId ?? null);

  // Update selection when navigating with a NEW initialDriverId
  useEffect(() => {
    if (initialDriverId && initialDriverId !== lastAppliedInitialRef.current) {
      lastAppliedInitialRef.current = initialDriverId;
      setSelectedDriverId(initialDriverId);
    }
  }, [initialDriverId]);

  // Build sorted drivers list and lookup maps
  const { sortedDrivers, driverStandingsMap, teamMap } = useMemo(() => {
    if (!gameState) {
      return { sortedDrivers: [], driverStandingsMap: new Map(), teamMap: new Map() };
    }

    // Build standings map
    const standingsMap = new Map<string, DriverStanding>(
      gameState.currentSeason.driverStandings.map((s) => [s.driverId, s])
    );

    // Build team lookup
    const teams = new Map(gameState.teams.map((t) => [t.id, t]));

    // Sort drivers: contracted first (by championship position), then free agents (by reputation)
    const contracted = gameState.drivers
      .filter((d) => d.teamId !== null)
      .sort((a, b) => {
        const posA = standingsMap.get(a.id)?.position ?? 999;
        const posB = standingsMap.get(b.id)?.position ?? 999;
        return posA - posB;
      });

    const freeAgents = gameState.drivers
      .filter((d) => d.teamId === null)
      .sort((a, b) => b.reputation - a.reputation);

    return {
      sortedDrivers: [...contracted, ...freeAgents],
      driverStandingsMap: standingsMap,
      teamMap: teams,
    };
  }, [gameState]);

  // Default to first driver if nothing selected
  useEffect(() => {
    if (selectedDriverId === null && sortedDrivers.length > 0) {
      setSelectedDriverId(sortedDrivers[0].id);
    }
  }, [selectedDriverId, sortedDrivers]);

  // Loading state
  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading drivers...</p>
      </div>
    );
  }

  // Find selected driver
  const selectedDriver = gameState.drivers.find((d) => d.id === selectedDriverId);
  if (!selectedDriver) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Driver not found</p>
      </div>
    );
  }

  // Get driver's team (if any)
  const driverTeam = selectedDriver.teamId ? teamMap.get(selectedDriver.teamId) ?? null : null;

  // Build team colors for faces.js
  const teamColors = driverTeam
    ? { primary: driverTeam.primaryColor, secondary: driverTeam.secondaryColor }
    : FREE_AGENT_COLORS;

  // Get driver standing
  const driverStanding = driverStandingsMap.get(selectedDriver.id);

  // Get driver runtime state
  const driverState = gameState.driverStates[selectedDriver.id];

  // Extract recent race results
  const recentResults = extractRecentResults(selectedDriver.id, gameState.currentSeason);

  // Extract career history from past seasons
  const careerHistory = extractCareerHistory(
    selectedDriver.id,
    gameState.pastSeasons,
    gameState.teams
  );

  // Handle contract talks (placeholder for now)
  const handleEnterContractTalks = () => {
    // TODO: Navigate to contract negotiation screen
    console.log('Enter contract talks with:', selectedDriver.id);
  };

  return (
    <div className="max-w-6xl">
      <DriverProfileContent
        driver={selectedDriver}
        team={driverTeam}
        standing={driverStanding}
        driverState={driverState}
        currentSeason={gameState.currentSeason.seasonNumber}
        recentResults={recentResults}
        careerHistory={careerHistory}
        contractRelationship={getContractRelationship(selectedDriver.teamId, playerTeam.id)}
        teamColors={teamColors}
        onEnterContractTalks={handleEnterContractTalks}
        allDrivers={sortedDrivers}
        onDriverSelect={setSelectedDriverId}
      />
    </div>
  );
}
