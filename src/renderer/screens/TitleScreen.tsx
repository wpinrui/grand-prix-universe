import { useNavigate } from 'react-router-dom';
import { RoutePaths } from '../routes';

export function TitleScreen() {
  const navigate = useNavigate();

  return (
    <div className="title-screen flex flex-col items-center justify-center w-full min-h-screen bg-gray-800">
      <h1>Grand Prix Universe</h1>
      <p>F1 Team Management Simulation</p>
      <div className="menu mt-8">
        <button
          type="button"
          onClick={() => navigate(RoutePaths.PLAYER_NAME)}
          className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors cursor-pointer"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
