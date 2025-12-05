import { useNavigate } from 'react-router-dom';

export function TeamSelectScreen() {
  const navigate = useNavigate();

  return (
    <div className="team-select-screen">
      <h1>Select Your Team</h1>
      <p>Team list will go here</p>
      <div className="actions">
        <button onClick={() => navigate('/')}>Back</button>
        <button onClick={() => navigate('/game')}>Start Game (placeholder)</button>
      </div>
    </div>
  );
}
