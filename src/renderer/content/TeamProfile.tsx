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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSalary(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `${(amount / 1_000).toFixed(0)}K`;
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

interface ProgressBarProps {
  value: number;
  colorClass?: string;
}

function getMoraleColor(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-yellow-500';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function ProgressBar({ value, colorClass }: ProgressBarProps) {
  const barColor = colorClass ?? getMoraleColor(value);
  return (
    <div className="flex-1 bg-gray-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${barColor}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
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
          Salary: ${formatSalary(driver.salary)}/yr | Contract: S{driver.contractEnd}
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
        Ability: {chief.ability} | Salary: ${formatSalary(chief.salary)}/yr
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
      <ProgressBar value={value} />
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  );
}

interface StaffSummaryProps {
  teamState: TeamRuntimeState;
}

function StaffSummary({ teamState }: StaffSummaryProps) {
  const departments = Object.keys(DEPARTMENT_LABELS) as Department[];

  return (
    <div className="space-y-2">
      {departments.map((dept) => {
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
        (Excellent/VeryGood/Good/Average/Trainee)
      </div>
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
        <h2 className="text-lg font-semibold text-white mb-3">Drivers</h2>
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
        <h2 className="text-lg font-semibold text-white mb-3">Department Chiefs</h2>
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
          <h2 className="text-lg font-semibold text-white mb-3">Department Morale</h2>
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            {(Object.keys(DEPARTMENT_LABELS) as Department[]).map((dept) => (
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
          <h2 className="text-lg font-semibold text-white mb-3">Staff</h2>
          <div className="bg-gray-800 rounded-lg p-4">
            <StaffSummary teamState={teamState} />
          </div>
        </div>
      )}

      {/* Development Testing Progress */}
      {teamState && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Development Testing</h2>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-400">Handling Knowledge:</span>
              <ProgressBar
                value={teamState.developmentTesting.handlingPercentage}
                colorClass="bg-blue-500"
              />
              <span className="text-sm text-white">
                {teamState.developmentTesting.handlingPercentage}%
              </span>
            </div>
            {teamState.developmentTesting.handlingProblemsFound.length > 0 && (
              <div className="text-xs text-gray-500">
                Problems found: {teamState.developmentTesting.handlingProblemsFound.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
