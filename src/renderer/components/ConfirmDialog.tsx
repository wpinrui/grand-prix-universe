import { GHOST_BUTTON_CLASSES, DANGER_BUTTON_CLASSES, PRIMARY_BUTTON_CLASSES } from '../utils/theme-styles';

type DialogVariant = 'danger' | 'primary';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClasses = variant === 'danger' ? DANGER_BUTTON_CLASSES : PRIMARY_BUTTON_CLASSES;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-primary mb-2">{title}</h3>
        <p className="text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={GHOST_BUTTON_CLASSES}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={confirmClasses}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
