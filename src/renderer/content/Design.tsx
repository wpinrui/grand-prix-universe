import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDerivedGameState, useRegulationsBySeason, queryKeys } from '../hooks';
import { SectionHeading, ProgressBar, TabBar } from '../components';
import type { Tab } from '../components';
import { GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';
import { IpcChannels } from '../../shared/ipc';
import {
  ChassisDesignStage,
  TechnologyComponent,
  TechnologyAttribute,
  TechnologyProjectPhase,
  HandlingProblem,
  Department,
  type ChassisDesign,
  type TechnologyDesignProject,
  type CurrentYearChassisState,
  type DesignState,
  type GameState,
  type StaffCounts,
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
    { id: 'current-year', label: `${currentYear} Chassis` },
    { id: 'next-year', label: `${currentYear + 1} Chassis` },
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
const MAX_TECH_LEVEL = 100;
const MAX_SOLUTION_PROGRESS = 10;
const LEVEL_BAR_BOXES = 10; // Number of boxes in LevelBar visualization
const LEVEL_BAR_STEP = MAX_TECH_LEVEL / LEVEL_BAR_BOXES; // 10 points per box
/** Calculate allocation step as 100/N where N is number of designers */
function getDesignerCount(staffCounts: StaffCounts): number {
  return Object.values(staffCounts).reduce((sum, count) => sum + count, 0);
}

function getAllocationStep(designerCount: number): number {
  if (designerCount <= 0) return 10; // Fallback
  return Math.round(100 / designerCount);
}

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
  const technology = designState.activeTechnologyProjects.reduce(
    (sum, project) => sum + project.designersAssigned,
    0
  );
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

/**
 * Visual bar showing a 0-100 value as 10 discrete boxes
 * Each box represents 10 points. Value 0 shows no boxes filled.
 */
function LevelBar({ value, compact = false }: LevelBarProps) {
  // Convert 0-100 value to 0-10 filled boxes
  const filledBoxes = Math.min(LEVEL_BAR_BOXES, Math.ceil(value / LEVEL_BAR_STEP));

  return (
    <div className={`flex ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {Array.from({ length: LEVEL_BAR_BOXES }, (_, i) => (
        <div
          key={i}
          className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${
            i < filledBoxes ? 'bg-amber-500' : 'bg-gray-700'
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
                        <LevelBar value={level?.performance ?? 0} compact />
                      </div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex justify-center">
                        <LevelBar value={level?.reliability ?? 0} compact />
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
  step: number;
  onAllocationChange?: (newValue: number) => void;
}

function DesignerAllocationPanel({
  availableAllocation,
  chassisAllocation,
  maxAllocation,
  label,
  step,
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
                step={step}
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
  step: number;
  onChange: (newValue: number) => void;
}

function AllocationControl({ value, maxValue, step, onChange }: AllocationControlProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - step))}
        className="w-6 h-6 rounded bg-[var(--neutral-700)] text-secondary hover:bg-[var(--neutral-600)] cursor-pointer"
      >
        −
      </button>
      <span className="font-mono text-primary w-8 text-center">{value}%</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(maxValue, value + step))}
        className="w-6 h-6 rounded bg-[var(--neutral-700)] text-secondary hover:bg-[var(--neutral-600)] cursor-pointer"
      >
        +
      </button>
    </div>
  );
}

interface RegulationsBadgeProps {
  year: number;
  available: boolean;
}

function RegulationsBadge({ year, available }: RegulationsBadgeProps) {
  if (available) {
    return (
      <span className="px-2 py-1 text-xs font-medium rounded bg-emerald-900/50 text-emerald-400 border border-emerald-700">
        {year} Regulations
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs font-medium rounded bg-amber-900/50 text-amber-400 border border-amber-700">
      Awaiting {year} Regulations
    </span>
  );
}

interface NextYearChassisTabProps {
  chassis: ChassisDesign | null;
  currentYear: number;
  designState: DesignState;
  regulationsAvailable: boolean;
  allocationStep: number;
  onStartWork: () => void;
  onAllocationChange: (allocation: number) => void;
}

function NextYearChassisTab({
  chassis,
  currentYear,
  designState,
  regulationsAvailable,
  allocationStep,
  onStartWork,
  onAllocationChange,
}: NextYearChassisTabProps) {
  const allocation = calculateAllocationBreakdown(designState);
  // Max allocation = current allocation + available (what's not used by other projects)
  const maxNextYearAllocation = allocation.nextYear + allocation.available;

  const chassisLabel = `${currentYear + 1} Chassis`;
  const chassisName = `Chassis ${currentYear + 1}-A`;
  const nextYear = currentYear + 1;

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
            step={allocationStep}
          />
          <ChassisInfoPanel chassisName={chassisName} stageName="Not Started" efficiency={0} />
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <SectionHeading>{chassisLabel} Design</SectionHeading>
            <RegulationsBadge year={nextYear} available={regulationsAvailable} />
          </div>

          <div className="text-center py-8">
            {regulationsAvailable ? (
              <>
                <p className="text-muted mb-4">
                  No chassis design in progress for {nextYear} season.
                </p>
                <button
                  type="button"
                  onClick={onStartWork}
                  className={`btn px-4 py-2 text-sm font-medium rounded-lg border cursor-pointer ${GHOST_BORDERED_BUTTON_CLASSES}`}
                >
                  Start Work
                </button>
              </>
            ) : (
              <p className="text-muted">
                Waiting for FIA to publish {nextYear} regulations before design work can begin.
              </p>
            )}
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
          step={allocationStep}
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
          <div className="flex items-center gap-3">
            <SectionHeading>{chassisLabel} Design</SectionHeading>
            <RegulationsBadge year={nextYear} available={regulationsAvailable} />
          </div>
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
  allocationStep: number;
}

function CurrentYearChassisTab({
  chassisState,
  currentYear,
  designState,
  allocationStep,
}: CurrentYearChassisTabProps) {
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
          step={allocationStep}
        />

        {/* Chassis Info Panel */}
        <div className="card p-4">
          <SectionHeading>Chassis {currentYear}-A</SectionHeading>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Tests</span>
              <LevelBar value={chassisState.handlingRevealed} />
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
  designState: DesignState;
  allocationStep: number;
  onToggleProject: (
    component: TechnologyComponent,
    attribute: TechnologyAttribute,
    isActive: boolean
  ) => void;
  onSetAllocation: (
    component: TechnologyComponent,
    attribute: TechnologyAttribute,
    allocation: number
  ) => void;
}

const PHASE_LABELS: Record<TechnologyProjectPhase, string> = {
  [TechnologyProjectPhase.Discovery]: 'Brainstorming',
  [TechnologyProjectPhase.Development]: 'Development',
};

function getProjectStatus(project: TechnologyDesignProject | undefined): string {
  if (!project) return '---';
  if (project.phase === TechnologyProjectPhase.Discovery) {
    return PHASE_LABELS[project.phase];
  }
  // Development phase - show progress percentage and payoff
  const progress =
    project.workUnitsRequired && project.workUnitsRequired > 0
      ? Math.round((project.workUnitsCompleted / project.workUnitsRequired) * 100)
      : 0;
  const payoffText = project.payoff ? ` (+${project.payoff})` : '';
  return `Dev ${progress}%${payoffText}`;
}

interface TechAttributeCellProps {
  level: number;
  project: TechnologyDesignProject | undefined;
  onToggleWork: () => void;
  maxAllocation: number;
  step: number;
  onAllocationChange: (value: number) => void;
}

function TechAttributeCell({
  level,
  project,
  onToggleWork,
  maxAllocation,
  step,
  onAllocationChange,
}: TechAttributeCellProps) {
  const isWorking = !!project;
  const allocation = project?.designersAssigned ?? 0;

  return (
    <>
      {/* Level */}
      <td className="py-2 text-center font-mono text-primary w-14">{level}</td>
      {/* Work checkbox */}
      <td className="py-2 text-center w-12">
        <input
          type="checkbox"
          checked={isWorking}
          onChange={onToggleWork}
          className="w-4 h-4 cursor-pointer accent-amber-500"
        />
      </td>
      {/* Status */}
      <td className="py-2 text-center text-secondary text-xs w-28">{getProjectStatus(project)}</td>
      {/* Allocation */}
      <td className="py-2 w-24">
        {isWorking ? (
          <AllocationControl
            value={allocation}
            maxValue={maxAllocation}
            step={step}
            onChange={onAllocationChange}
          />
        ) : (
          <span className="text-muted text-center block">---</span>
        )}
      </td>
    </>
  );
}

function TechnologyTab({
  designState,
  allocationStep,
  onToggleProject,
  onSetAllocation,
}: TechnologyTabProps) {
  const levelMap = new Map(designState.technologyLevels.map((l) => [l.component, l]));

  // Create a map of active projects by component+attribute key
  const projectMap = new Map<string, TechnologyDesignProject>();
  for (const project of designState.activeTechnologyProjects) {
    const key = `${project.component}-${project.attribute}`;
    projectMap.set(key, project);
  }

  const allocation = calculateAllocationBreakdown(designState);
  const totalTechAllocation = designState.activeTechnologyProjects.reduce(
    (sum, p) => sum + p.designersAssigned,
    0
  );

  return (
    <div className="space-y-6">
      {/* Designer Allocation Summary */}
      <div className="card p-4">
        <SectionHeading>Designer Allocation</SectionHeading>
        <div className="mt-4 space-y-2">
          <AllocationRow label="Available" value={allocation.available} isHighlighted />
          <AllocationRow label="Technology Total" value={totalTechAllocation} />
        </div>
      </div>

      {/* Technology Components Table */}
      <div className="card p-4">
        <SectionHeading>Technology Components</SectionHeading>
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-muted text-xs border-b border-subtle">
              <th className="text-left py-2 w-28">Component</th>
              <th className="text-center py-2 w-14" colSpan={4}>
                Performance
              </th>
              <th className="text-center py-2 w-14" colSpan={4}>
                Reliability
              </th>
            </tr>
            <tr className="text-muted text-xs border-b border-subtle">
              <th></th>
              <th className="text-center py-1 w-14">Lvl</th>
              <th className="text-center py-1 w-12">Work</th>
              <th className="text-center py-1 w-28">Status</th>
              <th className="text-center py-1 w-24">Alloc</th>
              <th className="text-center py-1 w-14">Lvl</th>
              <th className="text-center py-1 w-12">Work</th>
              <th className="text-center py-1 w-28">Status</th>
              <th className="text-center py-1 w-24">Alloc</th>
            </tr>
          </thead>
          <tbody>
            {TECH_ORDER.map((component) => {
              const level = levelMap.get(component);
              const perfLevel = level?.performance ?? 0;
              const relLevel = level?.reliability ?? 0;

              const perfKey = `${component}-${TechnologyAttribute.Performance}`;
              const relKey = `${component}-${TechnologyAttribute.Reliability}`;
              const perfProject = projectMap.get(perfKey);
              const relProject = projectMap.get(relKey);

              // Max allocation = current project allocation + available
              const maxPerfAlloc = (perfProject?.designersAssigned ?? 0) + allocation.available;
              const maxRelAlloc = (relProject?.designersAssigned ?? 0) + allocation.available;

              return (
                <tr key={component} className="border-b border-subtle last:border-0">
                  <td className="py-2 text-secondary">{TECH_LABELS[component]}</td>
                  <TechAttributeCell
                    level={perfLevel}
                    project={perfProject}
                    onToggleWork={() =>
                      onToggleProject(component, TechnologyAttribute.Performance, !!perfProject)
                    }
                    maxAllocation={maxPerfAlloc}
                    step={allocationStep}
                    onAllocationChange={(val) =>
                      onSetAllocation(component, TechnologyAttribute.Performance, val)
                    }
                  />
                  <TechAttributeCell
                    level={relLevel}
                    project={relProject}
                    onToggleWork={() =>
                      onToggleProject(component, TechnologyAttribute.Reliability, !!relProject)
                    }
                    maxAllocation={maxRelAlloc}
                    step={allocationStep}
                    onAllocationChange={(val) =>
                      onSetAllocation(component, TechnologyAttribute.Reliability, val)
                    }
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

  // Query next year's regulations (hook enabled only when we know the year)
  const nextYear = gameState?.currentDate.year ? gameState.currentDate.year + 1 : 0;
  const { data: nextYearRegulations } = useRegulationsBySeason(nextYear);
  const regulationsAvailable = nextYearRegulations !== null && nextYearRegulations !== undefined;

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

  const handleToggleTechProject = useCallback(
    async (component: TechnologyComponent, attribute: TechnologyAttribute, isActive: boolean) => {
      const channel = isActive
        ? IpcChannels.DESIGN_CANCEL_TECH_PROJECT
        : IpcChannels.DESIGN_START_TECH_PROJECT;
      const newState = await window.electronAPI.invoke(channel, { component, attribute });
      queryClient.setQueryData<GameState | null>(queryKeys.gameState, newState);
    },
    [queryClient]
  );

  const handleSetTechAllocation = useCallback(
    async (component: TechnologyComponent, attribute: TechnologyAttribute, allocation: number) => {
      const newState = await window.electronAPI.invoke(IpcChannels.DESIGN_SET_TECH_ALLOCATION, {
        component,
        attribute,
        allocation,
      });
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

  // Get designer staff counts and calculate allocation step
  const designerStaffCounts = teamState.staffCounts[Department.Design];
  const designerCount = getDesignerCount(designerStaffCounts);
  const allocationStep = getAllocationStep(designerCount);

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
          regulationsAvailable={regulationsAvailable}
          allocationStep={allocationStep}
          onStartWork={handleStartNextYearChassis}
          onAllocationChange={handleSetNextYearAllocation}
        />
      )}
      {activeTab === 'current-year' && (
        <CurrentYearChassisTab
          chassisState={designState.currentYearChassis}
          currentYear={currentYear}
          designState={designState}
          allocationStep={allocationStep}
        />
      )}
      {activeTab === 'technology' && (
        <TechnologyTab
          designState={designState}
          allocationStep={allocationStep}
          onToggleProject={handleToggleTechProject}
          onSetAllocation={handleSetTechAllocation}
        />
      )}
    </div>
  );
}
