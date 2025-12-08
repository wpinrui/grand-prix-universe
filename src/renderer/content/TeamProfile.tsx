import type { CSSProperties } from 'react';
import { useDerivedGameState } from '../hooks';
import { TeamBadge } from '../components/TeamBadge';
import { SectionHeading } from '../components';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../utils/theme-styles';
import {
  formatCurrency,
  formatAnnualSalary,
  DRIVER_ROLE_LABELS,
  DEPARTMENT_LABELS,
  CHIEF_ROLE_LABELS,
  STAFF_QUALITY_LABELS,
  DEPARTMENT_ORDER,
  STAFF_QUALITY_ORDER,
} from '../utils/format';
import type {
  Driver,
  Chief,
  TeamRuntimeState,
} from '../../shared/domain';

const MORALE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  LOW: 40,
} as const;

// ===========================================
// FORMATTERS
// ===========================================

interface MoraleStyle {
  colorClass: string;
  glow: string;
}

const MORALE_STYLES = {
  excellent: { colorClass: 'bg-emerald-500', glow: '0 0 8px rgba(16, 185, 129, 0.5)' },
  good: { colorClass: 'bg-yellow-500', glow: '0 0 8px rgba(234, 179, 8, 0.5)' },
  low: { colorClass: 'bg-orange-500', glow: '0 0 8px rgba(249, 115, 22, 0.5)' },
  critical: { colorClass: 'bg-red-500', glow: '0 0 8px rgba(239, 68, 68, 0.5)' },
} as const;

function getMoraleStyle(value: number): MoraleStyle {
  if (value >= MORALE_THRESHOLDS.EXCELLENT) return MORALE_STYLES.excellent;
  if (value >= MORALE_THRESHOLDS.GOOD) return MORALE_STYLES.good;
  if (value >= MORALE_THRESHOLDS.LOW) return MORALE_STYLES.low;
  return MORALE_STYLES.critical;
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

interface ProgressBarProps {
  value: number;
  colorClass: string;
  glow?: string;
}

function ProgressBar({ value, colorClass, glow }: ProgressBarProps) {
  return (
    <div className="progress-track flex-1 h-2">
      <div
        className={`progress-fill h-2 ${colorClass}`}
        style={{
          width: `${value}%`,
          boxShadow: glow,
        }}
      />
    </div>
  );
}

// ===========================================
// DRIVER & CHIEF CARDS
// ===========================================

interface DriverCardProps {
  driver: Driver;
}

function DriverCard({ driver }: DriverCardProps) {
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
        <div className="font-bold text-primary">
          {driver.firstName} {driver.lastName}
        </div>
        <div className="text-sm font-medium text-secondary">
          {DRIVER_ROLE_LABELS[driver.role] ?? driver.role}
        </div>
        <div className="text-xs text-muted mt-2 space-y-0.5">
          <div>{driver.nationality} · Rep: {driver.reputation}</div>
          <div>Salary: {formatAnnualSalary(driver.salary)} · Contract: S{driver.contractEnd}</div>
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
      <div className="text-xs text-muted mt-2">
        Ability: {chief.ability} · {formatAnnualSalary(chief.salary)}
      </div>
    </div>
  );
}

// ===========================================
// MORALE & STAFF SECTIONS
// ===========================================

interface MoraleBarProps {
  label: string;
  value: number;
}

function MoraleBar({ label, value }: MoraleBarProps) {
  const { colorClass, glow } = getMoraleStyle(value);

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-secondary w-28">{label}</span>
      <ProgressBar value={value} colorClass={colorClass} glow={glow} />
      <span className="text-sm font-bold text-primary w-10 text-right tabular-nums">{value}</span>
    </div>
  );
}

interface StaffSummaryProps {
  teamState: TeamRuntimeState;
}

function StaffSummary({ teamState }: StaffSummaryProps) {
  return (
    <div className="space-y-3">
      {DEPARTMENT_ORDER.map((dept) => {
        const counts = teamState.staffCounts[dept];
        const total = STAFF_QUALITY_ORDER.reduce(
          (sum, quality) => sum + (counts[quality] || 0),
          0
        );
        return (
          <div key={dept} className="flex items-center gap-4">
            <span className="text-sm font-medium text-secondary w-28">{DEPARTMENT_LABELS[dept]}</span>
            <span className="text-base font-bold text-primary">{total}</span>
            <span className="text-sm text-muted">
              ({STAFF_QUALITY_ORDER.map((quality) => counts[quality] || 0).join('/')})
            </span>
          </div>
        );
      })}
      <div className="text-sm text-muted pt-3 border-t border-[var(--neutral-600)]">
        Quality breakdown: {STAFF_QUALITY_ORDER.map((q) => STAFF_QUALITY_LABELS[q]).join(' / ')}
      </div>
    </div>
  );
}

interface DevelopmentTestingSectionProps {
  teamState: TeamRuntimeState;
}

function DevelopmentTestingSection({ teamState }: DevelopmentTestingSectionProps) {
  const { handlingPercentage, handlingProblemsFound } = teamState.developmentTesting;

  return (
    <div className="card p-5" style={ACCENT_CARD_STYLE}>
      <div className="flex items-center gap-4 mb-2">
        <span className="text-base font-medium text-secondary">Handling Knowledge</span>
        <ProgressBar
          value={handlingPercentage}
          colorClass="bg-[var(--accent-500)]"
          glow="0 0 8px color-mix(in srgb, var(--accent-500) 50%, transparent)"
        />
        <span className="text-base font-bold tabular-nums" style={ACCENT_TEXT_STYLE}>
          {handlingPercentage}%
        </span>
      </div>
      {handlingProblemsFound.length > 0 && (
        <div className="text-sm text-muted">
          Problems found: {handlingProblemsFound.join(', ')}
        </div>
      )}
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
  const teamState = gameState.teamStates[playerTeam.id];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Team Header */}
      <div className="flex items-start gap-6">
        <TeamBadge team={playerTeam} className="w-24 h-20" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            {playerTeam.name}
          </h1>
          <div className="text-secondary font-medium mt-1">
            Principal: {playerTeam.principal}
          </div>
          <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">
            {playerTeam.description}
          </p>
        </div>
      </div>

      {/* Team Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Budget" value={formatCurrency(playerTeam.budget)} accent />
        <StatCard label="Headquarters" value={playerTeam.headquarters} />
        <StatCard label="Factory Level" value={`${playerTeam.factoryLevel}/100`} />
        <StatCard label="Setup Points" value={teamState?.setupPoints ?? 0} />
      </div>

      {/* Drivers Section */}
      <section>
        <SectionHeading>Drivers</SectionHeading>
        {teamDrivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamDrivers.map((driver) => (
              <DriverCard key={driver.id} driver={driver} />
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

      {/* Department Morale */}
      {teamState && (
        <section>
          <SectionHeading>Department Morale</SectionHeading>
          <div className="card p-5 space-y-3">
            {DEPARTMENT_ORDER.map((dept) => (
              <MoraleBar
                key={dept}
                label={DEPARTMENT_LABELS[dept]}
                value={teamState.morale[dept]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Staff Counts */}
      {teamState && (
        <section>
          <SectionHeading>Staff</SectionHeading>
          <div className="card p-5">
            <StaffSummary teamState={teamState} />
          </div>
        </section>
      )}

      {/* Development Testing Progress */}
      {teamState && (
        <section>
          <SectionHeading>Development Testing</SectionHeading>
          <DevelopmentTestingSection teamState={teamState} />
        </section>
      )}
    </div>
  );
}
