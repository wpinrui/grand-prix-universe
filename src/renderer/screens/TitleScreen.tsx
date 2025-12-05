import { useNavigate } from 'react-router-dom';
import { Routes } from '../routes';

export function TitleScreen() {
  const navigate = useNavigate();

  return (
    <div className="title-screen">
      <h1>Grand Prix Universe</h1>
      <p>F1 Team Management Simulation</p>
      <div className="menu">
        <button onClick={() => navigate(Routes.TEAM_SELECT)}>New Game</button>
      </div>
    </div>
  );
}
