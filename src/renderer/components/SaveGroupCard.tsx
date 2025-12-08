import { useState } from 'react';
import { Download, Trash2, Loader2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { TeamBadge } from './TeamBadge';
import { formatDateTime, formatSeasonWeek } from '../utils/format';
import {
  ICON_BUTTON_SUCCESS_CLASSES,
  ICON_BUTTON_DANGER_CLASSES,
  ICON_BUTTON_NEUTRAL_CLASSES,
} from '../utils/theme-styles';
import type { SaveGroup } from '../utils/format';
import type { SaveSlotInfo } from '../../shared/ipc';
import type { Team } from '../../shared/domain';

/** Width class for badge column - used for badge and history row alignment */
const BADGE_COLUMN_WIDTH = 'w-14';
const BADGE_HEIGHT = 'h-12';

function AutosaveLabel() {
  return <span className="ml-2 text-amber-400">(autosave)</span>;
}

interface SaveGroupCardProps {
  group: SaveGroup;
  team: Team | undefined;
  onLoad: (filename: string) => void;
  onDelete: (save: SaveSlotInfo) => void;
  loadingFilename: string | null;
}

interface SaveActionsProps {
  save: SaveSlotInfo;
  onLoad: () => void;
  onDelete: () => void;
  isLoading: boolean;
}

function SaveActions({ save, onLoad, onDelete, isLoading }: SaveActionsProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onLoad}
        disabled={isLoading}
        className={ICON_BUTTON_SUCCESS_CLASSES}
        title={`Load ${save.isAutosave ? 'autosave' : 'save'}`}
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
        className={ICON_BUTTON_DANGER_CLASSES}
        title={`Delete ${save.isAutosave ? 'autosave' : 'save'}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export function SaveGroupCard({
  group,
  team,
  onLoad,
  onDelete,
  loadingFilename,
}: SaveGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { primary, history } = group;
  const hasHistory = history.length > 0;

  return (
    <div className="card overflow-hidden">
      {/* Primary save row */}
      <div className="p-4 flex items-center gap-4">
        {/* Team badge */}
        <div className="shrink-0">
          {team ? (
            <TeamBadge team={team} className={`${BADGE_COLUMN_WIDTH} ${BADGE_HEIGHT}`} />
          ) : (
            <div className={`${BADGE_COLUMN_WIDTH} ${BADGE_HEIGHT} rounded surface-inset flex items-center justify-center`}>
              <span className="text-xs text-muted">?</span>
            </div>
          )}
        </div>

        {/* Save info */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-primary truncate">{primary.teamName}</div>
          <div className="text-sm text-secondary">{primary.playerName}</div>
          <div className="text-xs text-muted mt-1">
            {formatSeasonWeek(primary)} · {formatDateTime(primary.savedAt)}
            {primary.isAutosave && <AutosaveLabel />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Expand history button */}
          {hasHistory && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`${ICON_BUTTON_NEUTRAL_CLASSES} flex items-center gap-1`}
              title={isExpanded ? 'Hide save history' : 'Show save history'}
            >
              <Clock className="w-4 h-4" />
              <span className="text-xs">{history.length}</span>
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          )}

          <SaveActions
            save={primary}
            onLoad={() => onLoad(primary.filename)}
            onDelete={() => onDelete(primary)}
            isLoading={loadingFilename === primary.filename}
          />
        </div>
      </div>

      {/* Save history dropdown */}
      {hasHistory && isExpanded && (
        <div className="border-t border-neutral-700/50 bg-neutral-800/30">
          <div className="px-4 py-2 text-xs text-muted uppercase tracking-wider">
            Save History
          </div>
          <div className="divide-y divide-neutral-700/30">
            {history.map((save) => (
              <div
                key={save.filename}
                className="px-4 py-3 flex items-center gap-4 hover:bg-neutral-700/20 transition-colors"
              >
                {/* Indent space matching the team badge */}
                <div className={`${BADGE_COLUMN_WIDTH} shrink-0`} />

                {/* Save info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-secondary">
                    {formatSeasonWeek(save)}
                    {save.isAutosave && <AutosaveLabel />}
                  </div>
                  <div className="text-xs text-muted">
                    {formatDateTime(save.savedAt)}
                  </div>
                </div>

                <SaveActions
                  save={save}
                  onLoad={() => onLoad(save.filename)}
                  onDelete={() => onDelete(save)}
                  isLoading={loadingFilename === save.filename}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
