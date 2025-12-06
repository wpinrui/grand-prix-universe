import { useState, useCallback } from 'react';
import { useLoadGame } from './useIpc';

interface LoadGameHandlerResult {
  loadingFilename: string | null;
  loadError: string | null;
  handleLoad: (filename: string) => Promise<boolean>;
}

/**
 * Hook for handling load game operations with loading/error state.
 * Extracts common pattern from SavedGames and LoadGameScreen.
 */
export function useLoadGameHandler(): LoadGameHandlerResult {
  const [loadingFilename, setLoadingFilename] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadGame = useLoadGame();

  const handleLoad = useCallback(async (filename: string): Promise<boolean> => {
    setLoadingFilename(filename);
    setLoadError(null);
    try {
      const result = await loadGame.mutateAsync(filename);
      if (result.success) {
        return true;
      } else {
        setLoadError('Failed to load save. The file may be corrupted.');
        return false;
      }
    } catch {
      setLoadError('Failed to load save. Please try again.');
      return false;
    } finally {
      setLoadingFilename(null);
    }
  }, [loadGame]);

  return { loadingFilename, loadError, handleLoad };
}
