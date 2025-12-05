/**
 * Derived game state hook
 *
 * Encapsulates common derivations from GameState that multiple components need.
 * Provides memoized access to player's team, next race, etc.
 */

import { useMemo } from 'react';
import { useGameState } from './useIpc';
import type { Team, CalendarEntry, GameState } from '../../shared/domain';

interface DerivedGameState {
  gameState: GameState | null | undefined;
  isLoading: boolean;
  playerTeam: Team | null;
  nextRace: CalendarEntry | null;
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

  return {
    gameState,
    isLoading,
    playerTeam,
    nextRace,
  };
}
