import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoutePaths } from './routes';
import { TitleScreen, TeamSelectScreen, GameScreen } from './screens';

function App() {
  return (
    <MemoryRouter>
      <div className="app">
        <Routes>
          <Route path={RoutePaths.TITLE} element={<TitleScreen />} />
          <Route path={RoutePaths.TEAM_SELECT} element={<TeamSelectScreen />} />
          <Route path={RoutePaths.GAME} element={<GameScreen />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}

export default App;
