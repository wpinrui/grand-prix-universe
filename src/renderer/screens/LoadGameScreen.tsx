import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSavesList, useLoadGame, useDeleteSave, useTeams } from '../hooks/useIpc';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { SaveCard } from '../components/SaveCard';
import { GHOST_BUTTON_CLASSES } from '../utils/theme-styles';
import { RoutePaths } from '../routes';
import type { SaveSlotInfo } from '../../shared/ipc';
import type { Team } from '../../shared/domain';

// ===========================================
// MAIN COMPONENT
// ===========================================

export function LoadGameScreen() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<SaveSlotInfo | null>(null);
  const [loadingFilename, setLoadingFilename] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { data: saves, isLoading: savesLoading } = useSavesList();
  const { data: teams } = useTeams();
  const loadGame = useLoadGame();
  const deleteSave = useDeleteSave();

  const teamsById = teams?.reduce<Record<string, Team>>((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {}) ?? {};

  const handleLoad = async (filename: string) => {
    setLoadingFilename(filename);
    setLoadError(null);
    const result = await loadGame.mutateAsync(filename);
    if (result.success) {
      navigate(RoutePaths.GAME);
    } else {
      setLoadingFilename(null);
      setLoadError('Failed to load save. The file may be corrupted.');
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteSave.mutate(deleteTarget.filename);
      setDeleteTarget(null);
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
        {loadError && (
          <div className="card p-3 mb-4 bg-red-600/20 border-red-600/30 text-red-300 text-sm">
            {loadError}
          </div>
        )}

        {/* Saves list */}
        {savesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          </div>
        ) : saves && saves.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
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
          <div className="text-center py-12">
            <p className="text-secondary">No saved games found</p>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteTarget && (
          <DeleteConfirmDialog
            saveName={`${deleteTarget.teamName} - ${deleteTarget.playerName}`}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    </div>
  );
}
