import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSavesList, useTeamsById, useDeleteConfirmation, useLoadGameHandler } from '../hooks';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { SaveGroupCard } from '../components/SaveGroupCard';
import { GHOST_BUTTON_CLASSES, ERROR_ALERT_CLASSES } from '../utils/theme-styles';
import { getSaveDisplayName, groupSavesByGame } from '../utils/format';
import { RoutePaths } from '../routes';

// ===========================================
// MAIN COMPONENT
// ===========================================

export function LoadGameScreen() {
  const navigate = useNavigate();
  const { data: saves, isLoading: savesLoading } = useSavesList();
  const teamsById = useTeamsById();
  const { deleteTarget, requestDelete, cancelDelete, confirmDelete } = useDeleteConfirmation();
  const { loadingFilename, loadError, handleLoad } = useLoadGameHandler();

  // Group saves by gameId for cleaner display
  const saveGroups = useMemo(
    () => (saves ? groupSavesByGame(saves) : []),
    [saves]
  );

  const onLoad = async (filename: string) => {
    const success = await handleLoad(filename);
    if (success) {
      navigate(RoutePaths.GAME);
    }
  };

  return (
    <div className="load-game-screen flex items-center justify-center w-full min-h-screen surface-base">
      <div className="card p-8 w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate(RoutePaths.TITLE)}
            className={GHOST_BUTTON_CLASSES}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-primary">Load Game</h1>
        </div>

        {/* Load error feedback */}
        {loadError && <div className={`${ERROR_ALERT_CLASSES} mb-4`}>{loadError}</div>}

        {/* Saves list */}
        {savesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : saveGroups.length > 0 ? (
          <div className="space-y-3 max-h-[28rem] overflow-y-auto">
            {saveGroups.map((group) => (
              <SaveGroupCard
                key={group.primary.filename}
                group={group}
                team={teamsById[group.primary.teamId]}
                onLoad={onLoad}
                onDelete={requestDelete}
                loadingFilename={loadingFilename}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-secondary">No saved games found</p>
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
      </div>
    </div>
  );
}
