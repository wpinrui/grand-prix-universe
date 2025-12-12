import { WARNING_BUTTON_CLASSES, DANGER_BUTTON_CLASSES } from '../utils/theme-styles';

// ===========================================
// CONFIG
// ===========================================

export const QUIT_DIALOG_CONFIG = {
  title: 'Quit Game?',
  message: 'Are you sure you want to quit? Any unsaved progress will be lost.',
  confirmLabel: 'Quit',
  variant: 'danger' as const,
};

// ===========================================
// COMPONENT
// ===========================================

interface ActionScreenProps {
  onBackToMainMenu: () => void;
  onShowQuitDialog: () => void;
}

export function ActionScreen({ onBackToMainMenu, onShowQuitDialog }: ActionScreenProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-primary">Quit</h1>
      <p className="text-secondary">
        Choose whether to return to the main menu or exit the game entirely.
        Your current game progress will be lost unless you have saved.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBackToMainMenu}
          className={`cursor-pointer ${WARNING_BUTTON_CLASSES}`}
        >
          Back to Main Menu
        </button>
        <button
          type="button"
          onClick={onShowQuitDialog}
          className={`cursor-pointer ${DANGER_BUTTON_CLASSES}`}
        >
          Quit Game
        </button>
      </div>
    </div>
  );
}
