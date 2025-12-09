import type { CSSProperties } from 'react';
import { useDerivedGameState } from '../hooks';
import { TeamBadge } from '../components/TeamBadge';
import { FlagIcon } from '../components/FlagIcon';
import { SectionHeading } from '../components';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../utils/theme-styles';
import {
  formatCurrency,
  formatAnnualSalary,
  DRIVER_ROLE_LABELS,
  CHIEF_ROLE_LABELS,
} from '../utils/format';
import type {
  Driver,
  Chief,
  DriverStanding,
} from '../../shared/domain';
import { seasonToYear } from '../../shared/utils/date-utils';

// ===========================================
// FORMATTERS
// ===========================================

function formatOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

function formatContractEnd(seasonNumber: number): string {
  const year = seasonToYear(seasonNumber);
  return `31 Dec ${year}`;
}

// ===========================================
// SHARED COMPONENTS
// ===========================================

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}

function StatCard({ label, value, accent = false }: StatCardProps) {
  const cardStyle: CSSProperties = accent ? ACCENT_CARD_STYLE : {};
  const valueStyle: CSSProperties = accent ? ACCENT_TEXT_STYLE : {};

  return (
    <div
      className="card p-5"
      style={cardStyle}
    >
      <div className="text-sm font-medium text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className="text-xl font-bold text-primary"
        style={valueStyle}
      >
        {value}
      </div>
    </div>
  );
}

// ===========================================
// DRIVER & CHIEF CARDS
// ===========================================

function MiniStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="text-muted">
      <span className="font-medium text-secondary">{value}</span>
      <span className="ml-1">{label}</span>
    </div>
  );
}

interface DriverCardProps {
  driver: Driver;
  standing: DriverStanding | undefined;
}

function DriverCard({ driver, standing }: DriverCardProps) {
  return (
    <div className="card p-4 flex gap-4">
      {/* Driver photo or placeholder */}
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
        {/* Championship Stats */}
        <div className="flex gap-4 mt-2 text-xs">
          <MiniStat value={standing ? formatOrdinal(standing.position) : '-'} label="" />
          <MiniStat value={standing?.points ?? 0} label="Pts" />
          <MiniStat value={standing?.wins ?? 0} label="Wins" />
        </div>
        {/* Contract Info */}
        <div className="text-xs text-muted mt-1">
          {formatAnnualSalary(driver.salary)} · Contract ends {formatContractEnd(driver.contractEnd)}
        </div>
      </div>
    </div>
  );
}

interface ChiefCardProps {
  chief: Chief;
}

function ChiefCard({ chief }: ChiefCardProps) {
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
        <div>{formatAnnualSalary(chief.salary)} · Contract ends {formatContractEnd(chief.contractEnd)}</div>
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function TeamProfile() {
  const { gameState, playerTeam } = useDerivedGameState();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading team data...</p>
      </div>
    );
  }

  const teamDrivers = gameState.drivers.filter((driver) => driver.teamId === playerTeam.id);
  const teamChiefs = gameState.chiefs.filter((chief) => chief.teamId === playerTeam.id);

  // Get championship standings
  const constructorStanding = gameState.currentSeason.constructorStandings.find(
    (s) => s.teamId === playerTeam.id
  );
  const driverStandingsMap = new Map<string, DriverStanding>(
    gameState.currentSeason.driverStandings.map((s) => [s.driverId, s])
  );

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Team Header */}
      <div className="flex items-start gap-6">
        <TeamBadge team={playerTeam} className="w-24 h-20" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            {playerTeam.name}
          </h1>
          <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">
            {playerTeam.description}
          </p>
        </div>
        {/* Location with Flag */}
        <div className="flex items-center gap-2 text-secondary">
          <FlagIcon country={playerTeam.headquarters} size="md" />
          <span className="font-medium">{playerTeam.headquarters}</span>
        </div>
      </div>

      {/* Team Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Budget" value={formatCurrency(playerTeam.budget)} accent />
        <StatCard label="Championship" value={constructorStanding ? `P${constructorStanding.position}` : '-'} />
        <StatCard label="Points" value={constructorStanding?.points ?? 0} />
        <StatCard label="Wins" value={constructorStanding?.wins ?? 0} />
      </div>

      {/* Drivers Section */}
      <section>
        <SectionHeading>Drivers</SectionHeading>
        {teamDrivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                standing={driverStandingsMap.get(driver.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted">No drivers contracted</p>
        )}
      </section>

      {/* Chiefs Section */}
      <section>
        <SectionHeading>Department Chiefs</SectionHeading>
        {teamChiefs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamChiefs.map((chief) => (
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
