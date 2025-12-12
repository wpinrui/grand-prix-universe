import { useDerivedGameState } from '../hooks';
import { SectionHeading, SummaryStat, DetailRow, ProgressBar } from '../components';
import {
  formatCurrency,
  DEPARTMENT_LABELS,
  CHIEF_ROLE_LABELS,
  STAFF_QUALITY_LABELS,
  DEPARTMENT_ORDER,
  STAFF_QUALITY_ORDER,
  CHIEF_ROLE_ORDER,
  ROLE_TO_DEPARTMENT,
  getFullName,
} from '../utils/format';
import { ACCENT_CARD_STYLE } from '../utils/theme-styles';
import {
  Department,
  StaffQuality,
  type Chief,
  type StaffCounts,
  type DepartmentMorale,
} from '../../shared/domain';

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/** Returns ability rating text based on 0-100 value */
function getAbilityLabel(ability: number): string {
  if (ability >= 90) return 'World Class';
  if (ability >= 75) return 'Excellent';
  if (ability >= 60) return 'Very Good';
  if (ability >= 45) return 'Good';
  if (ability >= 30) return 'Average';
  return 'Poor';
}

/** Total staff count for a department */
function getTotalStaff(counts: StaffCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

// ===========================================
// SECTION COMPONENTS
// ===========================================

interface ChiefCardProps {
  chief: Chief;
  departmentMorale: number;
}

function ChiefCard({ chief, departmentMorale }: ChiefCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
            {CHIEF_ROLE_LABELS[chief.role]}
          </div>
          <div className="text-lg font-semibold text-primary">
            {getFullName(chief)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Dept Morale</div>
          <ProgressBar value={departmentMorale} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <DetailRow label="Ability" value={getAbilityLabel(chief.ability)} />
        <DetailRow label="Salary" value={<span className="font-mono">{formatCurrency(chief.salary)}</span>} />
        <DetailRow label="Contract" value={`Season ${chief.contractEnd}`} />
      </div>
    </div>
  );
}

interface ChiefsSectionProps {
  chiefs: Chief[];
  morale: DepartmentMorale;
}

function ChiefsSection({ chiefs, morale }: ChiefsSectionProps) {
  const sortedChiefs = [...chiefs].sort(
    (a, b) => CHIEF_ROLE_ORDER.indexOf(a.role) - CHIEF_ROLE_ORDER.indexOf(b.role)
  );

  return (
    <section>
      <SectionHeading>Department Chiefs</SectionHeading>
      {sortedChiefs.length === 0 ? (
        <p className="text-muted">No chiefs employed</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {sortedChiefs.map((chief) => (
            <ChiefCard
              key={chief.id}
              chief={chief}
              departmentMorale={morale[ROLE_TO_DEPARTMENT[chief.role]]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface StaffRowProps {
  quality: StaffQuality;
  count: number;
}

function StaffRow({ quality, count }: StaffRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-secondary">{STAFF_QUALITY_LABELS[quality]}</span>
      <span className="font-mono text-primary">{count}</span>
    </div>
  );
}

interface DepartmentCardProps {
  department: Department;
  staffCounts: StaffCounts;
  morale: number;
}

function DepartmentCard({ department, staffCounts, morale }: DepartmentCardProps) {
  const total = getTotalStaff(staffCounts);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-muted uppercase tracking-wider">
          {DEPARTMENT_LABELS[department]}
        </div>
        <ProgressBar value={morale} />
      </div>

      <div className="space-y-1 mb-3">
        {STAFF_QUALITY_ORDER.map((quality) => (
          <StaffRow key={quality} quality={quality} count={staffCounts[quality]} />
        ))}
      </div>

      <div className="pt-2 border-t border-[var(--neutral-600)] flex items-center justify-between">
        <span className="text-sm font-semibold text-secondary">Total Staff</span>
        <span className="font-mono font-bold text-primary">{total}</span>
      </div>
    </div>
  );
}

interface DepartmentsSectionProps {
  staffCounts: Record<Department, StaffCounts>;
  morale: DepartmentMorale;
}

function DepartmentsSection({ staffCounts, morale }: DepartmentsSectionProps) {
  return (
    <section>
      <SectionHeading>Department Staff</SectionHeading>
      <div className="grid grid-cols-2 gap-4">
        {DEPARTMENT_ORDER.map((dept) => (
          <DepartmentCard
            key={dept}
            department={dept}
            staffCounts={staffCounts[dept]}
            morale={morale[dept]}
          />
        ))}
      </div>
    </section>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Staff() {
  const { gameState, playerTeam } = useDerivedGameState();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading staff data...</p>
      </div>
    );
  }

  const teamState = gameState.teamStates[playerTeam.id];
  const teamChiefs = gameState.chiefs.filter((c) => c.teamId === playerTeam.id);

  // Calculate totals
  const totalStaff = Object.values(teamState.staffCounts).reduce(
    (sum, counts) => sum + getTotalStaff(counts),
    0
  );
  const totalSalaries = teamChiefs.reduce((sum, c) => sum + c.salary, 0);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Summary Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-2 gap-8">
          <SummaryStat label="Total Staff" value={totalStaff} />
          <SummaryStat label="Chiefs Salary (Annual)" value={formatCurrency(totalSalaries)} />
        </div>
      </div>

      {/* Chiefs Section */}
      <ChiefsSection chiefs={teamChiefs} morale={teamState.morale} />

      {/* Departments Section */}
      <DepartmentsSection staffCounts={teamState.staffCounts} morale={teamState.morale} />
    </div>
  );
}
