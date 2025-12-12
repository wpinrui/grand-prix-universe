/**
 * React Query hooks for IPC calls
 *
 * Provides type-safe, cached data fetching for all IPC channels.
 * Config data is cached for 5 minutes (rarely changes during gameplay).
 * Game state has shorter cache time and can be manually invalidated.
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IpcChannels, IpcEvents, type SaveResult, type LoadResult, type SaveSlotInfo, type AdvanceWeekResult, type SimulationResult, type SimulationTickPayload } from '../../shared/ipc';

/** Channels that return AdvanceWeekResult and mutate game state */
type GameStateMutationChannel =
  | typeof IpcChannels.GAME_ADVANCE_WEEK
  | typeof IpcChannels.GAME_GO_TO_CIRCUIT
  | typeof IpcChannels.GAME_RUN_RACE;

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

/** Helper hook for game state mutations that update the cache on success */
function useGameStateMutation(channel: GameStateMutationChannel) {
  const queryClient = useQueryClient();

  return useMutation<AdvanceWeekResult, Error, void>({
    mutationFn: () => window.electronAPI.invoke(channel),
    onSuccess: (result) => {
      if (result.success && result.state) {
        queryClient.setQueryData(queryKeys.gameState, result.state);
        queryClient.invalidateQueries({ queryKey: queryKeys.gameState });
      }
    },
  });
}

export function useAdvanceWeek() {
  return useGameStateMutation(IpcChannels.GAME_ADVANCE_WEEK);
}

export function useGoToCircuit() {
  return useGameStateMutation(IpcChannels.GAME_GO_TO_CIRCUIT);
}

export function useRunRace() {
  return useGameStateMutation(IpcChannels.GAME_RUN_RACE);
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
 * Clear game state from both main process and cache - used when restarting/exiting
 * Stops the autosave timer and clears all game state
 */
export function useClearGameState() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    window.electronAPI.invoke(IpcChannels.GAME_CLEAR_STATE);
    queryClient.setQueryData(queryKeys.gameState, null);
  }, [queryClient]);
}

/**
 * Dismiss the pending appointment news and update game state cache
 * Used when player dismisses the appointment news modal on game start
 */
export function useDismissAppointmentNews() {
  const queryClient = useQueryClient();
  return useMutation<GameState, Error, void>({
    mutationFn: () => window.electronAPI.invoke(IpcChannels.GAME_DISMISS_APPOINTMENT_NEWS),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.gameState, state);
    },
  });
}

/**
 * Mark an email as read and update game state cache
 * Used when player views an email in the inbox
 */
export function useMarkEmailRead() {
  const queryClient = useQueryClient();
  return useMutation<GameState, Error, string>({
    mutationFn: (emailId) => window.electronAPI.invoke(IpcChannels.MAIL_MARK_READ, emailId),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.gameState, state);
    },
  });
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

// =============================================================================
// SIMULATION HOOKS
// =============================================================================

type SimulationChannel =
  | typeof IpcChannels.GAME_SIMULATION_START
  | typeof IpcChannels.GAME_SIMULATION_STOP;

/** Helper for simulation mutations (start/stop) */
function useSimulationMutation(channel: SimulationChannel, simulatingValue: boolean) {
  const queryClient = useQueryClient();

  return useMutation<SimulationResult, Error, void>({
    mutationFn: () => window.electronAPI.invoke(channel),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.setQueryData(queryKeys.gameState, (old: GameState | null | undefined) => {
          if (!old) return old;
          return { ...old, simulation: { ...old.simulation, isSimulating: simulatingValue } };
        });
      }
    },
  });
}

export function useStartSimulation() {
  return useSimulationMutation(IpcChannels.GAME_SIMULATION_START, true);
}

export function useStopSimulation() {
  return useSimulationMutation(IpcChannels.GAME_SIMULATION_STOP, false);
}

/**
 * Subscribe to simulation tick events (day advancement)
 * Updates game state cache on each tick
 */
export function useSimulationTickListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = window.electronAPI.on(IpcEvents.SIMULATION_TICK, (payload: SimulationTickPayload) => {
      // Update the game state cache with the new state from the tick
      queryClient.setQueryData(queryKeys.gameState, payload.state);
    });
    return unsubscribe;
  }, [queryClient]);
}
