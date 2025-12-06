import { WARNING_BUTTON_CLASSES, DANGER_BUTTON_CLASSES } from '../utils/theme-styles';

// ===========================================
// TYPES
// ===========================================

export type ActionType = 'restart' | 'quit';

export function isActionType(id: string): id is ActionType {
  return id in ACTION_CONFIGS;
}

interface ActionScreenConfig {
  title: string;
  message: string;
  buttonLabel: string;
  buttonClassName: string;
}

interface ActionDialogConfig {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'warning';
}

export interface ActionConfig {
  screen: ActionScreenConfig;
  dialog: ActionDialogConfig;
}

// ===========================================
// CONFIG
// ===========================================

export const ACTION_CONFIGS: Record<ActionType, ActionConfig> = {
  restart: {
    screen: {
      title: 'Restart Game',
      message: 'Start over from the title screen. Your current game progress will be lost unless you have saved.',
      buttonLabel: 'Restart Game',
      buttonClassName: WARNING_BUTTON_CLASSES,
    },
    dialog: {
      title: 'Restart Game?',
      message: 'Are you sure you want to restart? Any unsaved progress will be lost.',
      confirmLabel: 'Restart',
      variant: 'warning',
    },
  },
  quit: {
    screen: {
      title: 'Quit Game',
      message: 'Exit the application. Your current game progress will be lost unless you have saved.',
      buttonLabel: 'Quit Game',
      buttonClassName: DANGER_BUTTON_CLASSES,
    },
    dialog: {
      title: 'Quit Game?',
      message: 'Are you sure you want to quit? Any unsaved progress will be lost.',
      confirmLabel: 'Quit',
      variant: 'danger',
    },
  },
};

// ===========================================
// COMPONENT
// ===========================================

type ActionScreenProps = ActionScreenConfig & {
  onShowDialog: () => void;
};

export function ActionScreen({ title, message, buttonLabel, buttonClassName, onShowDialog }: ActionScreenProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-primary">{title}</h1>
      <p className="text-secondary">{message}</p>
      <button type="button" onClick={onShowDialog} className={buttonClassName}>
        {buttonLabel}
      </button>
    </div>
  );
}
