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

/** Calculate total staff across all departments */
function getTotalStaff(staffCounts: Record<Department, Record<string, number>>): number {
  return Object.values(staffCounts).reduce(
    (total, deptCounts) => total + Object.values(deptCounts).reduce((sum, count) => sum + count, 0),
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
  const qualityPercent = (facility.quality / 5) * 100;

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
  const ownedCount = facilities.filter((f) => f.quality > 0).length;
  const totalQuality = facilities.reduce((sum, f) => sum + f.quality, 0);
  const maxQuality = facilities.length * 5;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading>Facilities</SectionHeading>
        <div className="text-sm text-muted">
          {ownedCount}/6 owned | {totalQuality}/{maxQuality} total quality
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

interface LimitsSectionProps {
  limits: FactoryLimits;
  currentStaff: number;
  currentDeptMax: number;
}

function LimitsSection({ limits, currentStaff, currentDeptMax }: LimitsSectionProps) {
  return (
    <section>
      <SectionHeading>Factory Limits</SectionHeading>
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <DetailRow
              label="Staff Capacity"
              value={
                <span className="font-mono">
                  {currentStaff} / {limits.staffLimit}
                </span>
              }
            />
            <div className="mt-2">
              <ProgressBar value={(currentStaff / limits.staffLimit) * 100} />
            </div>
          </div>

          <div>
            <DetailRow
              label="Max per Department"
              value={
                <span className="font-mono">
                  {currentDeptMax} / {limits.departmentLimit}
                </span>
              }
            />
            <div className="mt-2">
              <ProgressBar value={(currentDeptMax / limits.departmentLimit) * 100} />
            </div>
          </div>

          <div>
            <DetailRow
              label="Facility Slots"
              value={<span className="font-mono">6 / {limits.facilityLimit}</span>}
            />
            <div className="mt-2">
              <ProgressBar value={(6 / limits.facilityLimit) * 100} />
            </div>
          </div>
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

  // Find max staff in any department
  const currentDeptMax = Math.max(
    ...Object.values(teamState.staffCounts).map((counts) =>
      Object.values(counts).reduce((sum, count) => sum + count, 0)
    )
  );

  // Summary stats
  const ownedFacilities = factory.facilities.filter((f) => f.quality > 0).length;
  const avgQuality =
    ownedFacilities > 0
      ? factory.facilities
          .filter((f) => f.quality > 0)
          .reduce((sum, f) => sum + f.quality, 0) / ownedFacilities
      : 0;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Summary Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-3 gap-8">
          <SummaryStat label="Facilities Owned" value={`${ownedFacilities}/6`} />
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
        currentDeptMax={currentDeptMax}
      />
    </div>
  );
}
