import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoutePaths } from './routes';
import { TitleScreen, PlayerNameScreen, TeamSelectScreen, GameScreen } from './screens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - config data rarely changes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <div className="app">
          <Routes>
            <Route path={RoutePaths.TITLE} element={<TitleScreen />} />
            <Route path={RoutePaths.PLAYER_NAME} element={<PlayerNameScreen />} />
            <Route path={RoutePaths.TEAM_SELECT} element={<TeamSelectScreen />} />
            <Route path={RoutePaths.GAME} element={<GameScreen />} />
          </Routes>
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export default App;
