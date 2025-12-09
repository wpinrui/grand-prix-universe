import { useDerivedGameState } from '../hooks';
import { SectionHeading, SummaryStat, DetailRow, ProgressBar } from '../components';
import { ACCENT_CARD_STYLE } from '../utils/theme-styles';
import {
  ChassisDesignStage,
  TechnologyComponent,
  HandlingProblem,
  type ChassisDesign,
  type TechnologyLevel,
  type CurrentYearChassisState,
  type HandlingProblemState,
} from '../../shared/domain';

// ===========================================
// CONSTANTS
// ===========================================

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

function getCurrentStage(chassis: ChassisDesign): ChassisDesignStage | null {
  for (const stage of STAGE_ORDER) {
    const stageProgress = chassis.stages.find((s) => s.stage === stage);
    if (stageProgress && !stageProgress.completed) {
      return stage;
    }
  }
  return null;
}

function getTechAverageLevel(levels: TechnologyLevel[]): number {
  if (levels.length === 0) return 0;
  const perfSum = levels.reduce((sum, l) => sum + l.performance, 0);
  const relSum = levels.reduce((sum, l) => sum + l.reliability, 0);
  return (perfSum + relSum) / (levels.length * 2);
}

// ===========================================
// SECTION COMPONENTS
// ===========================================

interface NextYearChassisSectionProps {
  chassis: ChassisDesign | null;
  currentSeason: number;
}

function NextYearChassisSection({ chassis, currentSeason }: NextYearChassisSectionProps) {
  if (!chassis) {
    return (
      <section>
        <SectionHeading>Next Year Chassis</SectionHeading>
        <div className="card p-4">
          <p className="text-muted text-center py-4">
            No chassis design in progress for {currentSeason + 1} season.
          </p>
        </div>
      </section>
    );
  }

  const overallProgress = getChassisOverallProgress(chassis);
  const currentStage = getCurrentStage(chassis);
  const stageMap = new Map(chassis.stages.map((s) => [s.stage, s]));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading>Next Year Chassis ({chassis.targetSeason})</SectionHeading>
        <div className="text-sm text-muted">
          {chassis.designersAssigned} designer{chassis.designersAssigned !== 1 ? 's' : ''} assigned
        </div>
      </div>
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-secondary">Overall Progress</span>
          <span className="text-sm font-medium text-primary">{overallProgress}%</span>
        </div>
        <ProgressBar value={overallProgress} />

        <div className="grid grid-cols-4 gap-4 pt-2">
          {STAGE_ORDER.map((stage) => {
            const stageProgress = stageMap.get(stage);
            const progress = stageProgress?.progress ?? 0;
            const completed = stageProgress?.completed ?? false;
            const isActive = stage === currentStage;

            return (
              <div
                key={stage}
                className={`p-3 rounded border ${
                  isActive
                    ? 'border-accent bg-accent/10'
                    : completed
                      ? 'border-green-600 bg-green-900/20'
                      : 'border-subtle'
                }`}
              >
                <div className="text-xs text-secondary mb-1">{STAGE_LABELS[stage]}</div>
                <div className="text-sm font-medium text-primary">
                  {completed ? 'Complete' : `${progress}/${MAX_STAGE_PROGRESS}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface TechnologySectionProps {
  levels: TechnologyLevel[];
  avgLevel: number;
}

function TechnologySection({ levels, avgLevel }: TechnologySectionProps) {
  const levelMap = new Map(levels.map((l) => [l.component, l]));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <SectionHeading>Technology</SectionHeading>
        <div className="text-sm text-muted">Average Level: {avgLevel.toFixed(1)}</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TECH_ORDER.map((component) => {
          const level = levelMap.get(component);
          const perf = level?.performance ?? 1;
          const rel = level?.reliability ?? 1;

          return (
            <div key={component} className="card p-4">
              <div className="text-sm font-semibold text-primary mb-3">
                {TECH_LABELS[component]}
              </div>
              <div className="space-y-2">
                <DetailRow
                  label="Performance"
                  value={
                    <span className="font-mono">
                      {perf}/{MAX_TECH_LEVEL}
                    </span>
                  }
                />
                <DetailRow
                  label="Reliability"
                  value={
                    <span className="font-mono">
                      {rel}/{MAX_TECH_LEVEL}
                    </span>
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface CurrentYearChassisSectionProps {
  chassisState: CurrentYearChassisState;
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

function CurrentYearChassisSection({ chassisState }: CurrentYearChassisSectionProps) {
  const problemMap = new Map(chassisState.problems.map((p) => [p.problem, p]));
  const discoveredCount = chassisState.problems.filter((p) => p.discovered).length;
  const fixedCount = chassisState.problems.filter((p) => p.solutionInstalled).length;

  return (
    <section>
      <SectionHeading>Current Year Chassis</SectionHeading>

      {/* Summary Stats */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-3 gap-6">
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
            value={<span className="font-mono">{discoveredCount}/8</span>}
          />
          <DetailRow
            label="Problems Fixed"
            value={<span className="font-mono">{fixedCount}/8</span>}
          />
        </div>
      </div>

      {/* Handling Problems Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PROBLEM_ORDER.map((problem) => {
          const state = problemMap.get(problem);
          const status = getProblemStatus(state, chassisState.activeDesignProblem, problem);
          const isDiscovered = state?.discovered ?? false;

          return (
            <div
              key={problem}
              className={`card p-3 ${isDiscovered ? '' : 'opacity-60'}`}
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
    </section>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Design() {
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

  // Summary stats
  const avgTechLevel = getTechAverageLevel(designState.technologyLevels);
  const chassisProgress = designState.nextYearChassis
    ? getChassisOverallProgress(designState.nextYearChassis)
    : null;
  const handlingRevealed = designState.currentYearChassis.handlingRevealed;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Summary Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-3 gap-8">
          <SummaryStat
            label="Next Year Chassis"
            value={chassisProgress !== null ? `${chassisProgress}%` : 'Not Started'}
          />
          <SummaryStat label="Avg Tech Level" value={avgTechLevel.toFixed(1)} />
          <SummaryStat label="Handling Revealed" value={`${handlingRevealed}%`} />
        </div>
      </div>

      {/* Next Year Chassis */}
      <NextYearChassisSection chassis={designState.nextYearChassis} currentSeason={currentSeason} />

      {/* Technology Components */}
      <TechnologySection levels={designState.technologyLevels} avgLevel={avgTechLevel} />

      {/* Current Year Chassis */}
      <CurrentYearChassisSection chassisState={designState.currentYearChassis} />
    </div>
  );
}
