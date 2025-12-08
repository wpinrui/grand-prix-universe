import { useDerivedGameState } from '../hooks';
import { SectionHeading, SummaryStat, DetailRow, ProgressBar } from '../components';
import { ACCENT_CARD_STYLE } from '../utils/theme-styles';
import { FacilityType, type Facility, type FactoryLimits, Department } from '../../shared/domain';

// ===========================================
// CONSTANTS
// ===========================================

const FACILITY_LABELS: Record<FacilityType, string> = {
  [FacilityType.WindTunnel]: 'Wind Tunnel',
  [FacilityType.CAD]: 'CAD System',
  [FacilityType.CAM]: 'CAM System',
  [FacilityType.Supercomputer]: 'Supercomputer',
  [FacilityType.Workshop]: 'Workshop',
  [FacilityType.TestRig]: 'Test Rig',
};

const FACILITY_DESCRIPTIONS: Record<FacilityType, string> = {
  [FacilityType.WindTunnel]: 'Required for chassis design stage 4',
  [FacilityType.CAD]: 'Speeds up chassis and upgrade design',
  [FacilityType.CAM]: 'Speeds up chassis and upgrade design',
  [FacilityType.Supercomputer]: 'Speeds up chassis and upgrade design',
  [FacilityType.Workshop]: 'Speeds up technology design',
  [FacilityType.TestRig]: 'Speeds up all testing programs',
};

const FACILITY_ORDER: FacilityType[] = [
  FacilityType.WindTunnel,
  FacilityType.CAD,
  FacilityType.CAM,
  FacilityType.Supercomputer,
  FacilityType.Workshop,
  FacilityType.TestRig,
];

const MAX_FACILITY_QUALITY = 5;
const TOTAL_FACILITY_TYPES = FACILITY_ORDER.length;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/** Get quality label from 0-5 value */
function getQualityLabel(quality: number): string {
  if (quality === 0) return 'Not Owned';
  if (quality === 1) return 'Basic';
  if (quality === 2) return 'Standard';
  if (quality === 3) return 'Good';
  if (quality === 4) return 'Advanced';
  return 'Elite';
}

/** Filter facilities to only owned (quality > 0) */
function getOwnedFacilities(facilities: Facility[]): Facility[] {
  return facilities.filter((f) => f.quality > 0);
}

/** Sum staff counts for a single department */
function sumDepartmentStaff(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/** Calculate total staff across all departments */
function getTotalStaff(staffCounts: Record<Department, Record<string, number>>): number {
  return Object.values(staffCounts).reduce(
    (total, deptCounts) => total + sumDepartmentStaff(deptCounts),
    0
  );
}

// ===========================================
// SECTION COMPONENTS
// ===========================================

interface FacilityCardProps {
  facility: Facility;
}

function FacilityCard({ facility }: FacilityCardProps) {
  const isOwned = facility.quality > 0;
  const qualityPercent = (facility.quality / MAX_FACILITY_QUALITY) * 100;

  return (
    <div className={`card p-4 ${!isOwned ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-primary">
            {FACILITY_LABELS[facility.type]}
          </div>
          <div className="text-xs text-muted mt-1">
            {FACILITY_DESCRIPTIONS[facility.type]}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-secondary">Quality</span>
          <span className={`text-xs font-medium ${isOwned ? 'text-primary' : 'text-muted'}`}>
            {getQualityLabel(facility.quality)}
          </span>
        </div>
        {isOwned && <ProgressBar value={qualityPercent} />}
      </div>
    </div>
  );
}

interface FacilitiesSectionProps {
  facilities: Facility[];
}

function FacilitiesSection({ facilities }: FacilitiesSectionProps) {
  const facilityMap = new Map(facilities.map((f) => [f.type, f]));
  const owned = getOwnedFacilities(facilities);
  const totalQuality = facilities.reduce((sum, f) => sum + f.quality, 0);
  const maxQuality = TOTAL_FACILITY_TYPES * MAX_FACILITY_QUALITY;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading>Facilities</SectionHeading>
        <div className="text-sm text-muted">
          {owned.length}/{TOTAL_FACILITY_TYPES} owned | {totalQuality}/{maxQuality} total quality
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {FACILITY_ORDER.map((type) => {
          const facility = facilityMap.get(type) ?? { type, quality: 0 };
          return <FacilityCard key={type} facility={facility} />;
        })}
      </div>
    </section>
  );
}

interface LimitCardProps {
  label: string;
  current: number;
  max: number;
}

function LimitCard({ label, current, max }: LimitCardProps) {
  const percent = Math.min(100, Math.round((current / max) * 100));

  return (
    <div>
      <DetailRow
        label={label}
        value={
          <span className="font-mono">
            {current} / {max}
          </span>
        }
      />
      <div className="mt-2">
        <ProgressBar value={percent} />
      </div>
    </div>
  );
}

interface LimitsSectionProps {
  limits: FactoryLimits;
  currentStaff: number;
  largestDepartmentSize: number;
  ownedFacilityCount: number;
}

function LimitsSection({ limits, currentStaff, largestDepartmentSize, ownedFacilityCount }: LimitsSectionProps) {
  return (
    <section>
      <SectionHeading>Factory Limits</SectionHeading>
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-6">
          <LimitCard label="Staff Capacity" current={currentStaff} max={limits.staffLimit} />
          <LimitCard label="Max per Department" current={largestDepartmentSize} max={limits.departmentLimit} />
          <LimitCard label="Facility Slots" current={ownedFacilityCount} max={limits.facilityLimit} />
        </div>
      </div>
    </section>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Factory() {
  const { gameState, playerTeam } = useDerivedGameState();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading factory data...</p>
      </div>
    );
  }

  const { factory } = playerTeam;
  const teamState = gameState.teamStates[playerTeam.id];

  // Calculate current staff usage
  const currentStaff = getTotalStaff(teamState.staffCounts);

  // Find largest department by staff count
  const largestDepartmentSize = Math.max(
    ...Object.values(teamState.staffCounts).map(sumDepartmentStaff)
  );

  // Summary stats
  const owned = getOwnedFacilities(factory.facilities);
  const avgQuality =
    owned.length > 0
      ? owned.reduce((sum, f) => sum + f.quality, 0) / owned.length
      : 0;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Summary Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-3 gap-8">
          <SummaryStat label="Facilities Owned" value={`${owned.length}/${TOTAL_FACILITY_TYPES}`} />
          <SummaryStat label="Avg Quality" value={avgQuality.toFixed(1)} />
          <SummaryStat label="Staff Capacity" value={factory.limits.staffLimit} />
        </div>
      </div>

      {/* Facilities Grid */}
      <FacilitiesSection facilities={factory.facilities} />

      {/* Limits Section */}
      <LimitsSection
        limits={factory.limits}
        currentStaff={currentStaff}
        largestDepartmentSize={largestDepartmentSize}
        ownedFacilityCount={owned.length}
      />
    </div>
  );
}
