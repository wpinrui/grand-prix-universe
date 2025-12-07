import { ChevronRight, Flag, Loader2 } from 'lucide-react';
import { useDerivedGameState, useAdvanceWeek } from '../hooks';
import { GamePhase } from '../../shared/domain';
import { ACCENT_BUTTON_CLASSES, ACCENT_BUTTON_STYLE } from '../utils/theme-styles';

/**
 * Get the appropriate button text and icon based on game phase and calendar
 */
function getButtonConfig(
  phase: GamePhase,
  currentWeek: number,
  nextRaceWeek: number | null,
  nextRaceCircuitName: string | null
): { text: string; icon: 'advance' | 'race' } {
  // During a race weekend, show "Run Race"
  if (phase === GamePhase.RaceWeekend) {
    const raceName = nextRaceCircuitName ?? 'Race';
    return { text: `Run ${raceName}`, icon: 'race' };
  }

  // Post-season: blocked, but show appropriate text
  if (phase === GamePhase.PostSeason) {
    return { text: 'Season Complete', icon: 'advance' };
  }

  // Pre-season or between races: check if next week is a race
  if (nextRaceWeek !== null && nextRaceWeek === currentWeek + 1) {
    const raceName = nextRaceCircuitName ?? 'Race';
    return { text: `Go to ${raceName}`, icon: 'advance' };
  }

  // Default: just advance the week
  return { text: 'Advance Week', icon: 'advance' };
}

export function AdvanceWeekButton() {
  const { gameState, nextRace, nextRaceCircuit } = useDerivedGameState();
  const advanceWeek = useAdvanceWeek();

  // No game state = nothing to render
  if (!gameState) {
    return null;
  }

  const { phase, currentDate } = gameState;
  const isPostSeason = phase === GamePhase.PostSeason;
  const isLoading = advanceWeek.isPending;

  const config = getButtonConfig(
    phase,
    currentDate.week,
    nextRace?.weekNumber ?? null,
    nextRaceCircuit?.name ?? null
  );

  const handleClick = () => {
    if (!isPostSeason && !isLoading) {
      advanceWeek.mutate();
    }
  };

  const Icon = config.icon === 'race' ? Flag : ChevronRight;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPostSeason || isLoading}
      className={`${ACCENT_BUTTON_CLASSES} px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={ACCENT_BUTTON_STYLE}
      title={isPostSeason ? 'End season to continue' : config.text}
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Icon size={16} />
      )}
      <span>{config.text}</span>
    </button>
  );
}
