import { useState, useCallback } from 'react';
import { useDeleteSave } from './useIpc';
import type { SaveSlotInfo } from '../../shared/ipc';

/**
 * Hook for managing delete confirmation state and logic.
 * Extracts common pattern from SavedGames and LoadGameScreen.
 */
export function useDeleteConfirmation() {
  const [deleteTarget, setDeleteTarget] = useState<SaveSlotInfo | null>(null);
  const deleteSave = useDeleteSave();

  const requestDelete = useCallback((save: SaveSlotInfo) => {
    setDeleteTarget(save);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteSave.mutate(deleteTarget.filename);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteSave]);

  return {
    deleteTarget,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
