import { Download, Trash2, Loader2 } from 'lucide-react';
import { TeamBadge } from './TeamBadge';
import { formatDateTime } from '../utils/format';
import type { SaveSlotInfo } from '../../shared/ipc';
import type { Team } from '../../shared/domain';

interface SaveCardProps {
  save: SaveSlotInfo;
  team: Team | undefined;
  onLoad: () => void;
  onDelete: () => void;
  isLoading: boolean;
}

export function SaveCard({ save, team, onLoad, onDelete, isLoading }: SaveCardProps) {
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
