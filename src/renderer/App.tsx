import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Routes as AppRoutes } from './routes';
import { TitleScreen, TeamSelectScreen, GameScreen } from './screens';

function App() {
  return (
    <MemoryRouter>
      <div className="app">
        <Routes>
          <Route path={AppRoutes.TITLE} element={<TitleScreen />} />
          <Route path={AppRoutes.TEAM_SELECT} element={<TeamSelectScreen />} />
          <Route path={AppRoutes.GAME} element={<GameScreen />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}

export default App;
