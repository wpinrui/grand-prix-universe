import { useState } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, ProgressBar, TabBar } from '../components';
import type { Tab } from '../components';
import {
  ChassisDesignStage,
  TechnologyComponent,
  HandlingProblem,
  type ChassisDesign,
  type TechnologyLevel,
  type CurrentYearChassisState,
  type HandlingProblemState,
  type DesignState,
} from '../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type DesignTab = 'summary' | 'next-year' | 'current-year' | 'technology';

// ===========================================
// CONSTANTS
// ===========================================

const TABS: Tab<DesignTab>[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'next-year', label: 'Next Year Chassis' },
  { id: 'current-year', label: 'Current Year Chassis' },
  { id: 'technology', label: 'Technology' },
];

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

const PROBLEM_DESCRIPTIONS: Record<HandlingProblem, string> = {
  [HandlingProblem.OversteerFast]: 'Less grip on high-speed circuits',
  [HandlingProblem.OversteerSlow]: 'Less grip on low-speed circuits',
  [HandlingProblem.UndersteerFast]: 'Increased tyre wear on high-speed circuits',
  [HandlingProblem.UndersteerSlow]: 'Increased tyre wear on low-speed circuits',
  [HandlingProblem.HighDrag]: 'Increased fuel consumption and engine heat',
  [HandlingProblem.PoorBalance]: 'Increased brake wear, harder to control',
  [HandlingProblem.LowDownforce]: 'Less grip overall',
  [HandlingProblem.HighPitchSensitivity]: 'Less grip in wind, suspension wear',
};

const PROBLEM_ORDER: HandlingProblem[] = [
  HandlingProblem.OversteerFast,
  HandlingProblem.OversteerSlow,
  HandlingProblem.UndersteerFast,
  HandlingProblem.UndersteerSlow,
  HandlingProblem.HighDrag,
  HandlingProblem.PoorBalance,
  HandlingProblem.LowDownforce,
  HandlingProblem.HighPitchSensitivity,
];

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

function getProblemStatus(
  state: HandlingProblemState | undefined,
  activeDesignProblem: HandlingProblem | null,
  problem: HandlingProblem
): { label: string; className: string } {
  if (!state || !state.discovered) {
    return { label: 'Unknown', className: 'text-muted' };
  }
  if (state.solutionInstalled) {
    return { label: 'Fixed', className: 'text-green-400' };
  }
  if (state.solutionDesigned) {
    return { label: 'Ready to Build', className: 'text-blue-400' };
  }
  if (activeDesignProblem === problem) {
    return { label: 'Designing...', className: 'text-amber-400' };
  }
  if (state.solutionProgress > 0) {
    return { label: `${state.solutionProgress}/${MAX_SOLUTION_PROGRESS}`, className: 'text-amber-400' };
  }
  return { label: 'Needs Fix', className: 'text-red-400' };
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

interface SummaryTabProps {
  designState: DesignState;
  currentSeason: number;
}

function SummaryTab({ designState, currentSeason }: SummaryTabProps) {
  const levelMap = new Map(designState.technologyLevels.map((l) => [l.component, l]));
  const discoveredCount = designState.currentYearChassis.problems.filter((p) => p.discovered).length;
  const nextYearProgress = designState.nextYearChassis
    ? getChassisOverallProgress(designState.nextYearChassis)
    : 0;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Chassis Overview */}
      <div className="space-y-4">
        {/* Current Year */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>{currentSeason} Chassis</SectionHeading>
            <span className="text-sm font-mono text-primary">SA{currentSeason}-A</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted">Handling</span>
              <div className="text-primary font-mono">
                {designState.currentYearChassis.handlingRevealed > 0
                  ? `${designState.currentYearChassis.handlingRevealed}%`
                  : '?'}
              </div>
            </div>
            <div>
              <span className="text-muted">Problems</span>
              <div className="text-primary font-mono">{discoveredCount} found</div>
            </div>
            <div>
              <span className="text-muted">Designers</span>
              <div className="text-primary font-mono">{designState.currentYearChassis.designersAssigned}%</div>
            </div>
          </div>
        </div>

        {/* Next Year */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>{currentSeason + 1} Chassis</SectionHeading>
            <span className="text-sm font-mono text-primary">SA{currentSeason + 1}-A</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
            <div>
              <span className="text-muted">Stage</span>
              <div className="text-primary">
                {designState.nextYearChassis
                  ? getCurrentStageName(designState.nextYearChassis)
                  : 'Not Started'}
              </div>
            </div>
            <div>
              <span className="text-muted">Progress</span>
              <div className="text-primary font-mono">{nextYearProgress}%</div>
            </div>
            <div>
              <span className="text-muted">Designers</span>
              <div className="text-primary font-mono">{designState.nextYearChassis?.designersAssigned ?? 0}%</div>
            </div>
          </div>
          {designState.nextYearChassis && (
            <ProgressBar value={nextYearProgress} />
          )}
        </div>
      </div>

      {/* Right: Technology Grid */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionHeading>Technology</SectionHeading>
          <span className="text-sm text-muted">
            {designState.activeTechProject?.designersAssigned ?? 0}% designers
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs border-b border-subtle">
              <th className="text-left py-2">Component</th>
              <th className="text-center py-2">Performance</th>
              <th className="text-center py-2">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {TECH_ORDER.map((component) => {
              const level = levelMap.get(component);
              return (
                <tr key={component} className="border-b border-subtle last:border-0">
                  <td className="py-2 text-secondary">{TECH_LABELS[component]}</td>
                  <td className="py-2">
                    <div className="flex justify-center">
                      <LevelBar value={level?.performance ?? 1} compact />
                    </div>
                  </td>
                  <td className="py-2">
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
  );
}

interface NextYearChassisTabProps {
  chassis: ChassisDesign | null;
  currentSeason: number;
}

function NextYearChassisTab({ chassis, currentSeason }: NextYearChassisTabProps) {
  if (!chassis) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted">No chassis design in progress for {currentSeason + 1} season.</p>
      </div>
    );
  }

  const overallProgress = getChassisOverallProgress(chassis);
  const stageMap = new Map(chassis.stages.map((s) => [s.stage, s]));

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <SectionHeading>{currentSeason + 1} Chassis Design</SectionHeading>
          <p className="text-sm text-muted mt-1">SA{currentSeason + 1}-A</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{overallProgress}%</div>
          <p className="text-sm text-muted">
            {chassis.designersAssigned} designer{chassis.designersAssigned !== 1 ? 's' : ''} assigned
          </p>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar value={overallProgress} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {STAGE_ORDER.map((stage, index) => {
          const stageProgress = stageMap.get(stage);
          const progress = stageProgress?.progress ?? 0;
          const completed = stageProgress?.completed ?? false;
          const isActive =
            !completed &&
            STAGE_ORDER.slice(0, index).every((s) => stageMap.get(s)?.completed);

          return (
            <div
              key={stage}
              className={`p-4 rounded border ${
                isActive
                  ? 'border-accent bg-accent/10'
                  : completed
                    ? 'border-green-600 bg-green-900/20'
                    : 'border-subtle'
              }`}
            >
              <div className="text-xs text-secondary mb-2">{STAGE_LABELS[stage]}</div>
              <div className="text-xl font-bold text-primary mb-2">
                {completed ? '✓' : `${progress}/${MAX_STAGE_PROGRESS}`}
              </div>
              <ProgressBar value={(progress / MAX_STAGE_PROGRESS) * 100} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CurrentYearChassisTabProps {
  chassisState: CurrentYearChassisState;
  currentSeason: number;
}

function CurrentYearChassisTab({ chassisState, currentSeason }: CurrentYearChassisTabProps) {
  const problemMap = new Map(chassisState.problems.map((p) => [p.problem, p]));
  const discoveredCount = chassisState.problems.filter((p) => p.discovered).length;
  const fixedCount = chassisState.problems.filter((p) => p.solutionInstalled).length;

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="card p-4">
        <div className="flex items-center gap-8">
          <div>
            <SectionHeading>{currentSeason} Chassis</SectionHeading>
            <p className="text-sm text-muted">SA{currentSeason}-A</p>
          </div>
          <div className="flex-1 max-w-xs">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted">Handling Revealed</span>
              <span className="text-primary font-mono">{chassisState.handlingRevealed}%</span>
            </div>
            <ProgressBar value={chassisState.handlingRevealed} />
          </div>
          <div className="text-center px-4">
            <div className="text-2xl font-bold text-primary">{discoveredCount}/{PROBLEM_ORDER.length}</div>
            <div className="text-xs text-muted">Problems Found</div>
          </div>
          <div className="text-center px-4">
            <div className="text-2xl font-bold text-green-400">{fixedCount}/{PROBLEM_ORDER.length}</div>
            <div className="text-xs text-muted">Problems Fixed</div>
          </div>
        </div>
      </div>

      {/* Handling Problems Grid */}
      <div className="grid grid-cols-4 gap-4">
        {PROBLEM_ORDER.map((problem) => {
          const state = problemMap.get(problem);
          const status = getProblemStatus(state, chassisState.activeDesignProblem, problem);
          const isDiscovered = state?.discovered ?? false;

          return (
            <div
              key={problem}
              className={`card p-4 ${isDiscovered ? '' : 'opacity-50'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-primary">
                  {PROBLEM_LABELS[problem]}
                </span>
                <span className={`text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>
              <p className="text-xs text-muted mb-2">
                {isDiscovered ? PROBLEM_DESCRIPTIONS[problem] : 'Not yet discovered'}
              </p>
              {isDiscovered && state && !state.solutionInstalled && state.solutionProgress > 0 && (
                <ProgressBar value={(state.solutionProgress / MAX_SOLUTION_PROGRESS) * 100} />
              )}
            </div>
          );
        })}
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

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading design data...</p>
      </div>
    );
  }

  const teamState = gameState.teamStates[playerTeam.id];
  const designState = teamState.designState;
  const currentSeason = gameState.currentSeason.seasonNumber;

  return (
    <div>
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'summary' && (
        <SummaryTab designState={designState} currentSeason={currentSeason} />
      )}
      {activeTab === 'next-year' && (
        <NextYearChassisTab chassis={designState.nextYearChassis} currentSeason={currentSeason} />
      )}
      {activeTab === 'current-year' && (
        <CurrentYearChassisTab
          chassisState={designState.currentYearChassis}
          currentSeason={currentSeason}
        />
      )}
      {activeTab === 'technology' && <TechnologyTab levels={designState.technologyLevels} />}
    </div>
  );
}
