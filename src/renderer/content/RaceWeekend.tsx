import { Flag, Loader2 } from 'lucide-react';
import { useDerivedGameState, useAdvanceWeek } from '../hooks';
import { ACCENT_BUTTON_CLASSES, ACCENT_BORDERED_BUTTON_STYLE } from '../utils/theme-styles';

export function RaceWeekend() {
  const { nextRace, nextRaceCircuit } = useDerivedGameState();
  const advanceWeek = useAdvanceWeek();

  const circuitName = nextRaceCircuit?.name ?? 'Circuit';
  const raceNumber = nextRace?.raceNumber ?? 0;

  const handleRunRace = () => {
    advanceWeek.mutate();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="text-center">
        <p className="text-muted text-sm uppercase tracking-wider">Round {raceNumber}</p>
        <h1 className="text-4xl font-bold text-primary mt-2">{circuitName}</h1>
        <p className="text-muted mt-4">Race weekend stub - full implementation coming soon</p>
      </div>

      <button
        type="button"
        onClick={handleRunRace}
        disabled={advanceWeek.isPending}
        className={`${ACCENT_BUTTON_CLASSES} px-6 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
        style={ACCENT_BORDERED_BUTTON_STYLE}
      >
        {advanceWeek.isPending ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Flag size={20} />
        )}
        <span>Run Race</span>
      </button>
    </div>
  );
}
