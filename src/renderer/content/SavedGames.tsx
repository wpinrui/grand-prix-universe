import { useState } from 'react';
import { Save, Trash2, Download, Loader2 } from 'lucide-react';
import { useSavesList, useSaveGame, useLoadGame, useDeleteSave, useTeams } from '../hooks/useIpc';
import { TeamBadge } from '../components/TeamBadge';
import { PRIMARY_BUTTON_CLASSES, GHOST_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatDateTime } from '../utils/format';
import type { SaveSlotInfo } from '../../shared/ipc';
import type { Team } from '../../shared/domain';

// ===========================================
// TYPES
// ===========================================

interface SavedGamesProps {
  onNavigateToProfile: () => void;
}

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

export function SavedGames({ onNavigateToProfile }: SavedGamesProps) {
  const [deleteTarget, setDeleteTarget] = useState<SaveSlotInfo | null>(null);
  const [loadingFilename, setLoadingFilename] = useState<string | null>(null);

  const { data: saves, isLoading: savesLoading } = useSavesList();
  const { data: teams } = useTeams();
  const saveGame = useSaveGame();
  const loadGame = useLoadGame();
  const deleteSave = useDeleteSave();

  const teamsById = teams?.reduce<Record<string, Team>>((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {}) ?? {};

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
          saveName={`${deleteTarget.teamName} - ${deleteTarget.playerName}`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
