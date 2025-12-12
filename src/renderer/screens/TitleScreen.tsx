import { useNavigate } from 'react-router-dom';
import { Play, Plus, FolderOpen, Loader2, Power } from 'lucide-react';
import { RoutePaths } from '../routes';
import { PRIMARY_BUTTON_CLASSES, GHOST_BUTTON_CLASSES, DANGER_BUTTON_CLASSES, ERROR_ALERT_CLASSES } from '../utils/theme-styles';
import { useSavesList, useLoadGameHandler, useQuitApp, TEAM_ID_ALL } from '../hooks';
import { BackgroundLayer } from '../components';

export function TitleScreen() {
  const navigate = useNavigate();
  const { data: saves } = useSavesList();
  const { loadingFilename, loadError, handleLoad } = useLoadGameHandler();
  const quitApp = useQuitApp();

  const hasSaves = saves && saves.length > 0;
  const mostRecentSave = hasSaves ? saves[0] : null;
  const isLoadingContinue = loadingFilename === mostRecentSave?.filename;

  const handleContinue = async () => {
    if (!mostRecentSave) return;
    const success = await handleLoad(mostRecentSave.filename);
    if (success) {
      navigate(RoutePaths.GAME);
    }
  };

  return (
    <div className="title-screen relative flex items-center justify-center w-full min-h-screen surface-base">
      <BackgroundLayer teamId={TEAM_ID_ALL} />

      {/* Central card */}
      <div className="relative z-10 card p-12 text-center max-w-lg">
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
          <button
            type="button"
            onClick={quitApp}
            className={`${DANGER_BUTTON_CLASSES} px-8 py-3 text-lg justify-center`}
          >
            <Power size={20} />
            <span>Quit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
