import { useState } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, DetailRow, ProgressBar } from '../components';
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

const TABS: { id: DesignTab; label: string }[] = [
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
// TAB VIEWS
// ===========================================

interface SummaryTabProps {
  designState: DesignState;
  currentSeason: number;
}

function SummaryTab({ designState, currentSeason }: SummaryTabProps) {
  const levelMap = new Map(designState.technologyLevels.map((l) => [l.component, l]));
  const discoveredCount = designState.currentYearChassis.problems.filter((p) => p.discovered).length;

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left Column: Designers */}
      <div className="card p-4">
        <SectionHeading>Designers</SectionHeading>
        <table className="w-full text-sm mt-3">
          <tbody>
            <tr className="border-b border-subtle">
              <td className="py-2 text-green-400">Available</td>
              <td className="py-2 text-right font-mono">100%</td>
            </tr>
            <tr className="border-b border-subtle">
              <td className="py-2 text-secondary">Next Year Chassis</td>
              <td className="py-2 text-right font-mono">
                {designState.nextYearChassis?.designersAssigned ?? 0}%
              </td>
            </tr>
            <tr className="border-b border-subtle">
              <td className="py-2 text-secondary">Current Year Chassis</td>
              <td className="py-2 text-right font-mono">
                {designState.currentYearChassis.designersAssigned}%
              </td>
            </tr>
            <tr>
              <td className="py-2 text-secondary">Technology</td>
              <td className="py-2 text-right font-mono">
                {designState.activeTechProject?.designersAssigned ?? 0}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Middle Column: Technology Overview */}
      <div className="card p-4">
        <SectionHeading>Technology</SectionHeading>
        <table className="w-full text-sm mt-3">
          <thead>
            <tr className="text-muted text-xs">
              <th className="text-left pb-2"></th>
              <th className="text-center pb-2">Perf</th>
              <th className="text-center pb-2">Rel</th>
            </tr>
          </thead>
          <tbody>
            {TECH_ORDER.map((component) => {
              const level = levelMap.get(component);
              return (
                <tr key={component} className="border-b border-subtle last:border-0">
                  <td className="py-1.5 text-secondary">{TECH_LABELS[component]}</td>
                  <td className="py-1.5">
                    <div className="flex justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 ${
                            i <= (level?.performance ?? 1) ? 'bg-amber-500' : 'bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="py-1.5">
                    <div className="flex justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 ${
                            i <= (level?.reliability ?? 1) ? 'bg-amber-500' : 'bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Right Column: Chassis Info */}
      <div className="space-y-4">
        {/* Current Year Chassis */}
        <div className="card p-4">
          <SectionHeading>{currentSeason} Chassis</SectionHeading>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-muted text-xs">
                <th className="text-left pb-2">Name</th>
                <th className="text-left pb-2">Handling</th>
                <th className="text-left pb-2">Project</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 text-primary">SA{currentSeason}-A</td>
                <td className="py-1 text-primary">
                  {designState.currentYearChassis.handlingRevealed > 0
                    ? `${designState.currentYearChassis.handlingRevealed}%`
                    : '?'}
                </td>
                <td className="py-1 text-primary">
                  {discoveredCount > 0 ? `${discoveredCount} found` : 'None'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Next Year Chassis */}
        <div className="card p-4">
          <SectionHeading>{currentSeason + 1} Chassis</SectionHeading>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-muted text-xs">
                <th className="text-left pb-2">Name</th>
                <th className="text-left pb-2">Stage</th>
                <th className="text-left pb-2">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 text-primary">SA{currentSeason + 1}-A</td>
                <td className="py-1 text-primary">
                  {designState.nextYearChassis
                    ? getCurrentStageName(designState.nextYearChassis)
                    : 'Not Started'}
                </td>
                <td className="py-1 text-primary">
                  {designState.nextYearChassis
                    ? `${getChassisOverallProgress(designState.nextYearChassis)}%`
                    : '0%'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <SectionHeading>{currentSeason + 1} Chassis Design</SectionHeading>
          <span className="text-sm text-muted">
            {chassis.designersAssigned} designer{chassis.designersAssigned !== 1 ? 's' : ''} assigned
          </span>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-secondary">Overall Progress</span>
          <span className="text-sm font-medium text-primary">{overallProgress}%</span>
        </div>
        <ProgressBar value={overallProgress} />

        <div className="grid grid-cols-4 gap-4 mt-6">
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
                <div className="text-lg font-medium text-primary mb-2">
                  {completed ? 'Complete' : `${progress}/${MAX_STAGE_PROGRESS}`}
                </div>
                <ProgressBar value={(progress / MAX_STAGE_PROGRESS) * 100} />
              </div>
            );
          })}
        </div>
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
      {/* Summary Stats */}
      <div className="card p-4">
        <SectionHeading>{currentSeason} Chassis</SectionHeading>
        <div className="grid grid-cols-3 gap-6 mt-4">
          <div>
            <DetailRow
              label="Handling Revealed"
              value={<span className="font-mono">{chassisState.handlingRevealed}%</span>}
            />
            <div className="mt-2">
              <ProgressBar value={chassisState.handlingRevealed} />
            </div>
          </div>
          <DetailRow
            label="Problems Found"
            value={<span className="font-mono">{discoveredCount}/{PROBLEM_ORDER.length}</span>}
          />
          <DetailRow
            label="Problems Fixed"
            value={<span className="font-mono">{fixedCount}/{PROBLEM_ORDER.length}</span>}
          />
        </div>
      </div>

      {/* Handling Problems Grid */}
      <div className="card p-4">
        <SectionHeading>Handling Problems</SectionHeading>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {PROBLEM_ORDER.map((problem) => {
            const state = problemMap.get(problem);
            const status = getProblemStatus(state, chassisState.activeDesignProblem, problem);
            const isDiscovered = state?.discovered ?? false;

            return (
              <div
                key={problem}
                className={`p-3 rounded border border-subtle ${isDiscovered ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-primary">
                    {PROBLEM_LABELS[problem]}
                  </span>
                  <span className={`text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {isDiscovered ? PROBLEM_DESCRIPTIONS[problem] : 'Not yet discovered'}
                </p>
                {isDiscovered && state && !state.solutionInstalled && state.solutionProgress > 0 && (
                  <div className="mt-2">
                    <ProgressBar
                      value={(state.solutionProgress / MAX_SOLUTION_PROGRESS) * 100}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
    <div className="card p-4">
      <SectionHeading>Technology Components</SectionHeading>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {TECH_ORDER.map((component) => {
          const level = levelMap.get(component);
          const perf = level?.performance ?? 1;
          const rel = level?.reliability ?? 1;

          return (
            <div key={component} className="p-4 rounded border border-subtle">
              <div className="text-sm font-semibold text-primary mb-3">
                {TECH_LABELS[component]}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-secondary mb-1">
                    <span>Performance</span>
                    <span className="font-mono">{perf}/{MAX_TECH_LEVEL}</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-4 ${i <= perf ? 'bg-amber-500' : 'bg-gray-700'}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-secondary mb-1">
                    <span>Reliability</span>
                    <span className="font-mono">{rel}/{MAX_TECH_LEVEL}</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-4 ${i <= rel ? 'bg-amber-500' : 'bg-gray-700'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
    <div className="flex gap-6 h-full">
      {/* Vertical Tab Bar */}
      <div className="w-48 flex-shrink-0">
        <div className="card p-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-3 text-sm cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'bg-accent/20 text-accent border-l-2 border-accent'
                  : 'text-secondary hover:text-primary hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-w-0">
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
    </div>
  );
}
