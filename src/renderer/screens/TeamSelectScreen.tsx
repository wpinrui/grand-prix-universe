import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoutePaths } from '../routes';
import { IpcChannels } from '../../shared/ipc';
import type { Team, Driver } from '../../shared/domain';
import { DriverRole } from '../../shared/domain';
import { generateFace, type TeamColors } from '../utils/face-generator';

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

// ===========================================
// HELPER COMPONENTS
// ===========================================

interface DriverPhotoProps {
  driver: Driver;
  teamColors: TeamColors;
}

const FACE_VERTICAL_OFFSET = -6;

function DriverPhoto({ driver, teamColors }: DriverPhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [driver.id]);

  const shouldGenerateFace = !driver.photoUrl || imageError;

  useEffect(() => {
    const container = containerRef.current;
    if (shouldGenerateFace && container) {
      container.innerHTML = '';
      generateFace(container, driver.id, driver.nationality, teamColors, 44);
    }
    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [driver.id, driver.nationality, teamColors, shouldGenerateFace]);

  if (driver.photoUrl && !imageError) {
    return (
      <img
        src={driver.photoUrl}
        alt={`${driver.firstName} ${driver.lastName}`}
        className="w-12 h-12 rounded-full object-cover"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--neutral-700)] flex justify-center">
      <div ref={containerRef} style={{ marginTop: FACE_VERTICAL_OFFSET }} />
    </div>
  );
}

function formatBudget(budget: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(budget);
}

function getDriverRolePriority(role: DriverRole): number {
  switch (role) {
    case DriverRole.First:
      return 0;
    case DriverRole.Second:
      return 1;
    case DriverRole.Equal:
      return 2;
    case DriverRole.Test:
      return 3;
  }
}

function formatDriverRole(role: DriverRole): string {
  switch (role) {
    case DriverRole.First:
      return '#1 driver';
    case DriverRole.Second:
      return '#2 driver';
    case DriverRole.Equal:
      return 'Equal status';
    case DriverRole.Test:
      return 'Test driver';
  }
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function TeamSelectScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const playerName = isValidLocationState(location.state) ? location.state.playerName : null;

  const [teams, setTeams] = useState<Team[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Redirect if no player name
  useEffect(() => {
    if (playerName === null) {
      navigate(RoutePaths.PLAYER_NAME, { replace: true });
    }
  }, [playerName, navigate]);

  // Fetch data
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedTeams, loadedDrivers] = await Promise.all([
          window.electronAPI.invoke(IpcChannels.CONFIG_GET_TEAMS),
          window.electronAPI.invoke(IpcChannels.CONFIG_GET_DRIVERS),
        ]);
        setTeams(loadedTeams);
        setDrivers(loadedDrivers);
      } catch (error) {
        console.error('Failed to load data:', error);
        setLoadError('Failed to load game data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    if (playerName !== null) {
      loadData();
    }
  }, [playerName]);

  const selectedTeam = teams[selectedIndex] ?? null;

  const teamDrivers = selectedTeam
    ? drivers
        .filter((d) => d.teamId === selectedTeam.id)
        .sort((a, b) => getDriverRolePriority(a.role) - getDriverRolePriority(b.role))
    : [];

  const teamColors = useMemo(
    () => ({
      primary: selectedTeam?.primaryColor ?? '',
      secondary: selectedTeam?.secondaryColor ?? '',
    }),
    [selectedTeam?.primaryColor, selectedTeam?.secondaryColor]
  );

  const handlePrevTeam = () => {
    setSelectedIndex((i) => (i > 0 ? i - 1 : teams.length - 1));
    setStartError(null);
  };

  const handleNextTeam = () => {
    setSelectedIndex((i) => (i < teams.length - 1 ? i + 1 : 0));
    setStartError(null);
  };

  const handleStartGame = async () => {
    if (!selectedTeam || !playerName) return;

    setIsStarting(true);
    setStartError(null);
    try {
      await window.electronAPI.invoke(IpcChannels.GAME_NEW, {
        playerName,
        teamId: selectedTeam.id,
      });
      navigate(RoutePaths.GAME);
    } catch (error) {
      console.error('Failed to start game:', error);
      setStartError('Failed to start game. Please try again.');
      setIsStarting(false);
    }
  };

  // Loading / Error states
  if (playerName === null) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full min-h-screen surface-base">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen surface-base gap-4">
        <p className="text-red-400">{loadError}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn px-4 py-2 text-secondary hover:text-primary"
        >
          <ArrowLeft size={18} />
          <span>Go Back</span>
        </button>
      </div>
    );
  }

  if (teams.length === 0 || !selectedTeam) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen surface-base gap-4">
        <p className="text-muted">No teams available.</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn px-4 py-2 text-secondary hover:text-primary"
        >
          <ArrowLeft size={18} />
          <span>Go Back</span>
        </button>
      </div>
    );
  }

  return (
    <div className="team-select-screen flex items-center justify-center w-full min-h-screen surface-base p-8">
      {/* Central card */}
      <div className="card w-full max-w-4xl">
        {/* Header */}
        <div className="p-6 border-b border-[var(--neutral-750)]">
          <h1 className="text-2xl font-bold text-primary">Select Team</h1>
          <p className="text-secondary mt-1">
            Choose the team you want to manage, {playerName}
          </p>
        </div>

        {/* Team selector with arrows */}
        <div className="p-6 border-b border-[var(--neutral-750)]">
          <div className="flex items-center justify-between gap-4">
            {/* Prev button */}
            <button
              type="button"
              onClick={handlePrevTeam}
              className="btn w-10 h-10 rounded-lg bg-[var(--neutral-800)] border border-[var(--neutral-700)] text-secondary hover:text-primary hover:border-[var(--neutral-600)] transition-all"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Team info */}
            <div className="flex-1 flex items-center gap-5">
              {/* Team badge */}
              <div
                className="w-16 h-14 rounded-lg overflow-hidden relative shrink-0"
                style={{
                  boxShadow: `0 4px 12px ${selectedTeam.primaryColor}33`,
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: selectedTeam.primaryColor }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: selectedTeam.secondaryColor,
                    clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                  }}
                />
              </div>

              {/* Team name & info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-primary truncate">
                  {selectedTeam.name}
                </h2>
                <p className="text-secondary text-sm">
                  {selectedTeam.headquarters} · {formatBudget(selectedTeam.budget)}
                </p>
              </div>

              {/* Team counter */}
              <div className="text-muted text-sm tabular-nums">
                {selectedIndex + 1} / {teams.length}
              </div>
            </div>

            {/* Next button */}
            <button
              type="button"
              onClick={handleNextTeam}
              className="btn w-10 h-10 rounded-lg bg-[var(--neutral-800)] border border-[var(--neutral-700)] text-secondary hover:text-primary hover:border-[var(--neutral-600)] transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Team details grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Team info */}
          <div className="space-y-4">
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Principal</span>
              <p className="text-primary font-medium">{selectedTeam.principal}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Factory Level</span>
              <p className="text-primary font-medium">{selectedTeam.factoryLevel}/100</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider">About</span>
              <p className="text-secondary text-sm leading-relaxed mt-1">
                {selectedTeam.description}
              </p>
            </div>
          </div>

          {/* Right: Drivers */}
          <div>
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Drivers</span>
            <div className="mt-2 space-y-2">
              {teamDrivers.length > 0 ? (
                teamDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--neutral-850)] border border-[var(--neutral-800)]"
                  >
                    <DriverPhoto driver={driver} teamColors={teamColors} />
                    <div className="flex-1 min-w-0">
                      <p className="text-primary font-medium truncate">
                        {driver.firstName} {driver.lastName}
                      </p>
                      <p className="text-muted text-sm">{formatDriverRole(driver.role)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted text-sm">No drivers assigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--neutral-750)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn px-4 py-2 text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-4">
            {startError && <span className="text-red-400 text-sm">{startError}</span>}
            {!startError && (
              <span className="text-secondary text-sm hidden sm:inline">
                Manage <span className="text-primary font-medium">{selectedTeam.name}</span>?
              </span>
            )}
            <button
              type="button"
              onClick={handleStartGame}
              disabled={isStarting}
              className="btn px-6 py-2 font-semibold bg-emerald-600 text-white border border-emerald-500 rounded-lg hover:bg-emerald-500 disabled:bg-[var(--neutral-700)] disabled:border-[var(--neutral-600)] disabled:text-muted disabled:cursor-not-allowed transition-all duration-200"
            >
              <span>{isStarting ? 'Starting...' : 'OK'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
