import { useState, useMemo } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, Dropdown, EntityLink } from '../components';
import type { DropdownOption } from '../components';
import { ACCENT_CARD_STYLE } from '../utils/theme-styles';
import { formatGameDate, seasonToYear } from '../../shared/utils/date-utils';
import { formatCurrency } from '../utils/format';
import { PartsLogEntryType, type PartsLogEntry, type Driver } from '../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type TypeFilter = 'all' | PartsLogEntryType;

// ===========================================
// CONSTANTS
// ===========================================

const TYPE_FILTER_OPTIONS: DropdownOption<TypeFilter>[] = [
  { value: 'all', label: 'All' },
  { value: PartsLogEntryType.Upgrade, label: 'Upgrades' },
  { value: PartsLogEntryType.Repair, label: 'Repairs' },
];

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/** Build season dropdown options from available data */
function buildSeasonOptions(
  currentSeason: number,
  entries: PartsLogEntry[]
): DropdownOption<string>[] {
  const seasons = new Set<number>([currentSeason]);
  entries.forEach((e) => seasons.add(e.seasonNumber));
  return Array.from(seasons)
    .sort((a, b) => b - a)
    .map((s) => ({ value: String(s), label: String(seasonToYear(s)) }));
}

/** Get driver display name from ID */
function getDriverName(driverId: string, drivers: Driver[]): string {
  const driver = drivers.find((d) => d.id === driverId);
  return driver ? `${driver.firstName} ${driver.lastName}` : 'Unknown Driver';
}

/** Format details column based on entry type */
function formatDetails(entry: PartsLogEntry, drivers: Driver[]): {
  text: string;
  driverId: string;
  driverName: string;
} {
  const driverName = getDriverName(entry.driverId, drivers);
  if (entry.type === PartsLogEntryType.Repair) {
    return {
      text: `Car ${entry.carNumber} - ${entry.repairDetails ?? 'Routine'}`,
      driverId: entry.driverId,
      driverName,
    };
  }
  if (entry.rushed) {
    return {
      text: 'BOTH (rushed)',
      driverId: entry.driverId,
      driverName,
    };
  }
  return {
    text: `Car ${entry.carNumber} (${driverName})`,
    driverId: entry.driverId,
    driverName,
  };
}

// ===========================================
// COMPONENTS
// ===========================================

interface PartsTableProps {
  entries: PartsLogEntry[];
  drivers: Driver[];
}

function PartsTable({ entries, drivers }: PartsTableProps) {
  if (entries.length === 0) {
    return (
      <div className="card p-8 text-center text-muted">
        <p>No entries for this year</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-subtle surface-secondary">
            <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
              Item
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-secondary uppercase tracking-wider">
              Cost
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
              Details
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {entries.map((entry) => {
            const details = formatDetails(entry, drivers);
            const isRepair = entry.type === PartsLogEntryType.Repair;

            return (
              <tr key={entry.id} className="hover:surface-secondary transition-colors">
                <td className="px-4 py-3 text-sm text-secondary">
                  {formatGameDate(entry.date)}
                </td>
                <td className="px-4 py-3 text-sm text-primary font-medium">
                  {entry.item}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-secondary">
                  {formatCurrency(entry.cost)}
                </td>
                <td className="px-4 py-3 text-sm text-secondary">
                  {isRepair ? (
                    <span>{details.text}</span>
                  ) : entry.rushed ? (
                    <span className="text-amber-400 font-medium">{details.text}</span>
                  ) : (
                    <EntityLink type="driver" id={details.driverId}>
                      {details.text}
                    </EntityLink>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Construction() {
  const { gameState } = useDerivedGameState();

  const currentSeason = gameState?.currentSeason?.seasonNumber ?? 1;
  const partsLog = gameState?.partsLog ?? [];
  const drivers = gameState?.drivers ?? [];

  const [selectedSeason, setSelectedSeason] = useState<string>(String(currentSeason));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Build season options
  const seasonOptions = useMemo(
    () => buildSeasonOptions(currentSeason, partsLog),
    [currentSeason, partsLog]
  );

  // Filter entries
  const filteredEntries = useMemo(() => {
    const seasonNum = parseInt(selectedSeason, 10);
    return partsLog
      .filter((e) => e.seasonNumber === seasonNum)
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .sort((a, b) => {
        // Sort by date descending (newest first)
        if (a.date.year !== b.date.year) return b.date.year - a.date.year;
        if (a.date.month !== b.date.month) return b.date.month - a.date.month;
        return b.date.day - a.date.day;
      });
  }, [partsLog, selectedSeason, typeFilter]);

  // Calculate totals in single pass
  const totals = useMemo(() => {
    let upgrades = 0;
    let repairs = 0;
    for (const entry of filteredEntries) {
      if (entry.type === PartsLogEntryType.Upgrade) {
        upgrades += entry.cost;
      } else {
        repairs += entry.cost;
      }
    }
    return { upgrades, repairs, total: upgrades + repairs };
  }, [filteredEntries]);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <SectionHeading>Parts & Repairs Log</SectionHeading>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Year:</span>
            <Dropdown
              id="season-filter"
              options={seasonOptions}
              value={selectedSeason}
              onChange={setSelectedSeason}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Type:</span>
            <Dropdown
              id="type-filter"
              options={TYPE_FILTER_OPTIONS}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v)}
              className="w-32"
            />
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="card p-4" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-xs text-secondary uppercase tracking-wider mb-1">Upgrades</div>
            <div className="text-lg font-semibold text-primary">{formatCurrency(totals.upgrades)}</div>
          </div>
          <div>
            <div className="text-xs text-secondary uppercase tracking-wider mb-1">Repairs</div>
            <div className="text-lg font-semibold text-primary">{formatCurrency(totals.repairs)}</div>
          </div>
          <div>
            <div className="text-xs text-secondary uppercase tracking-wider mb-1">Total Spent</div>
            <div className="text-lg font-semibold text-primary">{formatCurrency(totals.total)}</div>
          </div>
        </div>
      </div>

      {/* Parts Table */}
      <PartsTable entries={filteredEntries} drivers={drivers} />
    </div>
  );
}
