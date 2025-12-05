import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { RoutePaths } from '../routes';
import { PRIMARY_BUTTON_CLASSES } from '../utils/theme-styles';

export function TitleScreen() {
  const navigate = useNavigate();

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

        {/* Menu */}
        <button
          type="button"
          onClick={() => navigate(RoutePaths.PLAYER_NAME)}
          className={`${PRIMARY_BUTTON_CLASSES} px-8 py-3 text-lg`}
        >
          <Play size={20} />
          <span>New Game</span>
        </button>
      </div>
    </div>
  );
}
