/**
 * React Query hooks for IPC calls
 *
 * Provides type-safe, cached data fetching for all IPC channels.
 * Config data is cached for 5 minutes (rarely changes during gameplay).
 * Game state has shorter cache time and can be manually invalidated.
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IpcChannels, IpcEvents, type SaveResult, type LoadResult, type SaveSlotInfo } from '../../shared/ipc';
import type {
  Team,
  Driver,
  Circuit,
  Sponsor,
  Manufacturer,
  Chief,
  GameRules,
  Regulations,
  SeasonRegulations,
  TyreCompoundConfig,
  GameState,
  NewGameParams,
} from '../../shared/domain';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const queryKeys = {
  // Config data
  teams: ['config', 'teams'] as const,
  drivers: ['config', 'drivers'] as const,
  circuits: ['config', 'circuits'] as const,
  sponsors: ['config', 'sponsors'] as const,
  manufacturers: ['config', 'manufacturers'] as const,
  chiefs: ['config', 'chiefs'] as const,
  rules: ['config', 'rules'] as const,
  regulations: ['config', 'regulations'] as const,
  regulationsBySeason: (season: number) => ['config', 'regulations', season] as const,
  compounds: ['config', 'compounds'] as const,

  // Game state
  gameState: ['game', 'state'] as const,

  // Saves
  savesList: ['saves', 'list'] as const,
};

// =============================================================================
// CONFIG DATA HOOKS (Read-only, long cache)
// =============================================================================

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: queryKeys.teams,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_TEAMS),
  });
}

export function useDrivers() {
  return useQuery<Driver[]>({
    queryKey: queryKeys.drivers,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_DRIVERS),
  });
}

export function useCircuits() {
  return useQuery<Circuit[]>({
    queryKey: queryKeys.circuits,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_CIRCUITS),
  });
}

export function useSponsors() {
  return useQuery<Sponsor[]>({
    queryKey: queryKeys.sponsors,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_SPONSORS),
  });
}

export function useManufacturers() {
  return useQuery<Manufacturer[]>({
    queryKey: queryKeys.manufacturers,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_MANUFACTURERS),
  });
}

export function useChiefs() {
  return useQuery<Chief[]>({
    queryKey: queryKeys.chiefs,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_CHIEFS),
  });
}

export function useRules() {
  return useQuery<GameRules | null>({
    queryKey: queryKeys.rules,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_RULES),
  });
}

export function useRegulations() {
  return useQuery<Regulations | null>({
    queryKey: queryKeys.regulations,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_REGULATIONS),
  });
}

export function useRegulationsBySeason(season: number) {
  return useQuery<SeasonRegulations | null>({
    queryKey: queryKeys.regulationsBySeason(season),
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_REGULATIONS_BY_SEASON, season),
    enabled: season > 0,
  });
}

export function useCompounds() {
  return useQuery<TyreCompoundConfig[]>({
    queryKey: queryKeys.compounds,
    queryFn: () => window.electronAPI.invoke(IpcChannels.CONFIG_GET_COMPOUNDS),
  });
}

// =============================================================================
// GAME STATE HOOKS
// =============================================================================

export function useGameState() {
  return useQuery<GameState | null>({
    queryKey: queryKeys.gameState,
    queryFn: () => window.electronAPI.invoke(IpcChannels.GAME_GET_STATE),
    staleTime: 1000 * 30, // 30 seconds - game state changes more frequently
  });
}

export function useNewGame() {
  const queryClient = useQueryClient();

  return useMutation<GameState, Error, NewGameParams>({
    mutationFn: (params) => window.electronAPI.invoke(IpcChannels.GAME_NEW, params),
    onSuccess: (newState) => {
      queryClient.setQueryData(queryKeys.gameState, newState);
    },
  });
}

// =============================================================================
// SAVE/LOAD HOOKS
// =============================================================================

export function useSavesList() {
  return useQuery<SaveSlotInfo[]>({
    queryKey: queryKeys.savesList,
    queryFn: () => window.electronAPI.invoke(IpcChannels.GAME_LIST_SAVES),
    staleTime: 1000 * 10, // 10 seconds - saves list can change
  });
}

export function useSaveGame() {
  const queryClient = useQueryClient();

  return useMutation<SaveResult, Error, void>({
    mutationFn: () => window.electronAPI.invoke(IpcChannels.GAME_SAVE),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savesList });
    },
  });
}

export function useLoadGame() {
  const queryClient = useQueryClient();

  return useMutation<LoadResult, Error, string>({
    mutationFn: (filename) => window.electronAPI.invoke(IpcChannels.GAME_LOAD, filename),
    onSuccess: (result) => {
      if (result.success && result.state) {
        queryClient.setQueryData(queryKeys.gameState, result.state);
      }
    },
  });
}

export function useDeleteSave() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, string>({
    mutationFn: (filename) => window.electronAPI.invoke(IpcChannels.GAME_DELETE_SAVE, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savesList });
    },
  });
}

export function useOpenSavesFolder() {
  return useCallback(() => {
    window.electronAPI.invoke(IpcChannels.GAME_OPEN_SAVES_FOLDER);
  }, []);
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Returns teams indexed by their ID for O(1) lookups.
 * Commonly needed when displaying saves with team info.
 */
export function useTeamsById() {
  const { data: teams } = useTeams();
  const teamsById = useMemo(() => {
    if (!teams) return {};
    return teams.reduce<Record<string, Team>>((acc, team) => {
      acc[team.id] = team;
      return acc;
    }, {});
  }, [teams]);
  return teamsById;
}

/**
 * Invalidate game state cache - call after any action that modifies game state
 */
export function useInvalidateGameState() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.gameState }),
    [queryClient]
  );
}

/**
 * Clear game state from cache - used when restarting/exiting
 */
export function useClearGameState() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.setQueryData(queryKeys.gameState, null),
    [queryClient]
  );
}

/**
 * Quit the application
 */
export function useQuitApp() {
  return useCallback(() => {
    window.electronAPI.invoke(IpcChannels.APP_QUIT);
  }, []);
}

// =============================================================================
// EVENT LISTENER HOOKS
// =============================================================================

/**
 * Subscribe to auto-save completion events
 */
export function useAutoSaveListener(onAutoSave: (filename: string) => void) {
  useEffect(() => {
    const unsubscribe = window.electronAPI.on(IpcEvents.AUTO_SAVE_COMPLETE, ({ filename }) => {
      onAutoSave(filename);
    });
    return unsubscribe;
  }, [onAutoSave]);
}
