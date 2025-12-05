import { GHOST_BUTTON_CLASSES } from '../utils/theme-styles';

interface DeleteConfirmDialogProps {
  saveName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ saveName, onConfirm, onCancel }: DeleteConfirmDialogProps) {
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
