import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoutePaths } from '../routes';
import { IpcChannels } from '../../shared/ipc';
import type { Team, Driver } from '../../shared/domain';
import { DriverRole } from '../../shared/domain';
import { generateFace, type TeamColors } from '../utils/face-generator';
import { TeamBadge } from '../components/TeamBadge';
import { IconButton } from '../components/NavButtons';
import { PRIMARY_BUTTON_CLASSES, GHOST_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatCurrency, DRIVER_ROLE_LABELS } from '../utils/format';

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

interface LabeledFieldProps {
  label: string;
  children: React.ReactNode;
  variant?: 'default' | 'description';
}

function LabeledField({ label, children, variant = 'default' }: LabeledFieldProps) {
  const valueClasses = variant === 'description'
    ? 'text-secondary text-sm leading-relaxed mt-1'
    : 'text-primary font-medium';

  return (
    <div>
      <span className="text-xs font-medium text-muted uppercase tracking-wider">{label}</span>
      <p className={valueClasses}>{children}</p>
    </div>
  );
}

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

  // Subtle accent-tinted card styling
  const sectionBorderColor = `color-mix(in srgb, ${selectedTeam.primaryColor} 15%, var(--neutral-750))`;
  const cardStyle: CSSProperties = {
    background: `linear-gradient(145deg,
      color-mix(in srgb, ${selectedTeam.primaryColor} 8%, var(--neutral-800)) 0%,
      color-mix(in srgb, ${selectedTeam.primaryColor} 3%, var(--neutral-850)) 100%)`,
    borderColor: `color-mix(in srgb, ${selectedTeam.primaryColor} 20%, var(--neutral-700))`,
    boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 40px color-mix(in srgb, ${selectedTeam.primaryColor} 10%, transparent)`,
  };

  return (
    <div className="team-select-screen flex items-center justify-center w-full min-h-screen surface-base p-8">
      {/* Central card with subtle team accent */}
      <div
        className="w-full max-w-4xl rounded-xl border transition-all duration-300"
        style={cardStyle}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: sectionBorderColor }}>
          <h1 className="text-2xl font-bold text-primary">Select Team</h1>
          <p className="text-secondary mt-1">
            Choose the team you want to manage, {playerName}
          </p>
        </div>

        {/* Team selector with arrows */}
        <div className="p-6 border-b" style={{ borderColor: sectionBorderColor }}>
          <div className="flex items-center justify-between gap-4">
            {/* Prev button */}
            <IconButton
              icon={ChevronLeft}
              onClick={handlePrevTeam}
              variant="ghost"
              size="sm"
            />

            {/* Team info */}
            <div className="flex-1 flex items-center gap-5">
              {/* Team logo */}
              <TeamBadge team={selectedTeam} className="w-16 h-14" />

              {/* Team name & info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-primary truncate">
                  {selectedTeam.name}
                </h2>
                <p className="text-secondary text-sm">
                  {selectedTeam.headquarters} · {formatCurrency(selectedTeam.budget)}
                </p>
              </div>

              {/* Team counter */}
              <div className="text-muted text-sm tabular-nums">
                {selectedIndex + 1} / {teams.length}
              </div>
            </div>

            {/* Next button */}
            <IconButton
              icon={ChevronRight}
              onClick={handleNextTeam}
              variant="ghost"
              size="sm"
            />
          </div>
        </div>

        {/* Team details grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Team info */}
          <div className="space-y-4">
            <LabeledField label="Principal">{selectedTeam.principal}</LabeledField>
            <LabeledField label="Factory Level">{selectedTeam.factoryLevel}/100</LabeledField>
            <LabeledField label="About" variant="description">{selectedTeam.description}</LabeledField>
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
                      <p className="text-muted text-sm">{DRIVER_ROLE_LABELS[driver.role]}</p>
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
        <div className="p-6 border-t flex items-center justify-between" style={{ borderColor: sectionBorderColor }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={GHOST_BUTTON_CLASSES}
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
              className={PRIMARY_BUTTON_CLASSES}
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
