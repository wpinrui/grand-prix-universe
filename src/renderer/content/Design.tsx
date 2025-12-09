import { useDerivedGameState } from '../hooks';
import { SectionHeading, SummaryStat, DetailRow, ProgressBar } from '../components';
import { ACCENT_CARD_STYLE } from '../utils/theme-styles';
import {
  ChassisDesignStage,
  TechnologyComponent,
  type ChassisDesign,
  type TechnologyLevel,
  type CurrentYearChassisState,
  type DesignState,
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

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function getChassisOverallProgress(chassis: ChassisDesign): number {
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
}

function TechnologySection({ levels }: TechnologySectionProps) {
  const levelMap = new Map(levels.map((l) => [l.component, l]));
  const avgLevel = getTechAverageLevel(levels);

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

function CurrentYearChassisSection({ chassisState }: CurrentYearChassisSectionProps) {
  const discoveredProblems = chassisState.problems.filter((p) => p.discovered);
  const solvedProblems = chassisState.problems.filter((p) => p.solutionInstalled);

  return (
    <section>
      <SectionHeading>Current Year Chassis</SectionHeading>
      <div className="card p-4">
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
            label="Problems Discovered"
            value={<span className="font-mono">{discoveredProblems.length}</span>}
          />
          <DetailRow
            label="Solutions Installed"
            value={<span className="font-mono">{solvedProblems.length}</span>}
          />
        </div>
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
  const designState: DesignState = teamState.designState;
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
      <TechnologySection levels={designState.technologyLevels} />

      {/* Current Year Chassis */}
      <CurrentYearChassisSection chassisState={designState.currentYearChassis} />
    </div>
  );
}
