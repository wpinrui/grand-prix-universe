import { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { RoutePaths } from '../routes';
import { PRIMARY_BUTTON_CLASSES, GHOST_BUTTON_CLASSES } from '../utils/theme-styles';
import { TEAM_ID_ALL } from '../hooks';
import { BackgroundLayer } from '../components';

/**
 * Player Name Screen - Collects the player's name before team selection.
 * GPW-faithful implementation: centered panel, instruction text, input, OK button.
 */
export function PlayerNameScreen() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValid = playerName.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isValid) {
      navigate(RoutePaths.TEAM_SELECT, { state: { playerName: playerName.trim() } });
    }
  };

  return (
    <div className="player-name-screen relative flex items-center justify-center w-full min-h-screen surface-base">
      <BackgroundLayer teamId={TEAM_ID_ALL} />

      {/* Central card */}
      <form onSubmit={handleSubmit} className="relative z-10 card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-primary mb-2">New Game</h1>
        <p className="text-secondary mb-6">
          Please enter your name in the box below and click OK to continue.
        </p>

        <input
          ref={inputRef}
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-4 py-3 rounded-lg surface-inset border border-[var(--neutral-700)] text-primary placeholder:text-muted focus:outline-none focus:border-[var(--neutral-500)] transition-colors mb-6"
        />

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={GHOST_BUTTON_CLASSES}
          >
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className={PRIMARY_BUTTON_CLASSES}
          >
            <span>OK</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
