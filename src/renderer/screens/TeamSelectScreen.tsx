import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RoutePaths } from '../routes';

interface LocationState {
  playerName: string;
}

function isValidLocationState(state: unknown): state is LocationState {
  return (
    state !== null &&
    typeof state === 'object' &&
    'playerName' in state &&
    typeof (state as LocationState).playerName === 'string' &&
    (state as LocationState).playerName.trim().length > 0
  );
}

export function TeamSelectScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const playerName = isValidLocationState(location.state)
    ? location.state.playerName
    : null;

  // Redirect to player name screen if accessed without valid state
  useEffect(() => {
    if (playerName === null) {
      navigate(RoutePaths.PLAYER_NAME, { replace: true });
    }
  }, [playerName, navigate]);

  // Show nothing while redirecting
  if (playerName === null) {
    return null;
  }

  return (
    <div className="team-select-screen">
      <h1>Select Your Team</h1>
      <p>Welcome, {playerName}! Team list will go here.</p>
      <div className="actions flex gap-4">
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => navigate(RoutePaths.GAME)}>Start Game (placeholder)</button>
      </div>
    </div>
  );
}
