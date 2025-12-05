import { useState } from 'react';
import { Save, Loader2, FolderOpen } from 'lucide-react';
import { useSavesList, useSaveGame, useLoadGame, useDeleteSave, useTeamsById, useOpenSavesFolder } from '../hooks/useIpc';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { SaveCard } from '../components/SaveCard';
import { PRIMARY_BUTTON_CLASSES, GHOST_BUTTON_CLASSES } from '../utils/theme-styles';
import { getSaveDisplayName } from '../utils/format';
import type { SaveSlotInfo } from '../../shared/ipc';

// ===========================================
// TYPES
// ===========================================

interface SavedGamesProps {
  onNavigateToProfile: () => void;
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function SavedGames({ onNavigateToProfile }: SavedGamesProps) {
  const [deleteTarget, setDeleteTarget] = useState<SaveSlotInfo | null>(null);
  const [loadingFilename, setLoadingFilename] = useState<string | null>(null);

  const { data: saves, isLoading: savesLoading } = useSavesList();
  const teamsById = useTeamsById();
  const saveGame = useSaveGame();
  const loadGame = useLoadGame();
  const deleteSave = useDeleteSave();
  const openSavesFolder = useOpenSavesFolder();

  const handleSave = () => {
    saveGame.mutate();
  };

  const handleLoad = async (filename: string) => {
    setLoadingFilename(filename);
    const result = await loadGame.mutateAsync(filename);
    setLoadingFilename(null);
    if (result.success) {
      onNavigateToProfile();
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteSave.mutate(deleteTarget.filename);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header with Save button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Saved Games</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSavesFolder}
            className={GHOST_BUTTON_CLASSES}
            title="Open saves folder"
          >
            <FolderOpen className="w-4 h-4 inline mr-2" />
            Open Folder
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveGame.isPending}
            className={PRIMARY_BUTTON_CLASSES}
          >
            {saveGame.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 inline mr-2" />
                Save Current Game
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save success feedback */}
      {saveGame.isSuccess && (
        <div className="card p-3 bg-emerald-600/20 border-emerald-600/30 text-emerald-300 text-sm">
          Game saved successfully!
        </div>
      )}

      {/* Save error feedback */}
      {saveGame.isError && (
        <div className="card p-3 bg-red-600/20 border-red-600/30 text-red-300 text-sm">
          Failed to save game. Please try again.
        </div>
      )}

      {/* Saves list */}
      {savesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
        </div>
      ) : saves && saves.length > 0 ? (
        <div className="space-y-3">
          {saves.map((save) => (
            <SaveCard
              key={save.filename}
              save={save}
              team={teamsById[save.teamId]}
              onLoad={() => handleLoad(save.filename)}
              onDelete={() => setDeleteTarget(save)}
              isLoading={loadingFilename === save.filename}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Save className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-secondary font-medium">No saved games</p>
          <p className="text-sm text-muted mt-1">
            Click &quot;Save Current Game&quot; to create your first save.
          </p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          saveName={getSaveDisplayName(deleteTarget)}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
