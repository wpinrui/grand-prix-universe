/**
 * Shared card components for displaying team profile information.
 * Used by both TeamProfile (player's team) and WorldTeams (any team).
 */
import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { FlagIcon } from './FlagIcon';
import { TeamBadge } from './TeamBadge';
import { SectionHeading } from './SectionHeading';
import { EntityLink } from './EntityLink';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../utils/theme-styles';
import {
  formatCurrency,
  formatOrdinal,
  formatContractLine,
  DRIVER_ROLE_LABELS,
  CHIEF_ROLE_LABELS,
  getFullName,
} from '../utils/format';
import type { Team, Driver, Chief, DriverStanding, ConstructorStanding } from '../../shared/domain';

// ===========================================
// STAT DISPLAY COMPONENTS
// ===========================================

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}

export function StatCard({ label, value, accent = false }: StatCardProps) {
  const cardStyle: CSSProperties = accent ? ACCENT_CARD_STYLE : {};
  const valueStyle: CSSProperties = accent ? ACCENT_TEXT_STYLE : {};

  return (
    <div className="card p-5" style={cardStyle}>
      <div className="text-sm font-medium text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-xl font-bold text-primary" style={valueStyle}>
        {value}
      </div>
    </div>
  );
}

interface MiniStatProps {
  value: React.ReactNode;
  label?: string;
}

export function MiniStat({ value, label }: MiniStatProps) {
  return (
    <div className="text-muted">
      <span className="font-medium text-secondary">{value}</span>
      {label && <span className="ml-1">{label}</span>}
    </div>
  );
}

// ===========================================
// TEAM STATS GRID
// ===========================================

interface TeamStatsGridProps {
  budget: number;
  standing: ConstructorStanding | undefined;
}

export function TeamStatsGrid({ budget, standing }: TeamStatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Budget" value={formatCurrency(budget)} accent />
      <StatCard label="Championship" value={standing ? `P${standing.position}` : '-'} />
      <StatCard label="Points" value={standing?.points ?? 0} />
      <StatCard label="Wins" value={standing?.wins ?? 0} />
    </div>
  );
}

// ===========================================
// DRIVER & CHIEF CARDS
// ===========================================

interface DriverCardProps {
  driver: Driver;
  standing: DriverStanding | undefined;
}

export function DriverCard({ driver, standing }: DriverCardProps) {
  return (
    <div className="card p-4 flex gap-4">
      <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0 surface-inset flex items-center justify-center">
        {driver.photoUrl ? (
          <img
            src={driver.photoUrl}
            alt={getFullName(driver)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs text-muted">No Photo</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <EntityLink type="driver" id={driver.id} className="font-bold">
            {getFullName(driver)}
          </EntityLink>
          <FlagIcon country={driver.nationality} size="sm" />
        </div>
        <div className="text-sm font-medium text-secondary">
          {DRIVER_ROLE_LABELS[driver.role] ?? driver.role}
        </div>
        <div className="flex gap-4 mt-2 text-xs">
          <MiniStat value={standing ? formatOrdinal(standing.position) : '-'} />
          <MiniStat value={standing?.points ?? 0} label="Pts" />
          <MiniStat value={standing?.wins ?? 0} label="Wins" />
        </div>
        <div className="text-xs text-muted mt-1">
          {formatContractLine(driver.salary, driver.contractEnd)}
        </div>
      </div>
    </div>
  );
}

interface ChiefCardProps {
  chief: Chief;
}

export function ChiefCard({ chief }: ChiefCardProps) {
  return (
    <div className="card p-3">
      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
        {CHIEF_ROLE_LABELS[chief.role] ?? chief.role}
      </div>
      <EntityLink type="chief" id={chief.id} className="font-bold block">
        {getFullName(chief)}
      </EntityLink>
      <div className="text-xs text-muted mt-2 space-y-0.5">
        <div>Ability: {chief.ability}</div>
        <div>{formatContractLine(chief.salary, chief.contractEnd)}</div>
      </div>
    </div>
  );
}

// ===========================================
// TEAM HEADER
// ===========================================

/** Returns class names for team dropdown option based on selection state */
const getTeamOptionClasses = (isSelected: boolean) =>
  `px-4 py-2 cursor-pointer transition-colors hover:bg-[var(--neutral-700)] ${
    isSelected ? 'text-[var(--accent-400)]' : 'text-primary'
  }`;

interface TeamHeaderProps {
  team: Team;
  /** All teams available for selection in the dropdown */
  allTeams?: Team[];
  /** Called when a team is selected from the dropdown */
  onTeamSelect?: (teamId: string) => void;
  /** Override principal name (e.g., player's name for their own team) */
  principalName?: string;
  /** Whether this is the player's team (links to player wiki instead of principal profile) */
  isPlayerTeam?: boolean;
  /** Principal ID for linking to their profile (for non-player teams) */
  principalId?: string;
}

export function TeamHeader({ team, allTeams, onTeamSelect, principalName, isPlayerTeam, principalId }: TeamHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsDropdownOpen((prev) => !prev);

  const handleTeamClick = (teamId: string) => {
    setIsDropdownOpen(false);
    onTeamSelect?.(teamId);
  };

  const showDropdown = allTeams && allTeams.length > 0 && onTeamSelect;

  return (
    <div className="flex items-start gap-6">
      <TeamBadge team={team} className="w-20" />
      <div className="flex-1">
        <div className="relative inline-flex items-center gap-2" ref={dropdownRef}>
          <h1
            className={`text-2xl font-bold text-primary tracking-tight ${
              showDropdown ? 'cursor-pointer hover:text-[var(--accent-400)] transition-colors' : ''
            }`}
            onClick={showDropdown ? toggleDropdown : undefined}
          >
            {team.name}
          </h1>
          {showDropdown && (
            <>
              <button
                type="button"
                onClick={toggleDropdown}
                className="p-1 text-muted hover:text-primary cursor-pointer transition-colors"
                title="Select team"
              >
                <svg
                  className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isDropdownOpen && (
                <ul className="absolute top-full left-0 mt-1 z-50 min-w-64 max-h-80 overflow-auto surface-primary border border-subtle rounded-lg shadow-lg py-1">
                  {allTeams.map((t) => (
                    <li
                      key={t.id}
                      onClick={() => handleTeamClick(t.id)}
                      className={getTeamOptionClasses(t.id === team.id)}
                    >
                      {t.name}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        {(principalName || team.principal) && (
          <p className="text-sm text-secondary mt-1">
            Principal:{' '}
            {isPlayerTeam ? (
              <EntityLink type="player-wiki" id="" className="text-sm">
                {principalName}
              </EntityLink>
            ) : principalId ? (
              <EntityLink type="principal" id={principalId} className="text-sm">
                {principalName ?? team.principal}
              </EntityLink>
            ) : (
              principalName ?? team.principal
            )}
          </p>
        )}
        <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">{team.description}</p>
      </div>
      <div className="flex items-center gap-2 text-secondary">
        <FlagIcon country={team.headquarters} size="md" />
        <span className="font-medium">{team.headquarters}</span>
      </div>
    </div>
  );
}

// ===========================================
// TEAM PROFILE CONTENT (FULL LAYOUT)
// ===========================================

interface TeamProfileContentProps {
  team: Team;
  drivers: Driver[];
  chiefs: Chief[];
  constructorStanding: ConstructorStanding | undefined;
  driverStandingsMap: Map<string, DriverStanding>;
  /** All teams available for selection in the dropdown */
  allTeams?: Team[];
  /** Called when a team is selected from the dropdown */
  onTeamSelect?: (teamId: string) => void;
  /** Override principal name (e.g., player's name for their own team) */
  principalName?: string;
  /** Whether this is the player's team (links to player wiki instead of principal profile) */
  isPlayerTeam?: boolean;
  /** Principal ID for linking to their profile (for non-player teams) */
  principalId?: string;
}

export function TeamProfileContent({
  team,
  drivers,
  chiefs,
  constructorStanding,
  driverStandingsMap,
  allTeams,
  onTeamSelect,
  principalName,
  isPlayerTeam,
  principalId,
}: TeamProfileContentProps) {
  return (
    <div className="space-y-8">
      <TeamHeader
        team={team}
        allTeams={allTeams}
        onTeamSelect={onTeamSelect}
        principalName={principalName}
        isPlayerTeam={isPlayerTeam}
        principalId={principalId}
      />

      <TeamStatsGrid budget={team.budget} standing={constructorStanding} />

      {/* Drivers Section */}
      <section>
        <SectionHeading>Drivers</SectionHeading>
        {drivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drivers.map((driver) => (
              <DriverCard key={driver.id} driver={driver} standing={driverStandingsMap.get(driver.id)} />
            ))}
          </div>
        ) : (
          <p className="text-muted">No drivers contracted</p>
        )}
      </section>

      {/* Chiefs Section */}
      <section>
        <SectionHeading>Department Chiefs</SectionHeading>
        {chiefs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {chiefs.map((chief) => (
              <ChiefCard key={chief.id} chief={chief} />
            ))}
          </div>
        ) : (
          <p className="text-muted">No chiefs assigned</p>
        )}
      </section>
    </div>
  );
}
