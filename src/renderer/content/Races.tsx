import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { FlagIcon } from '../components/FlagIcon';
import {
  TABLE_CELL_BASE,
  TABLE_HEADER_CLASS,
  TABLE_HEADER_ROW_CLASS,
  TABLE_BODY_CLASS,
  getHighlightedRowStyles,
} from '../utils/theme-styles';
import { getRaceSunday, formatGameDate, daysBetween } from '../../shared/utils/date-utils';
import type { CalendarEntry, Circuit, GameDate } from '../../shared/domain';

// ===========================================
// HELPERS
// ===========================================

type RaceStatus = 'completed' | 'next' | 'upcoming';

function getRaceStatus(entry: CalendarEntry, nextRaceNumber: number | null): RaceStatus {
  if (entry.completed) return 'completed';
  if (entry.raceNumber === nextRaceNumber) return 'next';
  return 'upcoming';
}

const STATUS_BADGE_BASE = 'px-2 py-0.5 text-xs rounded';

const STATUS_BADGE_STYLES: Record<RaceStatus, { className: string; label: string }> = {
  completed: { className: 'bg-[var(--neutral-700)] text-muted', label: 'Completed' },
  next: { className: 'bg-emerald-600/30 text-emerald-400 border border-emerald-600/50', label: 'Next Race' },
  upcoming: { className: 'bg-[var(--neutral-800)] text-secondary', label: 'Upcoming' },
};

function StatusBadge({ status }: { status: RaceStatus }) {
  const { className, label } = STATUS_BADGE_STYLES[status];
  return <span className={`${STATUS_BADGE_BASE} ${className}`}>{label}</span>;
}

function getDaysUntilText(raceDate: GameDate, currentDate: GameDate): string {
  const days = daysBetween(currentDate, raceDate);
  if (days < 0) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

// ===========================================
// ROW COMPONENT
// ===========================================

interface RaceRowProps {
  entry: CalendarEntry;
  circuit: Circuit | undefined;
  raceDate: GameDate;
  currentDate: GameDate;
  status: RaceStatus;
}

function RaceRow({ entry, circuit, raceDate, currentDate, status }: RaceRowProps) {
  const isNext = status === 'next';
  const styles = getHighlightedRowStyles(isNext);
  const daysUntil = status !== 'completed' ? getDaysUntilText(raceDate, currentDate) : '';

  return (
    <tr className={styles.rowClass} style={styles.rowStyle}>
      {/* Race Number */}
      <td className={`${TABLE_CELL_BASE} text-center font-bold text-primary tabular-nums w-16`}>
        {entry.raceNumber}
      </td>

      {/* Flag + Country */}
      <td className={`${TABLE_CELL_BASE} w-40`}>
        <div className="flex items-center gap-2">
          <FlagIcon country={circuit?.country ?? ''} size="md" />
          <span className="text-secondary">{circuit?.country ?? 'Unknown'}</span>
        </div>
      </td>

      {/* Circuit Name */}
      <td className={TABLE_CELL_BASE}>
        <span className="font-semibold text-primary" style={styles.nameStyle}>
          {circuit?.name ?? entry.circuitId}
        </span>
        <span className="text-muted text-sm ml-2">
          {circuit?.location ?? ''}
        </span>
      </td>

      {/* Race Date */}
      <td className={`${TABLE_CELL_BASE} text-secondary`}>
        {formatGameDate(raceDate)}
      </td>

      {/* Days Until */}
      <td className={`${TABLE_CELL_BASE} text-center tabular-nums whitespace-nowrap`}>
        {daysUntil && (
          <span className={isNext ? 'text-emerald-400 font-medium' : 'text-muted'}>
            {daysUntil}
          </span>
        )}
      </td>

      {/* Status */}
      <td className={`${TABLE_CELL_BASE} text-center w-28`}>
        <StatusBadge status={status} />
      </td>
    </tr>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Races() {
  const { gameState, nextRace } = useDerivedGameState();

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading race calendar...</p>
      </div>
    );
  }

  const { calendar } = gameState.currentSeason;
  const { currentDate, circuits } = gameState;
  const nextRaceNumber = nextRace?.raceNumber ?? null;

  const getCircuit = (circuitId: string) => circuits.find((c) => c.id === circuitId);

  return (
    <div className="space-y-8 max-w-6xl">
      <section>
        <SectionHeading>Season Calendar</SectionHeading>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className={TABLE_HEADER_CLASS}>
              <tr className={TABLE_HEADER_ROW_CLASS}>
                <th className={`${TABLE_CELL_BASE} text-center w-16`}>Rd</th>
                <th className={`${TABLE_CELL_BASE} text-left w-40`}>Country</th>
                <th className={`${TABLE_CELL_BASE} text-left`}>Circuit</th>
                <th className={`${TABLE_CELL_BASE} text-left`}>Date</th>
                <th className={`${TABLE_CELL_BASE} text-center whitespace-nowrap`}>In</th>
                <th className={`${TABLE_CELL_BASE} text-center w-28`}>Status</th>
              </tr>
            </thead>
            <tbody className={TABLE_BODY_CLASS}>
              {calendar.map((entry) => {
                const circuit = getCircuit(entry.circuitId);
                const raceDate = getRaceSunday(currentDate.year, entry.weekNumber);
                const status = getRaceStatus(entry, nextRaceNumber);

                return (
                  <RaceRow
                    key={entry.raceNumber}
                    entry={entry}
                    circuit={circuit}
                    raceDate={raceDate}
                    currentDate={currentDate}
                    status={status}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
