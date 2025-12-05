import { useNavigate } from 'react-router-dom';

export function TitleScreen() {
  const navigate = useNavigate();

  return (
    <div className="title-screen">
      <h1>Grand Prix Universe</h1>
      <p>F1 Team Management Simulation</p>
      <div className="menu">
        <button onClick={() => navigate('/team-select')}>New Game</button>
      </div>
    </div>
  );
}
