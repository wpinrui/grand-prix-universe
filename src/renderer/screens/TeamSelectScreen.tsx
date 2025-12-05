import { useNavigate } from 'react-router-dom';
import { RoutePaths } from '../routes';

export function TeamSelectScreen() {
  const navigate = useNavigate();

  return (
    <div className="team-select-screen">
      <h1>Select Your Team</h1>
      <p>Team list will go here</p>
      <div className="actions flex gap-4">
        <button onClick={() => navigate(RoutePaths.TITLE)}>Back</button>
        <button onClick={() => navigate(RoutePaths.GAME)}>Start Game (placeholder)</button>
      </div>
    </div>
  );
}
