import { useMemo, useState } from 'react';
import { Save, Loader2, FolderOpen } from 'lucide-react';
import { useSavesList, useSaveGame, useTeamsById, useOpenSavesFolder, useDeleteConfirmation, useLoadGameHandler } from '../hooks';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SaveGroupCard } from '../components/SaveGroupCard';
import { PRIMARY_BUTTON_CLASSES, GHOST_BUTTON_CLASSES, ERROR_ALERT_CLASSES, SUCCESS_ALERT_CLASSES } from '../utils/theme-styles';
import { getSaveDisplayName, groupSavesByGame } from '../utils/format';

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
  const { data: saves, isLoading: savesLoading } = useSavesList();
  const teamsById = useTeamsById();
  const saveGame = useSaveGame();
  const openSavesFolder = useOpenSavesFolder();
  const { deleteTarget, requestDelete, cancelDelete, confirmDelete } = useDeleteConfirmation();
  const { loadingFilename, loadError, handleLoad } = useLoadGameHandler();
  const [loadTarget, setLoadTarget] = useState<string | null>(null);

  // Group saves by gameId for cleaner display
  const saveGroups = useMemo(
    () => (saves ? groupSavesByGame(saves) : []),
    [saves]
  );

  const handleSave = () => {
    saveGame.mutate();
  };

  const requestLoad = (filename: string) => {
    setLoadTarget(filename);
  };

  const cancelLoad = () => {
    setLoadTarget(null);
  };

  const confirmLoad = async () => {
    if (!loadTarget) return;
    const filename = loadTarget;
    setLoadTarget(null);
    const success = await handleLoad(filename);
    if (success) {
      onNavigateToProfile();
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
        <div className={SUCCESS_ALERT_CLASSES}>Game saved successfully!</div>
      )}

      {/* Save error feedback */}
      {saveGame.isError && (
        <div className={ERROR_ALERT_CLASSES}>Failed to save game. Please try again.</div>
      )}

      {/* Load error feedback */}
      {loadError && <div className={ERROR_ALERT_CLASSES}>{loadError}</div>}

      {/* Saves list */}
      {savesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
        </div>
      ) : saveGroups.length > 0 ? (
        <div className="space-y-3">
          {saveGroups.map((group) => (
            <SaveGroupCard
              key={group.primary.filename}
              group={group}
              team={teamsById[group.primary.teamId]}
              onLoad={requestLoad}
              onDelete={requestDelete}
              loadingFilename={loadingFilename}
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
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {/* Load confirmation dialog */}
      {loadTarget && (
        <ConfirmDialog
          title="Load Game?"
          message="Are you sure you want to load this save? Any unsaved progress will be lost."
          confirmLabel="Load"
          variant="warning"
          onConfirm={confirmLoad}
          onCancel={cancelLoad}
        />
      )}
    </div>
  );
}
