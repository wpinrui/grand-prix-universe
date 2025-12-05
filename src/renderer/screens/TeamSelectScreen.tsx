import { useNavigate, useLocation } from 'react-router-dom';
import { RoutePaths } from '../routes';

interface LocationState {
  playerName: string;
}

export function TeamSelectScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playerName } = (location.state as LocationState) || { playerName: 'Player' };

  return (
    <div className="team-select-screen">
      <h1>Select Your Team</h1>
      <p>Welcome, {playerName}! Team list will go here.</p>
      <div className="actions flex gap-4">
        <button onClick={() => navigate(RoutePaths.PLAYER_NAME)}>Back</button>
        <button onClick={() => navigate(RoutePaths.GAME)}>Start Game (placeholder)</button>
      </div>
    </div>
  );
}
