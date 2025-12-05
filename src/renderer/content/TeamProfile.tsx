import { useDerivedGameState } from '../hooks';
import { TeamBadge } from '../components/TeamBadge';
import type {
  Driver,
  Chief,
  TeamRuntimeState,
  Department,
  StaffQuality,
  ChiefRole,
  DriverRole,
} from '../../shared/domain';

const STAFF_QUALITY_ORDER: StaffQuality[] = [
  'excellent',
  'very-good',
  'good',
  'average',
  'trainee',
];

const DEPARTMENT_LABELS: Record<Department, string> = {
  commercial: 'Commercial',
  design: 'Design',
  engineering: 'Engineering',
  mechanics: 'Mechanics',
};

const DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as Department[];

const CHIEF_ROLE_LABELS: Record<ChiefRole, string> = {
  designer: 'Chief Designer',
  engineer: 'Chief Engineer',
  mechanic: 'Chief Mechanic',
  commercial: 'Commercial Director',
};

const DRIVER_ROLE_LABELS: Record<DriverRole, string> = {
  first: '1st Driver',
  second: '2nd Driver',
  equal: 'Driver',
  test: 'Test Driver',
};

const STAFF_QUALITY_LABELS: Record<StaffQuality, string> = {
  excellent: 'Excellent',
  'very-good': 'Very Good',
  good: 'Good',
  average: 'Average',
  trainee: 'Trainee',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `${(amount / 1_000).toFixed(0)}K`;
}

function formatAnnualSalary(amount: number): string {
  return `$${formatCompactAmount(amount)}/yr`;
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

interface SectionHeadingProps {
  children: React.ReactNode;
}

function SectionHeading({ children }: SectionHeadingProps) {
  return <h2 className="text-lg font-semibold text-white mb-3">{children}</h2>;
}

interface ProgressBarProps {
  value: number;
  colorClass: string;
}

function ProgressBar({ value, colorClass }: ProgressBarProps) {
  return (
    <div className="flex-1 bg-gray-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${colorClass}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

const MORALE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  LOW: 40,
} as const;

function getMoraleColor(value: number): string {
  if (value >= MORALE_THRESHOLDS.EXCELLENT) return 'bg-green-500';
  if (value >= MORALE_THRESHOLDS.GOOD) return 'bg-yellow-500';
  if (value >= MORALE_THRESHOLDS.LOW) return 'bg-orange-500';
  return 'bg-red-500';
}

interface DriverCardProps {
  driver: Driver;
}

function DriverCard({ driver }: DriverCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex gap-4">
      {/* Driver photo or placeholder */}
      <div className="w-16 h-20 bg-gray-700 rounded flex items-center justify-center text-gray-500 text-xs shrink-0">
        {driver.photoUrl ? (
          <img
            src={driver.photoUrl}
            alt={`${driver.firstName} ${driver.lastName}`}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          'No Photo'
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white">
          {driver.firstName} {driver.lastName}
        </div>
        <div className="text-sm text-gray-400">
          {DRIVER_ROLE_LABELS[driver.role] ?? driver.role}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {driver.nationality} | Rep: {driver.reputation}
        </div>
        <div className="text-xs text-gray-500">
          Salary: {formatAnnualSalary(driver.salary)} | Contract: S{driver.contractEnd}
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
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">
        {CHIEF_ROLE_LABELS[chief.role] ?? chief.role}
      </div>
      <div className="font-semibold text-white">
        {chief.firstName} {chief.lastName}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Ability: {chief.ability} | Salary: {formatAnnualSalary(chief.salary)}
      </div>
    </div>
  );
}

interface MoraleBarProps {
  label: string;
  value: number;
}

function MoraleBar({ label, value }: MoraleBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-24">{label}</span>
      <ProgressBar value={value} colorClass={getMoraleColor(value)} />
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  );
}

interface StaffSummaryProps {
  teamState: TeamRuntimeState;
}

function StaffSummary({ teamState }: StaffSummaryProps) {
  return (
    <div className="space-y-2">
      {DEPARTMENTS.map((dept) => {
        const counts = teamState.staffCounts[dept];
        const total = STAFF_QUALITY_ORDER.reduce(
          (sum, quality) => sum + (counts[quality] || 0),
          0
        );
        return (
          <div key={dept} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-24">{DEPARTMENT_LABELS[dept]}</span>
            <span className="text-xs text-white">{total} staff</span>
            <span className="text-xs text-gray-500">
              ({STAFF_QUALITY_ORDER.map((quality) => counts[quality] || 0).join('/')})
            </span>
          </div>
        );
      })}
      <div className="text-xs text-gray-600 mt-1">
        ({STAFF_QUALITY_ORDER.map((quality) => STAFF_QUALITY_LABELS[quality]).join('/')})
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
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-gray-400">Handling Knowledge:</span>
        <ProgressBar value={handlingPercentage} colorClass="bg-blue-500" />
        <span className="text-sm text-white">{handlingPercentage}%</span>
      </div>
      {handlingProblemsFound.length > 0 && (
        <div className="text-xs text-gray-500">
          Problems found: {handlingProblemsFound.join(', ')}
        </div>
      )}
    </div>
  );
}

export function TeamProfile() {
  const { gameState, playerTeam } = useDerivedGameState();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Loading team data...</p>
      </div>
    );
  }

  const teamDrivers = gameState.drivers.filter((d) => d.teamId === playerTeam.id);
  const teamChiefs = gameState.chiefs.filter((c) => c.teamId === playerTeam.id);
  const teamState = gameState.teamStates[playerTeam.id];

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="flex items-start gap-6">
        <TeamBadge team={playerTeam} className="w-24 h-20" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{playerTeam.name}</h1>
          <div className="text-gray-400">Principal: {playerTeam.principal}</div>
          <div className="text-gray-500 text-sm mt-2">{playerTeam.description}</div>
        </div>
      </div>

      {/* Team Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Budget" value={formatCurrency(playerTeam.budget)} />
        <StatCard label="Headquarters" value={playerTeam.headquarters} />
        <StatCard label="Factory Level" value={`${playerTeam.factoryLevel}/100`} />
        <StatCard label="Setup Points" value={teamState?.setupPoints ?? 0} />
      </div>

      {/* Drivers Section */}
      <div>
        <SectionHeading>Drivers</SectionHeading>
        {teamDrivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamDrivers.map((driver) => (
              <DriverCard key={driver.id} driver={driver} />
            ))}
          </div>
        ) : (
          <div className="text-gray-500">No drivers contracted</div>
        )}
      </div>

      {/* Chiefs Section */}
      <div>
        <SectionHeading>Department Chiefs</SectionHeading>
        {teamChiefs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamChiefs.map((chief) => (
              <ChiefCard key={chief.id} chief={chief} />
            ))}
          </div>
        ) : (
          <div className="text-gray-500">No chiefs assigned</div>
        )}
      </div>

      {/* Department Morale */}
      {teamState && (
        <div>
          <SectionHeading>Department Morale</SectionHeading>
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            {DEPARTMENTS.map((dept) => (
              <MoraleBar
                key={dept}
                label={DEPARTMENT_LABELS[dept]}
                value={teamState.morale[dept]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Staff Counts */}
      {teamState && (
        <div>
          <SectionHeading>Staff</SectionHeading>
          <div className="bg-gray-800 rounded-lg p-4">
            <StaffSummary teamState={teamState} />
          </div>
        </div>
      )}

      {/* Development Testing Progress */}
      {teamState && (
        <div>
          <SectionHeading>Development Testing</SectionHeading>
          <DevelopmentTestingSection teamState={teamState} />
        </div>
      )}
    </div>
  );
}
