import { ChevronRight, Loader2, MapPin } from 'lucide-react';
import { useDerivedGameState, useAdvanceWeek, useGoToCircuit } from '../hooks';
import { GamePhase, CalendarEntry } from '../../shared/domain';
import { ACCENT_MUTED_BUTTON_CLASSES, ACCENT_BORDERED_BUTTON_STYLE } from '../utils/theme-styles';

type ButtonAction = 'advanceWeek' | 'goToCircuit' | 'disabled';

/**
 * Determine the button action and text based on game state
 */
function getButtonConfig(
  phase: GamePhase,
  currentWeek: number,
  nextRace: CalendarEntry | null,
  raceName: string
): { action: ButtonAction; text: string } {
  if (phase === GamePhase.PostSeason) {
    return { action: 'disabled', text: 'Season Complete' };
  }

  // Check if current week has a race (next uncompleted race is this week)
  if (nextRace && nextRace.weekNumber === currentWeek) {
    return { action: 'goToCircuit', text: `Go to ${raceName}` };
  }

  return { action: 'advanceWeek', text: 'Advance Week' };
}

export function AdvanceWeekButton() {
  const { gameState, nextRace, nextRaceCircuit } = useDerivedGameState();
  const advanceWeek = useAdvanceWeek();
  const goToCircuit = useGoToCircuit();

  if (!gameState) {
    return null;
  }

  const { phase, currentDate } = gameState;

  // Hide during race weekend - race screen handles progression
  if (phase === GamePhase.RaceWeekend) {
    return null;
  }

  const isLoading = advanceWeek.isPending || goToCircuit.isPending;
  const raceName = nextRaceCircuit?.name ?? 'Race';
  const { action, text } = getButtonConfig(
    phase,
    currentDate.week,
    nextRace,
    raceName
  );

  const handleClick = () => {
    if (action === 'goToCircuit') {
      goToCircuit.mutate();
    } else if (action === 'advanceWeek') {
      advanceWeek.mutate();
    }
  };

  const isDisabled = action === 'disabled' || isLoading;
  const Icon = action === 'goToCircuit' ? MapPin : ChevronRight;

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
