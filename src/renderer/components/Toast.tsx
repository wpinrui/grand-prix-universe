import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

interface ToastProps {
  message: string;
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ message, duration = 3000, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade animation
    }, duration);

    return () => clearTimeout(timer);
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
