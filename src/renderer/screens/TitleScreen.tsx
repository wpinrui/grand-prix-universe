import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, FolderOpen, Loader2 } from 'lucide-react';
import { RoutePaths } from '../routes';
import { PRIMARY_BUTTON_CLASSES, GHOST_BUTTON_CLASSES, ERROR_ALERT_CLASSES } from '../utils/theme-styles';
import { useSavesList, useLoadGame } from '../hooks';

export function TitleScreen() {
  const navigate = useNavigate();
  const [isLoadingContinue, setIsLoadingContinue] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { data: saves } = useSavesList();
  const loadGame = useLoadGame();

  const hasSaves = saves && saves.length > 0;
  const mostRecentSave = hasSaves ? saves[0] : null;

  const handleContinue = async () => {
    if (!mostRecentSave) return;
    setIsLoadingContinue(true);
    setLoadError(null);
    try {
      const result = await loadGame.mutateAsync(mostRecentSave.filename);
      if (result.success) {
        navigate(RoutePaths.GAME);
      } else {
        setLoadError('Failed to load save. Try Load Game to select another.');
      }
    } catch {
      setLoadError('Failed to load save. Please try again.');
    } finally {
      setIsLoadingContinue(false);
    }
  };

  return (
    <div className="title-screen flex items-center justify-center w-full min-h-screen surface-base">
      {/* Central card */}
      <div className="card p-12 text-center max-w-lg">
        {/* Title */}
        <h1 className="text-4xl font-bold text-primary tracking-tight mb-2">
          Grand Prix Universe
        </h1>
        <p className="text-secondary text-lg mb-10">
          F1 Team Management Simulation
        </p>

        {/* Load error feedback */}
        {loadError && (
          <div className={`${ERROR_ALERT_CLASSES} mb-6 text-left`}>{loadError}</div>
        )}

        {/* Menu */}
        <div className="flex flex-col gap-3">
          {hasSaves && (
            <>
              <button
                type="button"
                onClick={handleContinue}
                disabled={isLoadingContinue}
                className={`${PRIMARY_BUTTON_CLASSES} px-8 py-3 text-lg justify-center`}
              >
                {isLoadingContinue ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Play size={20} />
                    <span>Continue</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate(RoutePaths.LOAD_GAME)}
                className={`${GHOST_BUTTON_CLASSES} px-8 py-3 text-lg justify-center`}
              >
                <FolderOpen size={20} />
                <span>Load Game</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate(RoutePaths.PLAYER_NAME)}
            className={`${hasSaves ? GHOST_BUTTON_CLASSES : PRIMARY_BUTTON_CLASSES} px-8 py-3 text-lg justify-center`}
          >
            <Plus size={20} />
            <span>New Game</span>
          </button>
        </div>
      </div>
    </div>
  );
}
