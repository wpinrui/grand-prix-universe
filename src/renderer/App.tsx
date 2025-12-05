import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TitleScreen } from './screens/TitleScreen';
import { TeamSelectScreen } from './screens/TeamSelectScreen';
import { GameScreen } from './screens/GameScreen';

function App() {
  return (
    <MemoryRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<TitleScreen />} />
          <Route path="/team-select" element={<TeamSelectScreen />} />
          <Route path="/game" element={<GameScreen />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}

export default App;
