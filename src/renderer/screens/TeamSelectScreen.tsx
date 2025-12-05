import { useNavigate } from 'react-router-dom';
import { Routes } from '../routes';

export function TeamSelectScreen() {
  const navigate = useNavigate();

  return (
    <div className="team-select-screen">
      <h1>Select Your Team</h1>
      <p>Team list will go here</p>
      <div className="actions">
        <button onClick={() => navigate(Routes.TITLE)}>Back</button>
        <button onClick={() => navigate(Routes.GAME)}>Start Game (placeholder)</button>
      </div>
    </div>
  );
}
