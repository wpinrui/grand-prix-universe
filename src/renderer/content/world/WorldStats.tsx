/**
 * World Stats page - Historical stats with line charts
 * Compare team performance across seasons
 */
import { useState, useMemo } from 'react';
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
import type { SeasonData, ConstructorStanding, Team } from '../../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type StatCategory = 'points' | 'position' | 'wins' | 'podiums' | 'polePositions';

interface StatOption {
  value: StatCategory;
  label: string;
  invertYAxis?: boolean; // For position, lower is better
}

interface ChartDataPoint {
  season: number;
  [teamId: string]: number;
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

// ===========================================
// HELPERS
// ===========================================

function getTeamStat(standing: ConstructorStanding | undefined, stat: StatCategory): number {
  if (!standing) return 0;
  return standing[stat];
}

function buildChartData(
  seasons: SeasonData[],
  teamIds: string[],
  stat: StatCategory
): ChartDataPoint[] {
  return seasons.map((season) => {
    const dataPoint: ChartDataPoint = { season: season.seasonNumber };
    teamIds.forEach((teamId) => {
      const standing = season.constructorStandings.find((s) => s.teamId === teamId);
      dataPoint[teamId] = getTeamStat(standing, stat);
    });
    return dataPoint;
  });
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
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">Teams</h3>
        <div className="flex gap-2">
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
      </div>
      <div className="grid grid-cols-2 gap-2">
        {teams.map((team) => {
          const isSelected = selectedTeamIds.has(team.id);
          return (
            <label
              key={team.id}
              className={`
                flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
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
              <span className="text-sm text-primary truncate">{team.shortName}</span>
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
                const displayValue = stat === 'position' ? `P${value}` : value;
                return (
                  <td key={team.id} className="px-4 py-3 text-right text-secondary">
                    {displayValue}
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
  teams: Team[];
  stat: StatCategory;
}

function CustomTooltip({ active, payload, label, teams, stat }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="surface-primary border border-subtle rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-primary mb-2">Season {label}</p>
      <div className="space-y-1">
        {payload.map((entry) => {
          const team = teams.find((t) => t.id === entry.dataKey);
          const displayValue = stat === 'position' ? `P${entry.value}` : entry.value;
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-secondary">{team?.shortName ?? entry.dataKey}:</span>
              <span className="text-primary font-medium">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function WorldStats() {
  const { gameState } = useDerivedGameState();
  const [selectedStat, setSelectedStat] = useState<StatCategory>('points');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<'chart' | 'table'>('chart');

  // Build all seasons array (past + current)
  const allSeasons = useMemo(() => {
    if (!gameState) return [];
    return [...gameState.pastSeasons, gameState.currentSeason].sort(
      (a, b) => a.seasonNumber - b.seasonNumber
    );
  }, [gameState]);

  // Initialize selected teams to all teams on first load
  const teams = gameState?.teams ?? [];
  if (selectedTeamIds.size === 0 && teams.length > 0) {
    // Select top 5 teams by default (by current standings position)
    const topTeamIds = new Set(
      gameState?.currentSeason.constructorStandings
        .slice(0, 5)
        .map((s) => s.teamId) ?? []
    );
    if (topTeamIds.size > 0) {
      setSelectedTeamIds(topTeamIds);
    }
  }

  // Build chart data
  const chartData = useMemo(() => {
    return buildChartData(allSeasons, Array.from(selectedTeamIds), selectedStat);
  }, [allSeasons, selectedTeamIds, selectedStat]);

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

  const dropdownOptions = STAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  return (
    <div className="max-w-6xl space-y-6">
      {/* Controls row */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Statistic
          </label>
          <Dropdown
            options={dropdownOptions}
            value={selectedStat}
            onChange={setSelectedStat}
            className="w-64"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            View
          </label>
          <TabBar tabs={TAB_OPTIONS} activeTab={activeView} onTabChange={setActiveView} />
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Team selector - sidebar */}
        <div className="lg:col-span-1">
          <TeamSelector
            teams={teams}
            selectedTeamIds={selectedTeamIds}
            onToggleTeam={handleToggleTeam}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
          />
        </div>

        {/* Chart or Table - main area */}
        <div className="lg:col-span-3">
          {activeView === 'chart' ? (
            <div className="card p-4">
              {selectedTeamIds.size === 0 ? (
                <div className="h-80 flex items-center justify-center text-secondary">
                  Select at least one team to view the chart
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-700)" />
                    <XAxis
                      dataKey="season"
                      stroke="var(--neutral-500)"
                      tick={{ fill: 'var(--neutral-400)' }}
                      tickFormatter={(value) => `S${value}`}
                    />
                    <YAxis
                      stroke="var(--neutral-500)"
                      tick={{ fill: 'var(--neutral-400)' }}
                      reversed={statOption?.invertYAxis}
                      domain={statOption?.invertYAxis ? [1, 'auto'] : [0, 'auto']}
                    />
                    <Tooltip
                      content={<CustomTooltip teams={teams} stat={selectedStat} />}
                    />
                    <Legend
                      formatter={(value: string) => {
                        const team = teams.find((t) => t.id === value);
                        return team?.shortName ?? value;
                      }}
                    />
                    {Array.from(selectedTeamIds).map((teamId) => {
                      const team = teams.find((t) => t.id === teamId);
                      return (
                        <Line
                          key={teamId}
                          type="monotone"
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
              )}
            </div>
          ) : (
            <StatsTable
              seasons={allSeasons}
              teams={teams}
              selectedTeamIds={selectedTeamIds}
              stat={selectedStat}
            />
          )}
        </div>
      </div>

      {/* Info footer */}
      <div className="text-xs text-muted">
        Data from {allSeasons.length} season{allSeasons.length !== 1 ? 's' : ''} (Season{' '}
        {allSeasons[0]?.seasonNumber} - Season {allSeasons[allSeasons.length - 1]?.seasonNumber})
      </div>
    </div>
  );
}
