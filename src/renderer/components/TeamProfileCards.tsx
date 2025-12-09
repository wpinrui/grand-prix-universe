/**
 * Shared card components for displaying team profile information.
 * Used by both TeamProfile (player's team) and WorldTeams (any team).
 */
import type { CSSProperties } from 'react';
import { FlagIcon } from './FlagIcon';
import { TeamBadge } from './TeamBadge';
import { SectionHeading } from './SectionHeading';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../utils/theme-styles';
import {
  formatCurrency,
  formatOrdinal,
  formatContractLine,
  DRIVER_ROLE_LABELS,
  CHIEF_ROLE_LABELS,
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
            alt={`${driver.firstName} ${driver.lastName}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs text-muted">No Photo</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-primary">
            {driver.firstName} {driver.lastName}
          </span>
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
      <div className="font-bold text-primary">
        {chief.firstName} {chief.lastName}
      </div>
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

interface TeamHeaderProps {
  team: Team;
}

export function TeamHeader({ team }: TeamHeaderProps) {
  return (
    <div className="flex items-start gap-6">
      <TeamBadge team={team} className="w-24 h-20" />
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-primary tracking-tight">{team.name}</h1>
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
}

export function TeamProfileContent({
  team,
  drivers,
  chiefs,
  constructorStanding,
  driverStandingsMap,
}: TeamProfileContentProps) {
  return (
    <div className="space-y-8">
      <TeamHeader team={team} />

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
