/**
 * Driver profile content component.
 * Displays comprehensive driver information in FM24-inspired layout.
 * Used by WorldDrivers page.
 */
import { useMemo } from 'react';
import {
  PersonHeader,
  AttributeBar,
  StatPanel,
  StatRow,
  ContractPanel,
  type ContractRelationship,
} from './PersonProfileCards';
import { SectionHeading } from './SectionHeading';
import {
  DRIVER_ROLE_LABELS,
  formatOrdinal,
  pluralize,
  isHistoricalRetiredStatus,
  getHistoricalPositionStyle,
  getChampionshipPositionStyle,
} from '../utils/format';
import { seasonToYear, calculateAge } from '../../shared/utils/date-utils';
import {
  TABLE_HEADER_CLASS,
  TABLE_HEADER_ROW_CLASS,
  TABLE_BODY_CLASS,
} from '../utils/theme-styles';
import type { TeamColors } from '../utils/face-generator';
import type {
  Driver,
  DriverStanding,
  Team,
  DriverRuntimeState,
  SeasonData,
  RaceFinishStatus,
  CareerSeasonRecord,
} from '../../shared/domain';

// ===========================================
// ATTRIBUTE LABELS
// ===========================================

const ATTRIBUTE_LABELS: Record<keyof Driver['attributes'], string> = {
  pace: 'Pace',
  consistency: 'Consistency',
  focus: 'Focus',
  overtaking: 'Overtaking',
  wetWeather: 'Wet Weather',
  smoothness: 'Smoothness',
  defending: 'Defending',
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function formatDateOfBirth(dateOfBirth: string): string {
  const date = new Date(dateOfBirth);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ===========================================
// DRIVER ATTRIBUTES PANEL
// ===========================================

interface DriverAttributesPanelProps {
  attributes: Driver['attributes'];
}

function DriverAttributesPanel({ attributes }: DriverAttributesPanelProps) {
  const attributeEntries = Object.entries(attributes) as [keyof Driver['attributes'], number][];

  // Calculate overall rating (average)
  const overall = Math.round(
    attributeEntries.reduce((sum, [, val]) => sum + val, 0) / attributeEntries.length
  );

  return (
    <StatPanel title="Attributes">
      <div className="space-y-3">
        {attributeEntries.map(([key, value]) => (
          <AttributeBar key={key} label={ATTRIBUTE_LABELS[key]} value={value} />
        ))}
        <div className="border-t border-[var(--neutral-700)] pt-3 mt-3">
          <AttributeBar label="Overall" value={overall} />
        </div>
      </div>
    </StatPanel>
  );
}

// ===========================================
// SEASON STATS PANEL
// ===========================================

interface SeasonStatsPanelProps {
  standing: DriverStanding | undefined;
}

function SeasonStatsPanel({ standing }: SeasonStatsPanelProps) {
  if (!standing) {
    return (
      <StatPanel title="Season Stats">
        <p className="text-muted text-sm">No championship data available</p>
      </StatPanel>
    );
  }

  return (
    <StatPanel title="Season Stats">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <StatRow label="Position" value={formatOrdinal(standing.position)} />
        <StatRow label="Points" value={standing.points} />
        <StatRow label="Wins" value={standing.wins} />
        <StatRow label="Podiums" value={standing.podiums} />
        <StatRow label="Poles" value={standing.polePositions} />
        <StatRow label="Fastest Laps" value={standing.fastestLaps} />
        <StatRow label="DNFs" value={standing.dnfs} />
      </div>
    </StatPanel>
  );
}

// ===========================================
// COLOR UTILITIES
// ===========================================

/**
 * Get color class for percentage values.
 * Higher values are better by default. Pass inverted=true for values where lower is better (e.g., fatigue).
 */
function getPercentageColor(value: number, inverted = false): string {
  const effectiveValue = inverted ? 100 - value : value;
  if (effectiveValue >= 80) return 'text-emerald-400';
  if (effectiveValue >= 60) return 'text-lime-400';
  if (effectiveValue >= 40) return 'text-amber-400';
  if (effectiveValue >= 20) return 'text-orange-400';
  return 'text-red-400';
}

// ===========================================
// DRIVER STATE PANEL
// ===========================================

interface DriverStatePanelProps {
  driverState: DriverRuntimeState | undefined;
}

function DriverStatePanel({ driverState }: DriverStatePanelProps) {
  if (!driverState) {
    return (
      <StatPanel title="Driver Status">
        <p className="text-muted text-sm">No status data available</p>
      </StatPanel>
    );
  }

  return (
    <StatPanel title="Driver Status">
      <div className="space-y-2">
        <StatRow
          label="Morale"
          value={<span className={getPercentageColor(driverState.morale)}>{driverState.morale}%</span>}
        />
        <StatRow
          label="Fitness"
          value={
            <span className={getPercentageColor(driverState.fitness)}>{driverState.fitness}%</span>
          }
        />
        <StatRow
          label="Fatigue"
          value={
            <span className={getPercentageColor(driverState.fatigue, true)}>{driverState.fatigue}%</span>
          }
        />

        {/* Injury Status */}
        {driverState.injuryWeeksRemaining > 0 ? (
          <StatRow
            label="Injury"
            value={
              <span className="text-red-400">
                {pluralize(driverState.injuryWeeksRemaining, 'week')} out
              </span>
            }
          />
        ) : (
          <StatRow label="Injury" value={<span className="text-emerald-400">Healthy</span>} />
        )}

        {/* Ban Status */}
        {driverState.banRacesRemaining > 0 ? (
          <StatRow
            label="Ban"
            value={
              <span className="text-red-400">
                {pluralize(driverState.banRacesRemaining, 'race')} remaining
              </span>
            }
          />
        ) : (
          <StatRow label="Ban" value={<span className="text-emerald-400">None</span>} />
        )}

        {/* Angry Status */}
        {driverState.isAngry && (
          <StatRow label="Mood" value={<span className="text-red-400">Angry (refuses testing)</span>} />
        )}

        {/* Technical Penalties */}
        <div className="border-t border-[var(--neutral-700)] pt-2 mt-2">
          <StatRow label="Engine Units Used" value={driverState.engineUnitsUsed} />
          <StatRow label="Gearbox Race Count" value={driverState.gearboxRaceCount} />
        </div>
      </div>
    </StatPanel>
  );
}

// ===========================================
// FORM PANEL (RECENT RESULTS)
// ===========================================

export interface RecentRaceResult {
  raceNumber: number;
  circuitId: string;
  position: number | null;
  status: RaceFinishStatus;
  points: number;
}

interface FormPanelProps {
  recentResults: RecentRaceResult[];
}

function FormPanel({ recentResults }: FormPanelProps) {
  if (recentResults.length === 0) {
    return (
      <StatPanel title="Recent Form">
        <p className="text-muted text-sm">No race results yet this season</p>
      </StatPanel>
    );
  }

  const getPositionColor = (pos: number | null, status: RaceFinishStatus): string => {
    if (status !== 'finished' && status !== 'lapped') return 'text-red-400';
    if (pos === null) return 'text-muted';
    if (pos === 1) return 'text-amber-400';
    if (pos <= 3) return 'text-emerald-400';
    if (pos <= 10) return 'text-lime-400';
    return 'text-secondary';
  };

  const formatPosition = (pos: number | null, status: RaceFinishStatus): string => {
    if (status === 'retired') return 'DNF';
    if (status === 'disqualified') return 'DSQ';
    if (status === 'dns') return 'DNS';
    if (status === 'dnq') return 'DNQ';
    if (pos === null) return '-';
    return `P${pos}`;
  };

  // Show last 5 results
  const displayResults = recentResults.slice(-5).reverse();

  return (
    <StatPanel title="Recent Form">
      <div className="flex gap-2">
        {displayResults.map((result, index) => (
          <div
            key={index}
            className="flex-1 text-center py-2 px-1 rounded bg-[var(--neutral-800)]"
            title={`Race ${result.raceNumber}: ${result.points} pts`}
          >
            <div className={`font-bold ${getPositionColor(result.position, result.status)}`}>
              {formatPosition(result.position, result.status)}
            </div>
            <div className="text-xs text-muted mt-1">{result.points} pts</div>
          </div>
        ))}
      </div>
      {recentResults.length > 5 && (
        <p className="text-xs text-muted mt-2 text-center">
          Showing last 5 of {recentResults.length} races
        </p>
      )}
    </StatPanel>
  );
}

// ===========================================
// F1 CAREER HISTORY PANEL (REAL-WORLD DATA)
// ===========================================

interface F1CareerHistoryPanelProps {
  careerHistory: CareerSeasonRecord[] | undefined;
  teams: Team[];
}

function F1CareerHistoryPanel({ careerHistory, teams }: F1CareerHistoryPanelProps) {
  // Build team name lookup
  const teamNames = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  // Sort by season ascending (oldest first)
  const sortedHistory = useMemo(() => {
    if (!careerHistory || careerHistory.length === 0) return [];
    return [...careerHistory].sort((a, b) => a.season - b.season);
  }, [careerHistory]);

  // Find max races across all seasons for column count
  const maxRaces = useMemo(() => {
    return sortedHistory.reduce((max, s) => Math.max(max, s.races.length), 0);
  }, [sortedHistory]);

  if (!careerHistory || careerHistory.length === 0) {
    return null;
  }

  // Calculate career totals
  const totalRaces = sortedHistory.reduce((sum, s) => sum + s.races.length, 0);
  const totalPoints = sortedHistory.reduce((sum, s) => sum + s.totalPoints, 0);
  const totalWins = sortedHistory.reduce(
    (sum, s) => sum + s.races.filter((r) => r.position === 1).length,
    0
  );
  const totalPodiums = sortedHistory.reduce(
    (sum, s) => sum + s.races.filter((r) => r.position !== null && r.position <= 3).length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Career Totals Header */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Races', value: totalRaces },
          { label: 'Wins', value: totalWins, color: 'text-amber-400' },
          { label: 'Podiums', value: totalPodiums, color: 'text-emerald-400' },
          { label: 'Points', value: totalPoints.toFixed(0) },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <div className={`text-3xl font-bold tabular-nums ${color ?? 'text-primary'}`}>{value}</div>
            <div className="text-sm text-muted uppercase">{label}</div>
          </div>
        ))}
      </div>

      {/* Single Table with All Seasons */}
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead className={TABLE_HEADER_CLASS}>
            <tr className={TABLE_HEADER_ROW_CLASS}>
              <th className="w-[60px] px-3 py-2 text-left">Year</th>
              <th className="w-[140px] px-3 py-2 text-left">Team</th>
              {Array.from({ length: maxRaces }, (_, i) => (
                <th key={i} className="px-0.5 py-2 text-center">
                  <span className="text-xs text-muted">R{i + 1}</span>
                </th>
              ))}
              <th className="w-[50px] px-2 py-2 text-right">Pts</th>
              <th className="w-[60px] px-2 py-2 text-center">Pos</th>
            </tr>
          </thead>
          <tbody className={TABLE_BODY_CLASS}>
            {sortedHistory.map((season) => (
              <tr key={season.season} className="border-b border-[var(--neutral-700)]">
                <td className="px-3 py-2 font-bold text-primary">{season.season}</td>
                <td className="px-3 py-2 whitespace-nowrap text-secondary text-xs truncate">
                  {teamNames.get(season.teamId) ?? season.teamId}
                </td>
                {Array.from({ length: maxRaces }, (_, i) => {
                  const race = season.races.find((r) => r.round === i + 1);
                  if (!race) {
                    return <td key={i} className="px-0.5 py-1 text-center" />;
                  }
                  const isRetired = isHistoricalRetiredStatus(race.status);
                  return (
                    <td key={i} className="px-0.5 py-1 text-center">
                      <div
                        className={`h-6 text-xs rounded flex items-center justify-center ${getHistoricalPositionStyle(race.position, race.status)}`}
                        title={`${race.name}: ${isRetired ? 'Ret' : `P${race.position}`} - ${race.points} pts (${race.status})`}
                      >
                        {isRetired ? 'Ret' : race.position}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right font-bold tabular-nums">
                  {season.totalPoints}
                </td>
                <td className="px-2 py-1 text-center">
                  {season.championshipPosition ? (
                    <div
                      className={`h-6 text-xs rounded flex items-center justify-center ${getChampionshipPositionStyle(season.championshipPosition)}`}
                    >
                      {formatOrdinal(season.championshipPosition)}
                    </div>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================
// MAIN DRIVER PROFILE CONTENT
// ===========================================

interface DriverProfileContentProps {
  driver: Driver;
  team: Team | null;
  standing: DriverStanding | undefined;
  driverState: DriverRuntimeState | undefined;
  currentSeason: number;
  /** Recent race results for form display */
  recentResults: RecentRaceResult[];
  /** Relationship to the player's team */
  contractRelationship: ContractRelationship;
  /** Team colors for faces.js (if no photo) */
  teamColors?: TeamColors;
  /** Called when contract action button is clicked */
  onEnterContractTalks?: () => void;
  /** All drivers for dropdown selector */
  allDrivers?: Driver[];
  /** Called when driver selection changes */
  onDriverSelect?: (driverId: string) => void;
  /** All teams for F1 career history display */
  allTeams?: Team[];
}

export function DriverProfileContent({
  driver,
  team,
  standing,
  driverState,
  currentSeason,
  recentResults,
  contractRelationship,
  teamColors,
  onEnterContractTalks,
  allDrivers,
  onDriverSelect,
  allTeams,
}: DriverProfileContentProps) {
  const age = calculateAge(driver.dateOfBirth, seasonToYear(currentSeason));
  const fullName = `${driver.firstName} ${driver.lastName}`;

  // Build dropdown options if provided
  const dropdownOptions = allDrivers?.map((driverOption) => ({
    id: driverOption.id,
    label: `${driverOption.firstName} ${driverOption.lastName}`,
  }));

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <PersonHeader
        name={fullName}
        nationality={driver.nationality}
        photoUrl={driver.photoUrl}
        teamName={team?.name ?? null}
        teamId={team?.id ?? null}
        roleText={team ? DRIVER_ROLE_LABELS[driver.role] : 'Free Agent'}
        subtitle={`${age} years old · Born ${formatDateOfBirth(driver.dateOfBirth)}`}
        raceNumber={driver.raceNumber}
        personId={driver.id}
        teamColors={teamColors}
        allOptions={dropdownOptions}
        selectedId={driver.id}
        onSelect={onDriverSelect}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Attributes */}
        <div className="lg:col-span-2 space-y-6">
          <DriverAttributesPanel attributes={driver.attributes} />
        </div>

        {/* Right Column - Stats & Contract */}
        <div className="space-y-6">
          <ContractPanel
            salary={driver.salary}
            contractEndSeason={driver.contractEnd}
            currentSeason={currentSeason}
            relationship={contractRelationship}
            onEnterTalks={onEnterContractTalks}
          />

          <SeasonStatsPanel standing={standing} />
        </div>
      </div>

      {/* Status Section */}
      <SectionHeading>Status</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DriverStatePanel driverState={driverState} />
        <FormPanel recentResults={recentResults} />
      </div>

      {/* Career Results Section */}
      {driver.careerHistory && driver.careerHistory.length > 0 && (
        <>
          <SectionHeading>Career</SectionHeading>
          <F1CareerHistoryPanel careerHistory={driver.careerHistory} teams={allTeams ?? []} />
        </>
      )}
    </div>
  );
}

// ===========================================
// HELPER: EXTRACT DRIVER DATA FROM GAME STATE
// ===========================================

/**
 * Extract recent race results for a driver from season data
 */
export function extractRecentResults(
  driverId: string,
  seasonData: SeasonData
): RecentRaceResult[] {
  const results: RecentRaceResult[] = [];

  for (const entry of seasonData.calendar) {
    if (entry.completed && entry.result) {
      const driverResult = entry.result.race.find((r) => r.driverId === driverId);
      if (driverResult) {
        results.push({
          raceNumber: entry.raceNumber,
          circuitId: entry.circuitId,
          position: driverResult.finishPosition,
          status: driverResult.status,
          points: driverResult.points,
        });
      }
    }
  }

  return results;
}
