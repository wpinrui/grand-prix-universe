/**
 * Derived game state hook
 *
 * Encapsulates common derivations from GameState that multiple components need.
 * Provides memoized access to player's team, next race, etc.
 */

import { useMemo } from 'react';
import { useGameState } from './useIpc';
import type { Team, CalendarEntry, GameState, Circuit } from '../../shared/domain';

interface DerivedGameState {
  // @agent: null = no game exists, undefined = React Query loading state. Do not "simplify".
  gameState: GameState | null | undefined;
  isLoading: boolean;
  playerTeam: Team | null;
  nextRace: CalendarEntry | null;
  nextRaceCircuit: Circuit | null;
}

export function useDerivedGameState(): DerivedGameState {
  const { data: gameState, isLoading } = useGameState();

  const playerTeam = useMemo(() => {
    if (!gameState) return null;
    return gameState.teams.find((t) => t.id === gameState.player.teamId) ?? null;
  }, [gameState]);

  const nextRace = useMemo(() => {
    if (!gameState) return null;
    return gameState.currentSeason.calendar.find((entry) => !entry.completed && !entry.cancelled) ?? null;
  }, [gameState]);

  const nextRaceCircuit = useMemo(() => {
    if (!gameState || !nextRace) return null;
    return gameState.circuits.find((c) => c.id === nextRace.circuitId) ?? null;
  }, [gameState, nextRace]);

  return {
    gameState,
    isLoading,
    playerTeam,
    nextRace,
    nextRaceCircuit,
  };
}
