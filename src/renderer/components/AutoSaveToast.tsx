import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

/** Animation duration in ms - must match Tailwind's duration-300 */
const FADE_DURATION_MS = 300;

interface AutoSaveToastProps {
  message: string;
  duration?: number;
  onDismiss: () => void;
}

export function AutoSaveToast({ message, duration = 3000, onDismiss }: AutoSaveToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout>;

    const fadeTimer = setTimeout(() => {
      setIsVisible(false);
      dismissTimer = setTimeout(onDismiss, FADE_DURATION_MS);
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-6 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="card px-4 py-3 bg-emerald-600/20 border-emerald-600/30 text-emerald-300 text-sm flex items-center gap-2">
        <Save className="w-4 h-4" />
        {message}
      </div>
    </div>
  );
}
