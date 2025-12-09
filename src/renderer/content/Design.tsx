import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDerivedGameState, queryKeys } from '../hooks';
import { SectionHeading, ProgressBar, TabBar } from '../components';
import type { Tab } from '../components';
import { GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';
import { IpcChannels } from '../../shared/ipc';
import {
  ChassisDesignStage,
  TechnologyComponent,
  HandlingProblem,
  type ChassisDesign,
  type TechnologyLevel,
  type CurrentYearChassisState,
  type DesignState,
  type GameState,
} from '../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type DesignTab = 'summary' | 'next-year' | 'current-year' | 'technology';

// ===========================================
// CONSTANTS
// ===========================================

function getTabs(currentYear: number): Tab<DesignTab>[] {
  return [
    { id: 'summary', label: 'Summary' },
    { id: 'next-year', label: `${currentYear + 1} Chassis` },
    { id: 'current-year', label: `${currentYear} Chassis` },
    { id: 'technology', label: 'Technology' },
  ];
}

const STAGE_LABELS: Record<ChassisDesignStage, string> = {
  [ChassisDesignStage.Design]: 'Design',
  [ChassisDesignStage.CFD]: 'CFD',
  [ChassisDesignStage.Model]: 'Model',
  [ChassisDesignStage.WindTunnel]: 'Wind Tunnel',
};

const STAGE_ORDER: ChassisDesignStage[] = [
  ChassisDesignStage.Design,
  ChassisDesignStage.CFD,
  ChassisDesignStage.Model,
  ChassisDesignStage.WindTunnel,
];

const TECH_LABELS: Record<TechnologyComponent, string> = {
  [TechnologyComponent.Brakes]: 'Brakes',
  [TechnologyComponent.Clutch]: 'Clutch',
  [TechnologyComponent.Electronics]: 'Electronics',
  [TechnologyComponent.Gearbox]: 'Gearbox',
  [TechnologyComponent.Hydraulics]: 'Hydraulics',
  [TechnologyComponent.Suspension]: 'Suspension',
  [TechnologyComponent.Throttle]: 'Throttle',
};

const TECH_ORDER: TechnologyComponent[] = [
  TechnologyComponent.Brakes,
  TechnologyComponent.Clutch,
  TechnologyComponent.Electronics,
  TechnologyComponent.Gearbox,
  TechnologyComponent.Hydraulics,
  TechnologyComponent.Suspension,
  TechnologyComponent.Throttle,
];

const MAX_STAGE_PROGRESS = 10;
const MAX_TECH_LEVEL = 5;
const MAX_SOLUTION_PROGRESS = 10;
const LEVEL_INDICES = [1, 2, 3, 4, 5] as const;
const HANDLING_REVEALED_PER_TEST_LEVEL = 20; // Each test level reveals 20% handling
const ALLOCATION_STEP = 10; // Increment/decrement step for designer allocation

const PROBLEM_LABELS: Record<HandlingProblem, string> = {
  [HandlingProblem.OversteerFast]: 'Oversteer (Fast)',
  [HandlingProblem.OversteerSlow]: 'Oversteer (Slow)',
  [HandlingProblem.UndersteerFast]: 'Understeer (Fast)',
  [HandlingProblem.UndersteerSlow]: 'Understeer (Slow)',
  [HandlingProblem.HighDrag]: 'High Drag',
  [HandlingProblem.PoorBalance]: 'Poor Balance',
  [HandlingProblem.LowDownforce]: 'Low Downforce',
  [HandlingProblem.HighPitchSensitivity]: 'High Pitch Sensitivity',
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function getChassisOverallProgress(chassis: ChassisDesign): number {
  if (chassis.stages.length === 0) return 0;
  const totalProgress = chassis.stages.reduce((sum, s) => sum + s.progress, 0);
  const maxProgress = chassis.stages.length * MAX_STAGE_PROGRESS;
  return Math.round((totalProgress / maxProgress) * 100);
}

function getCurrentStageName(chassis: ChassisDesign): string {
  for (const stage of STAGE_ORDER) {
    const stageProgress = chassis.stages.find((s) => s.stage === stage);
    if (stageProgress && !stageProgress.completed) {
      return STAGE_LABELS[stage];
    }
  }
  return 'Complete';
}

interface AllocationBreakdown {
  nextYear: number;
  currentYear: number;
  technology: number;
  available: number;
}

function calculateAllocationBreakdown(designState: DesignState): AllocationBreakdown {
  const nextYear = designState.nextYearChassis?.designersAssigned ?? 0;
  const currentYear = designState.currentYearChassis.designersAssigned;
  const technology = designState.activeTechnologyProject?.designersAssigned ?? 0;
  const available = 100 - nextYear - currentYear - technology;
  return { nextYear, currentYear, technology, available };
}

// ===========================================
// SHARED COMPONENTS
// ===========================================

interface LevelBarProps {
  value: number;
  compact?: boolean;
}

function LevelBar({ value, compact = false }: LevelBarProps) {
  return (
    <div className={`flex ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {LEVEL_INDICES.map((i) => (
        <div
          key={i}
          className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${
            i <= value ? 'bg-amber-500' : 'bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

// ===========================================
// TAB VIEWS
// ===========================================

// ===========================================
// SUMMARY TAB COMPONENTS
// ===========================================

interface AllocationRowProps {
  label: string;
  value: number;
  isHighlighted?: boolean;
}

function AllocationRow({ label, value, isHighlighted = false }: AllocationRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${isHighlighted ? 'text-amber-400' : 'text-secondary'}`}>
        {label}
      </span>
      <span className="text-sm font-mono text-primary">{value}%</span>
    </div>
  );
}

interface SummaryTabProps {
  designState: DesignState;
  currentYear: number;
}

function SummaryTab({ designState, currentYear }: SummaryTabProps) {
  const levelMap = new Map(designState.technologyLevels.map((l) => [l.component, l]));
  const discoveredCount = designState.currentYearChassis.problems.filter((p) => p.discovered).length;
  const nextYearProgress = designState.nextYearChassis
    ? getChassisOverallProgress(designState.nextYearChassis)
    : 0;

  const allocation = calculateAllocationBreakdown(designState);

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left Column: Designer Allocation + Technology Grid */}
      <div className="space-y-4">
        {/* Designer Allocation Panel */}
        <div className="card p-4">
          <SectionHeading>Designer Allocation</SectionHeading>
          <div className="mt-4 space-y-2">
            <AllocationRow label="Available" value={allocation.available} isHighlighted />
            <AllocationRow label={`${currentYear + 1} Chassis`} value={allocation.nextYear} />
            <AllocationRow label={`${currentYear} Chassis`} value={allocation.currentYear} />
            <AllocationRow label="Technology" value={allocation.technology} />
          </div>
        </div>

        {/* Technology Grid */}
        <div className="card p-4">
          <SectionHeading>Technology</SectionHeading>
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-muted text-xs">
                <th className="text-left py-1"></th>
                <th className="text-center py-1">Performance</th>
                <th className="text-center py-1">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {TECH_ORDER.map((component) => {
                const level = levelMap.get(component);
                return (
                  <tr key={component}>
                    <td className="py-1.5 text-secondary">{TECH_LABELS[component]}</td>
                    <td className="py-1.5">
                      <div className="flex justify-center">
                        <LevelBar value={level?.performance ?? 1} compact />
                      </div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex justify-center">
                        <LevelBar value={level?.reliability ?? 1} compact />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: Chassis Info Panels */}
      <div className="space-y-4">
        {/* Current Year Chassis */}
        <div className="card p-4">
          <SectionHeading>{currentYear} Chassis</SectionHeading>
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-muted text-xs">
                <th className="text-left py-1">Name</th>
                <th className="text-center py-1">Handling</th>
                <th className="text-center py-1">Project</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1.5 text-secondary">SA{currentYear}-A</td>
                <td className="py-1.5 text-center font-mono text-primary">
                  {designState.currentYearChassis.handlingRevealed > 0
                    ? `${designState.currentYearChassis.handlingRevealed}%`
                    : '?'}
                </td>
                <td className="py-1.5 text-center text-secondary">
                  {discoveredCount > 0 ? `${discoveredCount} problems` : '---'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Next Year Chassis */}
        <div className="card p-4">
          <SectionHeading>{currentYear + 1} Chassis</SectionHeading>
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-muted text-xs">
                <th className="text-left py-1">Name</th>
                <th className="text-center py-1">Stage</th>
                <th className="text-center py-1">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1.5 text-secondary">SA{currentYear + 1}-A</td>
                <td className="py-1.5 text-center text-secondary">
                  {designState.nextYearChassis
                    ? getCurrentStageName(designState.nextYearChassis)
                    : 'Not started'}
                </td>
                <td className="py-1.5 text-center font-mono text-primary">
                  {designState.nextYearChassis ? `${nextYearProgress}%` : '0%'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// NEXT YEAR CHASSIS TAB COMPONENTS
// ===========================================

interface DesignerAllocationPanelProps {
  availableAllocation: number;
  chassisAllocation: number;
  maxAllocation: number;
  label: string;
  onAllocationChange?: (newValue: number) => void;
}

function DesignerAllocationPanel({
  availableAllocation,
  chassisAllocation,
  maxAllocation,
  label,
  onAllocationChange,
}: DesignerAllocationPanelProps) {
  return (
    <div className="card p-4">
      <SectionHeading>Designer</SectionHeading>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-amber-400">Available</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-primary">{availableAllocation}%</span>
            <div className="w-24 h-2 bg-[var(--neutral-700)] rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${availableAllocation}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-secondary">{label}</span>
          <div className="flex items-center gap-2">
            {onAllocationChange ? (
              <AllocationControl
                value={chassisAllocation}
                maxValue={maxAllocation}
                onChange={onAllocationChange}
              />
            ) : (
              <>
                <span className="text-sm font-mono text-primary">{chassisAllocation}%</span>
                <div className="w-24 h-2 bg-[var(--neutral-700)] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${chassisAllocation}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChassisInfoPanelProps {
  chassisName: string;
  stageName: string;
  efficiency: number;
}

function ChassisInfoPanel({ chassisName, stageName, efficiency }: ChassisInfoPanelProps) {
  return (
    <div className="card p-4">
      <SectionHeading>{chassisName}</SectionHeading>
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Stage</span>
          <span className="text-secondary">{stageName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Efficiency</span>
          <span className="text-primary font-mono">{efficiency}%</span>
        </div>
      </div>
    </div>
  );
}

interface AllocationControlProps {
  value: number;
  maxValue: number;
  onChange: (newValue: number) => void;
}

function AllocationControl({ value, maxValue, onChange }: AllocationControlProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - ALLOCATION_STEP))}
        className="w-6 h-6 rounded bg-[var(--neutral-700)] text-secondary hover:bg-[var(--neutral-600)] cursor-pointer"
      >
        −
      </button>
      <span className="font-mono text-primary w-8 text-center">{value}%</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(maxValue, value + ALLOCATION_STEP))}
        className="w-6 h-6 rounded bg-[var(--neutral-700)] text-secondary hover:bg-[var(--neutral-600)] cursor-pointer"
      >
        +
      </button>
    </div>
  );
}

interface NextYearChassisTabProps {
  chassis: ChassisDesign | null;
  currentYear: number;
  designState: DesignState;
  onStartWork: () => void;
  onAllocationChange: (allocation: number) => void;
}

function NextYearChassisTab({
  chassis,
  currentYear,
  designState,
  onStartWork,
  onAllocationChange,
}: NextYearChassisTabProps) {
  const allocation = calculateAllocationBreakdown(designState);
  // Max allocation = current allocation + available (what's not used by other projects)
  const maxNextYearAllocation = allocation.nextYear + allocation.available;

  const chassisLabel = `${currentYear + 1} Chassis`;
  const chassisName = `Chassis ${currentYear + 1}-A`;

  // Not started state
  if (!chassis) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <DesignerAllocationPanel
            availableAllocation={allocation.available}
            chassisAllocation={0}
            maxAllocation={maxNextYearAllocation}
            label={chassisLabel}
          />
          <ChassisInfoPanel chassisName={chassisName} stageName="Not Started" efficiency={0} />
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <SectionHeading>{chassisLabel} Design</SectionHeading>
            <span className="text-sm text-muted">0%</span>
          </div>

          <div className="text-center py-8">
            <p className="text-muted mb-4">
              No chassis design in progress for {currentYear + 1} season.
            </p>
            <button
              type="button"
              onClick={onStartWork}
              className={`btn px-4 py-2 text-sm font-medium rounded-lg border cursor-pointer ${GHOST_BORDERED_BUTTON_CLASSES}`}
            >
              Start Work
            </button>
          </div>
        </div>
      </div>
    );
  }

  const overallProgress = getChassisOverallProgress(chassis);
  const stageMap = new Map(chassis.stages.map((s) => [s.stage, s]));
  const currentStageName = getCurrentStageName(chassis);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <DesignerAllocationPanel
          availableAllocation={allocation.available}
          chassisAllocation={allocation.nextYear}
          maxAllocation={maxNextYearAllocation}
          label={chassisLabel}
          onAllocationChange={onAllocationChange}
        />
        <ChassisInfoPanel
          chassisName={chassisName}
          stageName={currentStageName}
          efficiency={chassis.efficiencyRating}
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <SectionHeading>{chassisLabel} Design</SectionHeading>
          <span className="text-sm text-muted">{overallProgress}%</span>
        </div>

        <div className="mb-4">
          <ProgressBar value={overallProgress} />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs border-b border-subtle">
              <th className="text-left py-2 w-32">Stage</th>
              <th className="text-center py-2">Progress</th>
              <th className="text-center py-2 w-16">Done</th>
            </tr>
          </thead>
          <tbody>
            {STAGE_ORDER.map((stage) => {
              const stageProgress = stageMap.get(stage);
              const progress = stageProgress?.progress ?? 0;
              const completed = stageProgress?.completed ?? false;
              const stagePercent = (progress / MAX_STAGE_PROGRESS) * 100;

              return (
                <tr key={stage} className="border-b border-subtle last:border-0">
                  <td className="py-3 text-secondary">{STAGE_LABELS[stage]}</td>
                  <td className="py-3 px-4">
                    <div className="w-full h-2 bg-[var(--neutral-700)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${completed ? 'bg-green-500' : 'bg-amber-500'} transition-all`}
                        style={{ width: `${stagePercent}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    {completed ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-muted">○</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            className={`btn px-4 py-2 text-sm font-medium rounded-lg border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${GHOST_BORDERED_BUTTON_CLASSES}`}
            disabled={overallProgress < 100}
          >
            Build Chassis
          </button>
        </div>
      </div>
    </div>
  );
}

interface CurrentYearChassisTabProps {
  chassisState: CurrentYearChassisState;
  currentYear: number;
  designState: DesignState;
}

function CurrentYearChassisTab({ chassisState, currentYear, designState }: CurrentYearChassisTabProps) {
  const problemMap = new Map(chassisState.problems.map((p) => [p.problem, p]));

  // Find the active problem being worked on, or first discovered unsolved problem
  const activeProblem = chassisState.activeDesignProblem;
  const activeProblemState = activeProblem ? problemMap.get(activeProblem) : undefined;

  // Determine problem/solution display text
  const problemText = activeProblem ? PROBLEM_LABELS[activeProblem] : 'Unknown';
  const solutionText = activeProblemState?.solutionDesigned
    ? 'Ready to Build'
    : activeProblemState?.solutionProgress
      ? `${activeProblemState.solutionProgress}/${MAX_SOLUTION_PROGRESS}`
      : '---';

  const allocation = calculateAllocationBreakdown(designState);
  const chassisLabel = `${currentYear} Chassis`;
  // Max allocation = current allocation + available (what's not used by other projects)
  const maxCurrentYearAllocation = allocation.currentYear + allocation.available;

  return (
    <div className="space-y-6">
      {/* Top Section: Designer Allocation + Chassis Info */}
      <div className="grid grid-cols-2 gap-6">
        <DesignerAllocationPanel
          availableAllocation={allocation.available}
          chassisAllocation={allocation.currentYear}
          maxAllocation={maxCurrentYearAllocation}
          label={chassisLabel}
        />

        {/* Chassis Info Panel */}
        <div className="card p-4">
          <SectionHeading>Chassis {currentYear}-A</SectionHeading>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Tests</span>
              <LevelBar value={Math.ceil(chassisState.handlingRevealed / HANDLING_REVEALED_PER_TEST_LEVEL)} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Handling</span>
              <span className="text-primary font-mono">
                {chassisState.handlingRevealed > 0 ? `${chassisState.handlingRevealed}%` : '?'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Problem</span>
              <span className="text-secondary">{problemText}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Solution</span>
              <span className="text-secondary">{solutionText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Improvement Project Section */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <SectionHeading>{currentYear} Chassis</SectionHeading>
          <span className="text-sm text-muted">
            {activeProblem ? `Fixing: ${PROBLEM_LABELS[activeProblem]}` : 'No Project'}
          </span>
        </div>

        {/* No Problem Discovered - Redirect to Testing */}
        {!activeProblem && (
          <div className="text-center py-8">
            <p className="text-muted mb-4">
              No handling problems discovered yet. Run development tests to find issues with the chassis.
            </p>
            <p className="text-sm text-secondary">
              Go to <span className="text-amber-400">Testing</span> → Development Testing to discover problems.
            </p>
          </div>
        )}

        {/* Start Work Button - only show when problem exists */}
        {activeProblem && (
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              className={`btn px-4 py-2 text-sm font-medium rounded-lg border cursor-pointer ${GHOST_BORDERED_BUTTON_CLASSES}`}
            >
              Start Work
            </button>
          </div>
        )}

        {/* 4-Stage Table - only show when problem exists */}
        {activeProblem && (
        <>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs border-b border-subtle">
              <th className="text-left py-2 w-32">Stage</th>
              <th className="text-center py-2">Progress</th>
              <th className="text-center py-2 w-16">Done</th>
            </tr>
          </thead>
          <tbody>
            {STAGE_ORDER.map((stage, stageIndex) => {
              // For current year chassis improvements, we track via solutionProgress
              // Each stage is 0-10 progress (similar to next year chassis)
              const progressPerStage = MAX_SOLUTION_PROGRESS / STAGE_ORDER.length;
              const stageProgress = activeProblemState
                ? Math.max(0, Math.min(progressPerStage, activeProblemState.solutionProgress - stageIndex * progressPerStage))
                : 0;
              const stageComplete = stageProgress >= progressPerStage;
              const stagePercent = (stageProgress / progressPerStage) * 100;

              return (
                <tr key={stage} className="border-b border-subtle last:border-0">
                  <td className="py-3 text-secondary">{STAGE_LABELS[stage]}</td>
                  <td className="py-3 px-4">
                    <div className="w-full h-2 bg-[var(--neutral-700)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stageComplete ? 'bg-green-500' : 'bg-amber-500'} transition-all`}
                        style={{ width: `${stagePercent}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    {stageComplete ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-muted">○</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Build Component Button */}
        <div className="flex justify-end mt-4">
          <button
            type="button"
            className={`btn px-4 py-2 text-sm font-medium rounded-lg border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${GHOST_BORDERED_BUTTON_CLASSES}`}
            disabled={!activeProblemState?.solutionDesigned}
          >
            Build Component
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

interface TechnologyTabProps {
  levels: TechnologyLevel[];
}

function TechnologyTab({ levels }: TechnologyTabProps) {
  const levelMap = new Map(levels.map((l) => [l.component, l]));

  return (
    <div className="grid grid-cols-4 gap-4">
      {TECH_ORDER.map((component) => {
        const level = levelMap.get(component);
        const perf = level?.performance ?? 1;
        const rel = level?.reliability ?? 1;

        return (
          <div key={component} className="card p-4">
            <div className="text-sm font-semibold text-primary mb-4">
              {TECH_LABELS[component]}
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-muted mb-2">
                  <span>Performance</span>
                  <span className="font-mono">{perf}/{MAX_TECH_LEVEL}</span>
                </div>
                <LevelBar value={perf} />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted mb-2">
                  <span>Reliability</span>
                  <span className="font-mono">{rel}/{MAX_TECH_LEVEL}</span>
                </div>
                <LevelBar value={rel} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Design() {
  const [activeTab, setActiveTab] = useState<DesignTab>('summary');
  const { gameState, playerTeam } = useDerivedGameState();
  const queryClient = useQueryClient();

  const handleStartNextYearChassis = useCallback(async () => {
    const newState = await window.electronAPI.invoke(IpcChannels.DESIGN_START_NEXT_YEAR);
    queryClient.setQueryData<GameState | null>(queryKeys.gameState, newState);
  }, [queryClient]);

  const handleSetNextYearAllocation = useCallback(
    async (allocation: number) => {
      const newState = await window.electronAPI.invoke(
        IpcChannels.DESIGN_SET_NEXT_YEAR_ALLOCATION,
        allocation
      );
      queryClient.setQueryData<GameState | null>(queryKeys.gameState, newState);
    },
    [queryClient]
  );

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading design data...</p>
      </div>
    );
  }

  const teamState = gameState.teamStates[playerTeam.id];
  const designState = teamState.designState;
  const currentYear = gameState.currentDate.year;

  return (
    <div>
      <TabBar tabs={getTabs(currentYear)} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'summary' && (
        <SummaryTab designState={designState} currentYear={currentYear} />
      )}
      {activeTab === 'next-year' && (
        <NextYearChassisTab
          chassis={designState.nextYearChassis}
          currentYear={currentYear}
          designState={designState}
          onStartWork={handleStartNextYearChassis}
          onAllocationChange={handleSetNextYearAllocation}
        />
      )}
      {activeTab === 'current-year' && (
        <CurrentYearChassisTab
          chassisState={designState.currentYearChassis}
          currentYear={currentYear}
          designState={designState}
        />
      )}
      {activeTab === 'technology' && <TechnologyTab levels={designState.technologyLevels} />}
    </div>
  );
}
