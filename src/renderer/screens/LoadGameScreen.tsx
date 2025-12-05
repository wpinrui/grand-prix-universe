import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Loader2 } from 'lucide-react';
import { useSavesList, useLoadGame, useDeleteSave, useTeams } from '../hooks/useIpc';
import { TeamBadge } from '../components/TeamBadge';
import { GHOST_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatDateTime } from '../utils/format';
import { RoutePaths } from '../routes';
import type { SaveSlotInfo } from '../../shared/ipc';
import type { Team } from '../../shared/domain';

// ===========================================
// COMPONENTS
// ===========================================

interface DeleteConfirmDialogProps {
  saveName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ saveName, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-primary mb-2">Delete Save?</h3>
        <p className="text-secondary mb-6">
          Are you sure you want to delete <span className="text-primary font-medium">{saveName}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={GHOST_BUTTON_CLASSES}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn px-4 py-2 font-semibold bg-red-600 text-white border border-red-500 rounded-lg hover:bg-red-500 transition-all duration-200"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface SaveCardProps {
  save: SaveSlotInfo;
  team: Team | undefined;
  onLoad: () => void;
  onDelete: () => void;
  isLoading: boolean;
}

function SaveCard({ save, team, onLoad, onDelete, isLoading }: SaveCardProps) {
  return (
    <div className="card p-4 flex items-center gap-4">
      {/* Team badge */}
      <div className="shrink-0">
        {team ? (
          <TeamBadge team={team} className="w-14 h-12" />
        ) : (
          <div className="w-14 h-12 rounded surface-inset flex items-center justify-center">
            <span className="text-xs text-muted">?</span>
          </div>
        )}
      </div>

      {/* Save info */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-primary truncate">{save.teamName}</div>
        <div className="text-sm text-secondary">{save.playerName}</div>
        <div className="text-xs text-muted mt-1">
          Season {save.seasonNumber}, Week {save.weekNumber} · {formatDateTime(save.savedAt)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onLoad}
          disabled={isLoading}
          className="btn p-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30 disabled:opacity-50 transition-all"
          title="Load save"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="btn p-2 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-all"
          title="Delete save"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function LoadGameScreen() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<SaveSlotInfo | null>(null);
  const [loadingFilename, setLoadingFilename] = useState<string | null>(null);

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
    const result = await loadGame.mutateAsync(filename);
    if (result.success) {
      navigate(RoutePaths.GAME);
    } else {
      setLoadingFilename(null);
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
