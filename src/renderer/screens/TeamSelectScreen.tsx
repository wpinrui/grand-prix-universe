import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RoutePaths } from '../routes';
import { IpcChannels } from '../../shared/ipc';
import type { Team } from '../../shared/domain';

interface LocationState {
  playerName: string;
}

function isValidLocationState(state: unknown): state is LocationState {
  return (
    state !== null &&
    typeof state === 'object' &&
    'playerName' in state &&
    typeof (state as LocationState).playerName === 'string' &&
    (state as LocationState).playerName.trim().length > 0
  );
}

/**
 * Color swatch component - displays team colors as fallback for logo
 */
function ColorSwatch({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="flex gap-1">
      <div
        className="w-8 h-8 rounded border border-gray-600"
        style={{ backgroundColor: primary }}
        title={`Primary: ${primary}`}
      />
      <div
        className="w-8 h-8 rounded border border-gray-600"
        style={{ backgroundColor: secondary }}
        title={`Secondary: ${secondary}`}
      />
    </div>
  );
}

/**
 * Format budget as currency string
 */
function formatBudget(budget: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(budget);
}

export function TeamSelectScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const playerName = isValidLocationState(location.state) ? location.state.playerName : null;

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Redirect to player name screen if accessed without valid state
  useEffect(() => {
    if (playerName === null) {
      navigate(RoutePaths.PLAYER_NAME, { replace: true });
    }
  }, [playerName, navigate]);

  // Fetch teams on mount
  useEffect(() => {
    async function loadTeams() {
      try {
        const loadedTeams = await window.api.invoke(IpcChannels.CONFIG_GET_TEAMS);
        setTeams(loadedTeams);
        if (loadedTeams.length > 0) {
          setSelectedTeam(loadedTeams[0]);
        }
      } catch (error) {
        console.error('Failed to load teams:', error);
        setLoadError('Failed to load teams. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    if (playerName !== null) {
      loadTeams();
    }
  }, [playerName]);

  // Handle starting the game
  const handleStartGame = async () => {
    if (!selectedTeam || !playerName) return;

    setIsStarting(true);
    try {
      await window.api.invoke(IpcChannels.GAME_NEW, {
        playerName,
        teamId: selectedTeam.id,
      });
      navigate(RoutePaths.GAME);
    } catch (error) {
      console.error('Failed to start game:', error);
      setIsStarting(false);
    }
  };

  // Show nothing while redirecting
  if (playerName === null) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="team-select-screen flex items-center justify-center min-h-screen bg-gray-800">
        <p className="text-white">Loading teams...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="team-select-screen flex flex-col items-center justify-center min-h-screen bg-gray-800 gap-4">
        <p className="text-red-400">{loadError}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="team-select-screen flex flex-col items-center justify-center min-h-screen bg-gray-800 gap-4">
        <p className="text-gray-400">No teams available.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="team-select-screen flex flex-col min-h-screen bg-gray-800">
      {/* Header */}
      <header className="bg-gray-900 p-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white">Select Team</h1>
      </header>

      {/* Main content - 2 columns for now (drivers column in PR D) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Team list */}
        <div className="w-64 bg-gray-700 border-r border-gray-600 overflow-y-auto">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => setSelectedTeam(team)}
              className={`w-full text-left px-4 py-3 border-b border-gray-600 transition-colors ${
                selectedTeam?.id === team.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-200 hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: team.primaryColor }}
                />
                <span className="font-medium">{team.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Right column: Team details */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedTeam ? (
            <div className="max-w-2xl">
              {/* Team header with color swatches */}
              <div className="flex items-start gap-6 mb-6">
                <ColorSwatch
                  primary={selectedTeam.primaryColor}
                  secondary={selectedTeam.secondaryColor}
                />
                <div>
                  <h2 className="text-3xl font-bold text-white">{selectedTeam.name}</h2>
                  <p className="text-gray-400">{selectedTeam.shortName}</p>
                </div>
              </div>

              {/* Team info */}
              <div className="space-y-4 mb-6">
                <div>
                  <span className="text-gray-400 text-sm uppercase tracking-wide">Principal</span>
                  <p className="text-white text-lg">{selectedTeam.principal}</p>
                </div>

                <div>
                  <span className="text-gray-400 text-sm uppercase tracking-wide">
                    Headquarters
                  </span>
                  <p className="text-white text-lg">{selectedTeam.headquarters}</p>
                </div>

                <div>
                  <span className="text-gray-400 text-sm uppercase tracking-wide">Budget</span>
                  <p className="text-white text-lg">{formatBudget(selectedTeam.budget)}</p>
                </div>

                <div>
                  <span className="text-gray-400 text-sm uppercase tracking-wide">
                    Factory Level
                  </span>
                  <p className="text-white text-lg">{selectedTeam.factoryLevel}/100</p>
                </div>
              </div>

              {/* Team description */}
              <div>
                <span className="text-gray-400 text-sm uppercase tracking-wide">About</span>
                <p className="text-gray-200 mt-1 leading-relaxed">{selectedTeam.description}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">Select a team to view details</p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <footer className="bg-gray-900 p-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Back
          </button>

          <div className="flex items-center gap-4">
            {selectedTeam && (
              <span className="text-gray-300">
                Do you want to manage <span className="text-white font-medium">{selectedTeam.name}</span>?
              </span>
            )}
            <button
              onClick={handleStartGame}
              disabled={!selectedTeam || isStarting}
              className="px-6 py-2 bg-green-600 text-white rounded disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
            >
              {isStarting ? 'Starting...' : 'OK'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
