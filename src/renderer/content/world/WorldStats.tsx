/**
 * World Stats page - Historical stats with line charts
 * Compare team performance across seasons
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useDerivedGameState } from '../../hooks';
import { Dropdown, TabBar } from '../../components';
import { seasonToYear } from '../../../shared/utils/date-utils';
import type { SeasonData, ConstructorStanding, Team } from '../../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type StatCategory = 'points' | 'position' | 'wins' | 'podiums' | 'polePositions';
type TimeScale = 'season' | 'race';

interface StatOption {
  value: StatCategory;
  label: string;
  invertYAxis?: boolean; // For position, lower is better
}

interface TimeScaleOption {
  value: TimeScale;
  label: string;
}

interface ChartDataPoint {
  season: number;
  race?: number; // For race-by-race view
  label: string; // Display label for X-axis
  [teamId: string]: number | string | undefined;
}

// ===========================================
// CONSTANTS
// ===========================================

const STAT_OPTIONS: StatOption[] = [
  { value: 'points', label: 'Points' },
  { value: 'position', label: 'Championship Position', invertYAxis: true },
  { value: 'wins', label: 'Wins' },
  { value: 'podiums', label: 'Podiums' },
  { value: 'polePositions', label: 'Pole Positions' },
];

const TAB_OPTIONS = [
  { id: 'chart' as const, label: 'Chart' },
  { id: 'table' as const, label: 'Table' },
];

const TIME_SCALE_OPTIONS: TimeScaleOption[] = [
  { value: 'season', label: 'Per Season' },
  { value: 'race', label: 'Per Race' },
];

// ===========================================
// HELPERS
// ===========================================

function getTeamStat(standing: ConstructorStanding | undefined, stat: StatCategory): number {
  if (!standing) return 0;
  return standing[stat];
}

function formatStatValue(value: number, stat: StatCategory): string | number {
  return stat === 'position' ? `P${value}` : value;
}

function buildSeasonChartData(
  seasons: SeasonData[],
  teamIds: string[],
  stat: StatCategory
): ChartDataPoint[] {
  return seasons.map((season) => {
    const year = seasonToYear(season.seasonNumber);
    const dataPoint: ChartDataPoint = {
      season: season.seasonNumber,
      label: String(year),
    };
    teamIds.forEach((teamId) => {
      const standing = season.constructorStandings.find((s) => s.teamId === teamId);
      dataPoint[teamId] = getTeamStat(standing, stat);
    });
    return dataPoint;
  });
}

function buildRaceChartData(
  seasons: SeasonData[],
  selectedTeamIds: string[],
  stat: StatCategory,
  allTeamIds: string[]
): ChartDataPoint[] {
  const dataPoints: ChartDataPoint[] = [];

  seasons.forEach((season) => {
    // Track cumulative stats for ALL teams (needed for accurate position calculation)
    const cumulativeStats: Record<string, Record<StatCategory, number>> = {};
    allTeamIds.forEach((teamId) => {
      cumulativeStats[teamId] = {
        points: 0,
        position: 0,
        wins: 0,
        podiums: 0,
        polePositions: 0,
      };
    });

    // Process each completed race
    const completedRaces = season.calendar.filter((r) => r.completed && r.result);
    completedRaces.forEach((race) => {
      const result = race.result!;

      // Update cumulative stats from race results for ALL teams
      allTeamIds.forEach((teamId) => {
        const teamRaceResults = result.race.filter((r) => r.teamId === teamId);
        const teamQualiResults = result.qualifying.filter((r) => r.teamId === teamId);

        teamRaceResults.forEach((r) => {
          cumulativeStats[teamId].points += r.points;
          if (r.finishPosition === 1) cumulativeStats[teamId].wins += 1;
          if (r.finishPosition !== null && r.finishPosition <= 3) cumulativeStats[teamId].podiums += 1;
        });

        teamQualiResults.forEach((q) => {
          if (q.gridPosition === 1) cumulativeStats[teamId].polePositions += 1;
        });
      });

      // Create data point for this race (only for selected teams)
      const year = seasonToYear(season.seasonNumber);
      const dataPoint: ChartDataPoint = {
        season: season.seasonNumber,
        race: race.raceNumber,
        label: `${year} R${race.raceNumber}`,
      };

      selectedTeamIds.forEach((teamId) => {
        if (stat === 'position') {
          // Calculate position based on ALL teams, not just selected
          const sortedTeams = [...allTeamIds].sort(
            (a, b) => cumulativeStats[b].points - cumulativeStats[a].points
          );
          dataPoint[teamId] = sortedTeams.indexOf(teamId) + 1;
        } else {
          dataPoint[teamId] = cumulativeStats[teamId][stat];
        }
      });

      dataPoints.push(dataPoint);
    });
  });

  return dataPoints;
}

function buildChartData(
  seasons: SeasonData[],
  selectedTeamIds: string[],
  stat: StatCategory,
  timeScale: TimeScale,
  allTeamIds: string[]
): ChartDataPoint[] {
  if (timeScale === 'race') {
    return buildRaceChartData(seasons, selectedTeamIds, stat, allTeamIds);
  }
  return buildSeasonChartData(seasons, selectedTeamIds, stat);
}

// ===========================================
// TEAM SELECTOR COMPONENT
// ===========================================

interface TeamSelectorProps {
  teams: Team[];
  selectedTeamIds: Set<string>;
  onToggleTeam: (teamId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function TeamSelector({
  teams,
  selectedTeamIds,
  onToggleTeam,
  onSelectAll,
  onClearAll,
}: TeamSelectorProps) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Header inline with team chips */}
        <div className="flex items-center gap-2 mr-2">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">Teams</h3>
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs text-[var(--accent-400)] hover:text-[var(--accent-300)] cursor-pointer"
          >
            All
          </button>
          <span className="text-muted">|</span>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-[var(--accent-400)] hover:text-[var(--accent-300)] cursor-pointer"
          >
            None
          </button>
        </div>
        {/* Team chips in a horizontal row */}
        {teams.map((team) => {
          const isSelected = selectedTeamIds.has(team.id);
          return (
            <label
              key={team.id}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors
                ${isSelected ? 'bg-[var(--neutral-700)]' : 'hover:bg-[var(--neutral-800)]'}
              `}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleTeam(team.id)}
                className="sr-only"
              />
              <span
                className="w-3 h-3 rounded-sm border flex-shrink-0"
                style={{
                  backgroundColor: isSelected ? team.primaryColor : 'transparent',
                  borderColor: team.primaryColor,
                }}
              />
              <span className="text-sm text-primary">{team.shortName}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================
// STATS TABLE COMPONENT
// ===========================================

interface StatsTableProps {
  seasons: SeasonData[];
  teams: Team[];
  selectedTeamIds: Set<string>;
  stat: StatCategory;
}

function StatsTable({ seasons, teams, selectedTeamIds, stat }: StatsTableProps) {
  const selectedTeams = teams.filter((t) => selectedTeamIds.has(t.id));
  const statOption = STAT_OPTIONS.find((o) => o.value === stat);

  if (selectedTeams.length === 0) {
    return (
      <div className="card p-8 text-center text-secondary">
        Select at least one team to view stats
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead className="surface-inset border-b border-[var(--neutral-600)]">
          <tr className="text-xs font-semibold text-muted uppercase tracking-wider">
            <th className="px-4 py-3 text-left">Season</th>
            {selectedTeams.map((team) => (
              <th key={team.id} className="px-4 py-3 text-right">
                <span className="flex items-center justify-end gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: team.primaryColor }}
                  />
                  {team.shortName}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--neutral-700)]">
          {seasons.map((season) => (
            <tr key={season.seasonNumber} className="hover:bg-[var(--neutral-800)]/50">
              <td className="px-4 py-3 text-primary font-medium">
                Season {season.seasonNumber}
              </td>
              {selectedTeams.map((team) => {
                const standing = season.constructorStandings.find((s) => s.teamId === team.id);
                const value = getTeamStat(standing, stat);
                return (
                  <td key={team.id} className="px-4 py-3 text-right text-secondary">
                    {formatStatValue(value, stat)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-[var(--neutral-700)] bg-[var(--neutral-850)] text-xs text-muted">
        Showing {statOption?.label} across {seasons.length} season{seasons.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ===========================================
// CUSTOM TOOLTIP
// ===========================================

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
  teamById: Map<string, Team>;
  stat: StatCategory;
}

function CustomTooltip({ active, payload, label, teamById, stat }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  // Format the label for display (label is already year or "year Rn")
  const displayLabel = typeof label === 'string' && label.includes('R')
    ? label.replace(/(\d+) R(\d+)/, '$1 Race $2')
    : String(label);

  return (
    <div className="surface-primary border border-subtle rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-primary mb-2">{displayLabel}</p>
      <div className="space-y-1">
        {payload.map((entry) => {
          const team = teamById.get(entry.dataKey);
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-secondary">{team?.shortName ?? entry.dataKey}:</span>
              <span className="text-primary font-medium">{formatStatValue(entry.value, stat)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================
// STATS CHART COMPONENT
// ===========================================

const CHART_HEIGHT = 600;
const CHART_MARGINS = { top: 20, right: 30, left: 20, bottom: 20 };

interface StatsChartProps {
  chartData: ChartDataPoint[];
  selectedTeamIds: Set<string>;
  teamById: Map<string, Team>;
  stat: StatCategory;
  invertYAxis?: boolean;
}

function StatsChart({ chartData, selectedTeamIds, teamById, stat, invertYAxis }: StatsChartProps) {
  if (selectedTeamIds.size === 0) {
    return (
      <div className="card p-4">
        <div className="h-80 flex items-center justify-center text-secondary">
          Select at least one team to view the chart
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={chartData} margin={CHART_MARGINS}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-700)" />
          <XAxis
            dataKey="label"
            stroke="var(--neutral-500)"
            tick={{ fill: 'var(--neutral-400)', fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--neutral-500)"
            tick={{ fill: 'var(--neutral-400)' }}
            reversed={invertYAxis}
            domain={invertYAxis ? [1, 'auto'] : [0, 'auto']}
          />
          <Tooltip content={<CustomTooltip teamById={teamById} stat={stat} />} />
          <Legend
            formatter={(value: string) => {
              const team = teamById.get(value);
              return team?.shortName ?? value;
            }}
          />
          {Array.from(selectedTeamIds).map((teamId) => {
            const team = teamById.get(teamId);
            return (
              <Line
                key={teamId}
                type="linear"
                dataKey={teamId}
                stroke={team?.primaryColor ?? '#888'}
                strokeWidth={2}
                dot={{ fill: team?.primaryColor ?? '#888', strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

// Select ALL teams by default

export function WorldStats() {
  const { gameState } = useDerivedGameState();
  const [selectedStat, setSelectedStat] = useState<StatCategory>('points');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<'chart' | 'table'>('chart');
  const [timeScale, setTimeScale] = useState<TimeScale>('race');
  const [fromSeason, setFromSeason] = useState<number | null>(null);
  const [toSeason, setToSeason] = useState<number | null>(null);
  const hasInitializedTeams = useRef(false);
  const hasInitializedRange = useRef(false);

  // Build all seasons array (past + current)
  const allSeasons = useMemo(() => {
    if (!gameState) return [];
    return [...gameState.pastSeasons, gameState.currentSeason].sort(
      (a, b) => a.seasonNumber - b.seasonNumber
    );
  }, [gameState]);

  // Initialize season range on first load
  useEffect(() => {
    if (hasInitializedRange.current) return;
    if (allSeasons.length === 0) return;

    setFromSeason(allSeasons[0].seasonNumber);
    setToSeason(allSeasons[allSeasons.length - 1].seasonNumber);
    hasInitializedRange.current = true;
  }, [allSeasons]);

  // Filter seasons by selected range
  const filteredSeasons = useMemo(() => {
    if (fromSeason === null || toSeason === null) return allSeasons;
    return allSeasons.filter(
      (s) => s.seasonNumber >= fromSeason && s.seasonNumber <= toSeason
    );
  }, [allSeasons, fromSeason, toSeason]);

  // Build season options for dropdowns (using years)
  const seasonOptions = useMemo(() => {
    return allSeasons.map((s) => ({
      value: String(s.seasonNumber),
      label: String(seasonToYear(s.seasonNumber)),
    }));
  }, [allSeasons]);

  const teams = gameState?.teams ?? [];

  // Memoized team lookup map for O(1) access
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Initialize selected teams to ALL teams on first load
  useEffect(() => {
    if (hasInitializedTeams.current) return;
    if (teams.length === 0) return;

    setSelectedTeamIds(new Set(teams.map((t) => t.id)));
    hasInitializedTeams.current = true;
  }, [teams]);

  // All team IDs for accurate position calculation
  const allTeamIds = useMemo(() => teams.map((t) => t.id), [teams]);

  // Build chart data from filtered seasons
  const chartData = useMemo(() => {
    return buildChartData(filteredSeasons, Array.from(selectedTeamIds), selectedStat, timeScale, allTeamIds);
  }, [filteredSeasons, selectedTeamIds, selectedStat, timeScale, allTeamIds]);

  // Get stat option for Y-axis config
  const statOption = STAT_OPTIONS.find((o) => o.value === selectedStat);

  // Handlers
  const handleToggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedTeamIds(new Set(teams.map((t) => t.id)));
  };

  const handleClearAll = () => {
    setSelectedTeamIds(new Set());
  };

  // Loading state
  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading stats...</p>
      </div>
    );
  }

  // No data state
  if (allSeasons.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">No season data available yet</p>
      </div>
    );
  }

  // Handlers for season range
  const handleFromSeasonChange = (value: string) => {
    const num = parseInt(value, 10);
    setFromSeason(num);
    // Ensure "to" is not before "from"
    if (toSeason !== null && num > toSeason) {
      setToSeason(num);
    }
  };

  const handleToSeasonChange = (value: string) => {
    const num = parseInt(value, 10);
    setToSeason(num);
    // Ensure "from" is not after "to"
    if (fromSeason !== null && num < fromSeason) {
      setFromSeason(num);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Statistic
          </label>
          <Dropdown
            options={STAT_OPTIONS}
            value={selectedStat}
            onChange={setSelectedStat}
            className="w-56"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Scale
          </label>
          <Dropdown
            options={TIME_SCALE_OPTIONS}
            value={timeScale}
            onChange={setTimeScale}
            className="w-40"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            From
          </label>
          <Dropdown
            options={seasonOptions}
            value={fromSeason !== null ? String(fromSeason) : ''}
            onChange={handleFromSeasonChange}
            className="w-36"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            To
          </label>
          <Dropdown
            options={seasonOptions}
            value={toSeason !== null ? String(toSeason) : ''}
            onChange={handleToSeasonChange}
            className="w-36"
          />
        </div>
        <div className="ml-auto">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            View
          </label>
          <TabBar tabs={TAB_OPTIONS} activeTab={activeView} onTabChange={setActiveView} />
        </div>
      </div>

      {/* Chart or Table - full width */}
      {activeView === 'chart' ? (
        <StatsChart
          chartData={chartData}
          selectedTeamIds={selectedTeamIds}
          teamById={teamById}
          stat={selectedStat}
          invertYAxis={statOption?.invertYAxis}
        />
      ) : (
        <StatsTable
          seasons={filteredSeasons}
          teams={teams}
          selectedTeamIds={selectedTeamIds}
          stat={selectedStat}
        />
      )}

      {/* Team selector - horizontal row below chart */}
      <TeamSelector
        teams={teams}
        selectedTeamIds={selectedTeamIds}
        onToggleTeam={handleToggleTeam}
        onSelectAll={handleSelectAll}
        onClearAll={handleClearAll}
      />

      {/* Info footer */}
      <div className="text-xs text-muted">
        Showing {filteredSeasons.length} season{filteredSeasons.length !== 1 ? 's' : ''}{' '}
        {timeScale === 'race' ? `(${chartData.length} data points)` : ''} —{' '}
        {fromSeason !== null ? seasonToYear(fromSeason) : ''} to{' '}
        {toSeason !== null ? seasonToYear(toSeason) : ''}
      </div>
    </div>
  );
}
