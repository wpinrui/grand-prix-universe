import { ChevronRight, Flag, Loader2 } from 'lucide-react';
import { useDerivedGameState, useAdvanceWeek } from '../hooks';
import { GamePhase } from '../../shared/domain';
import { ACCENT_BUTTON_CLASSES, ACCENT_BORDERED_BUTTON_STYLE } from '../utils/theme-styles';

/**
 * Get the button text based on game phase and calendar
 */
function getButtonText(
  phase: GamePhase,
  currentWeek: number,
  nextRaceWeek: number | null,
  raceName: string
): string {
  if (phase === GamePhase.RaceWeekend) {
    return `Run ${raceName}`;
  }

  if (phase === GamePhase.PostSeason) {
    return 'Season Complete';
  }

  if (nextRaceWeek !== null && nextRaceWeek === currentWeek + 1) {
    return `Go to ${raceName}`;
  }

  return 'Advance Week';
}

export function AdvanceWeekButton() {
  const { gameState, nextRace, nextRaceCircuit } = useDerivedGameState();
  const advanceWeek = useAdvanceWeek();

  if (!gameState) {
    return null;
  }

  const { phase, currentDate } = gameState;
  const isPostSeason = phase === GamePhase.PostSeason;
  const isRaceWeekend = phase === GamePhase.RaceWeekend;
  const isLoading = advanceWeek.isPending;

  const raceName = nextRaceCircuit?.name ?? 'Race';
  const buttonText = getButtonText(
    phase,
    currentDate.week,
    nextRace?.weekNumber ?? null,
    raceName
  );

  const handleClick = () => {
    advanceWeek.mutate();
  };

  const Icon = isRaceWeekend ? Flag : ChevronRight;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPostSeason || isLoading}
      className={`${ACCENT_BUTTON_CLASSES} px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={ACCENT_BORDERED_BUTTON_STYLE}
      title={isPostSeason ? 'End season to continue' : buttonText}
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Icon size={16} />
      )}
      <span>{buttonText}</span>
    </button>
  );
}
