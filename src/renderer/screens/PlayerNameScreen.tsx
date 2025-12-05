import { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoutePaths } from '../routes';

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
    <div className="player-name-screen flex items-center justify-center min-h-screen bg-gray-800">
      <form onSubmit={handleSubmit} className="bg-gray-600 p-8 rounded shadow-lg w-full max-w-md">
        <h1 className="text-xl font-bold text-white mb-4">New Game</h1>
        <p className="text-gray-200 mb-6">
          Please enter your name in the box below and click OK to continue.
        </p>
        <input
          ref={inputRef}
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          className="w-full p-3 rounded border border-gray-400 bg-gray-100 text-gray-900 mb-6"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isValid}
            className="px-6 py-2 bg-green-600 text-white rounded disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
          >
            OK
          </button>
        </div>
      </form>
    </div>
  );
}
