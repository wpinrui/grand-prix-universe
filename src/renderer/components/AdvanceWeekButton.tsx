import { useEffect } from 'react';
import { Play, Square, Loader2, MapPin } from 'lucide-react';
import { useDerivedGameState, useGoToCircuit, useStartSimulation, useStopSimulation, useSimulationTickListener } from '../hooks';
import { GamePhase, CalendarEntry } from '../../shared/domain';
import { ACCENT_MUTED_BUTTON_CLASSES, ACCENT_BORDERED_BUTTON_STYLE } from '../utils/theme-styles';
import { getWeekNumber } from '../../shared/utils/date-utils';

type ButtonAction = 'startSimulation' | 'stopSimulation' | 'goToCircuit' | 'disabled';

/** Icon for each button action */
const ACTION_ICONS: Record<ButtonAction, typeof Play> = {
  startSimulation: Play,
  stopSimulation: Square,
  goToCircuit: MapPin,
  disabled: Play,
};

/**
 * Determine the button action and text based on game state
 */
function getButtonConfig(
  phase: GamePhase,
  currentWeek: number,
  nextRace: CalendarEntry | null,
  raceName: string,
  isSimulating: boolean
): { action: ButtonAction; text: string } {
  if (phase === GamePhase.PostSeason) {
    return { action: 'disabled', text: 'Season Complete' };
  }

  // If simulating, show stop button
  if (isSimulating) {
    return { action: 'stopSimulation', text: 'Stop' };
  }

  // Check if current week has a race (next uncompleted race is this week)
  if (nextRace && nextRace.weekNumber === currentWeek) {
    return { action: 'goToCircuit', text: `Go to ${raceName}` };
  }

  return { action: 'startSimulation', text: 'Advance Time' };
}

export function AdvanceWeekButton() {
  const { gameState, nextRace, nextRaceCircuit } = useDerivedGameState();
  const goToCircuit = useGoToCircuit();
  const startSimulation = useStartSimulation();
  const stopSimulation = useStopSimulation();

  // Subscribe to simulation tick events to update game state
  useSimulationTickListener();

  const isSimulating = gameState?.simulation?.isSimulating ?? false;

  // Esc key handler to stop simulation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSimulating && !stopSimulation.isPending) {
        stopSimulation.mutate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSimulating, stopSimulation]);

  if (!gameState) {
    return null;
  }

  const { phase, currentDate } = gameState;

  // Hide during race weekend - race screen handles progression
  if (phase === GamePhase.RaceWeekend) {
    return null;
  }

  const isLoading = goToCircuit.isPending || startSimulation.isPending || stopSimulation.isPending;
  const raceName = nextRaceCircuit?.name ?? 'Race';
  const currentWeek = getWeekNumber(currentDate);
  const { action, text } = getButtonConfig(
    phase,
    currentWeek,
    nextRace,
    raceName,
    isSimulating
  );

  const handleClick = () => {
    if (action === 'goToCircuit') {
      goToCircuit.mutate();
    } else if (action === 'startSimulation') {
      startSimulation.mutate();
    } else if (action === 'stopSimulation') {
      stopSimulation.mutate();
    }
  };

  const isDisabled = action === 'disabled' || isLoading;
  const Icon = ACTION_ICONS[action];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`${ACCENT_MUTED_BUTTON_CLASSES} px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={ACCENT_BORDERED_BUTTON_STYLE}
      title={action === 'disabled' ? 'End season to continue' : text}
    >
      <span>{text}</span>
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Icon size={16} />
      )}
    </button>
  );
}
