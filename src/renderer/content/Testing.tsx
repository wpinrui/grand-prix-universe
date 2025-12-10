import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDerivedGameState, queryKeys } from '../hooks';
import { SectionHeading, SummaryStat, ProgressBar, Dropdown, StaffAllocationSlider } from '../components';
import type { DropdownOption } from '../components';
import { ACCENT_CARD_STYLE, ACCENT_BORDERED_BUTTON_STYLE, GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';
import { IpcChannels } from '../../shared/ipc';
import { HandlingProblem, Department, type TestSession, type Driver, type StaffCounts } from '../../shared/domain';
import {
  estimateTestCompletionDays,
  MAX_TEST_PROGRESS,
} from '../../shared/domain/testing-utils';

// ===========================================
// TYPES
// ===========================================

type TestingViewState = 'empty' | 'setup' | 'in-progress' | 'results';

// ===========================================
// CONSTANTS
// ===========================================

const PROBLEM_LABELS: Record<HandlingProblem, string> = {
  [HandlingProblem.OversteerFast]: 'Oversteer (High Speed)',
  [HandlingProblem.OversteerSlow]: 'Oversteer (Low Speed)',
  [HandlingProblem.UndersteerFast]: 'Understeer (High Speed)',
  [HandlingProblem.UndersteerSlow]: 'Understeer (Low Speed)',
  [HandlingProblem.HighDrag]: 'High Drag',
  [HandlingProblem.PoorBalance]: 'Poor Balance',
  [HandlingProblem.LowDownforce]: 'Low Downforce',
  [HandlingProblem.HighPitchSensitivity]: 'High Pitch Sensitivity',
};

const PROBLEM_DESCRIPTIONS: Record<HandlingProblem, string> = {
  [HandlingProblem.OversteerFast]: 'Reduces grip on high-speed circuits',
  [HandlingProblem.OversteerSlow]: 'Reduces grip on low-speed circuits',
  [HandlingProblem.UndersteerFast]: 'Increases tyre wear on high-speed circuits',
  [HandlingProblem.UndersteerSlow]: 'Increases tyre wear on low-speed circuits',
  [HandlingProblem.HighDrag]: 'Increases fuel consumption and engine heat',
  [HandlingProblem.PoorBalance]: 'Reduces overall handling performance',
  [HandlingProblem.LowDownforce]: 'Reduces cornering speed and stability',
  [HandlingProblem.HighPitchSensitivity]: 'Makes car unpredictable under braking',
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/** Get total mechanic count from staff counts */
function getMechanicCount(staffCounts: Record<string, number>): number {
  return Object.values(staffCounts).reduce((sum, count) => sum + count, 0);
}

function determineViewState(testSession: TestSession): TestingViewState {
  if (!testSession.active) {
    return 'empty';
  }
  if (testSession.progress >= MAX_TEST_PROGRESS) {
    return 'results';
  }
  return 'in-progress';
}

// ===========================================
// SECTION COMPONENTS
// ===========================================

interface EmptyStateProps {
  onStartSetup: () => void;
  testsCompleted: number;
  handlingKnown: boolean;
  handlingPercent: number;
}

function EmptyState({ onStartSetup, testsCompleted, handlingKnown, handlingPercent }: EmptyStateProps) {
  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-3 gap-8">
          <SummaryStat label="Tests Completed" value={testsCompleted} />
          <SummaryStat
            label="Handling Rating"
            value={handlingKnown ? `${handlingPercent}%` : '???'}
          />
          <SummaryStat label="Status" value="Idle" />
        </div>
      </div>

      {/* Action Card */}
      <div className="card p-6">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold text-primary">No Test in Progress</h3>
          <p className="text-secondary max-w-md mx-auto">
            {testsCompleted === 0
              ? 'Run your first development test to discover your chassis handling rating.'
              : 'Run another development test to discover handling problems and improve your car.'}
          </p>
          <button
            type="button"
            className="px-6 py-3 rounded-lg font-medium cursor-pointer"
            style={ACCENT_BORDERED_BUTTON_STYLE}
            onClick={onStartSetup}
          >
            Start New Test
          </button>
        </div>
      </div>
    </div>
  );
}

interface SetupStateProps {
  drivers: Driver[];
  selectedDriverId: string | null;
  onDriverChange: (driverId: string) => void;
  mechanicsAllocated: number;
  onMechanicsChange: (value: number) => void;
  mechanicCount: number;
  estimatedDays: number | null;
  onStartTest: () => void;
  onCancel: () => void;
}

function SetupState({
  drivers,
  selectedDriverId,
  onDriverChange,
  mechanicsAllocated,
  onMechanicsChange,
  mechanicCount,
  estimatedDays,
  onStartTest,
  onCancel,
}: SetupStateProps) {
  const driverOptions: DropdownOption<string>[] = useMemo(
    () => drivers.map((d) => ({ value: d.id, label: `${d.firstName} ${d.lastName}` })),
    [drivers]
  );

  const hasDrivers = driverOptions.length > 0;
  const hasMechanics = mechanicCount > 0;
  const canStart = selectedDriverId !== null && mechanicsAllocated > 0 && hasDrivers && hasMechanics;

  // Calculate mechanic allocation numbers
  const mechanicsUsed = Math.round((mechanicsAllocated / 100) * mechanicCount);
  const mechanicsRemaining = mechanicCount - mechanicsUsed;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Mechanic Allocation Panel */}
      <div className="card p-4">
        <SectionHeading>Mechanic Allocation</SectionHeading>
        <div className="mt-4 flex gap-8">
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Total:</span>
            <span className="text-sm font-mono text-primary">{mechanicCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Testing:</span>
            <span className="text-sm font-mono text-primary">
              {mechanicsUsed} ({mechanicsAllocated}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-400">Available:</span>
            <span className="text-sm font-mono text-primary">
              {mechanicsRemaining} ({100 - mechanicsAllocated}%)
            </span>
          </div>
        </div>
      </div>

      {/* Setup Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <SectionHeading>Test Setup</SectionHeading>

        <div className="mt-6 space-y-6">
          {/* Driver Selection */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Test Driver
            </label>
            {hasDrivers ? (
              <Dropdown
                id="test-driver"
                options={driverOptions}
                value={selectedDriverId ?? ''}
                onChange={onDriverChange}
                className="w-64"
              />
            ) : (
              <p className="text-sm text-red-400">No drivers available on team</p>
            )}
            <p className="text-xs text-muted mt-1">
              Any team driver can perform development testing.
            </p>
          </div>

          {/* Mechanic Allocation */}
          {hasMechanics ? (
            <StaffAllocationSlider
              id="mechanic-allocation"
              value={mechanicsAllocated}
              onChange={onMechanicsChange}
              staffCount={mechanicCount}
              label="Mechanic Allocation"
              helperText="Higher allocation = faster test completion."
            />
          ) : (
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Mechanic Allocation
              </label>
              <p className="text-sm text-red-400">No mechanics available. Hire mechanics first.</p>
            </div>
          )}

          {/* Estimated Time */}
          {estimatedDays !== null && mechanicsAllocated > 0 && (
            <div className="p-4 surface-secondary rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-secondary">Estimated Duration</span>
                <span className="font-semibold text-primary">
                  ~{estimatedDays} {estimatedDays === 1 ? 'day' : 'days'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          className="px-6 py-3 rounded-lg font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={canStart ? ACCENT_BORDERED_BUTTON_STYLE : undefined}
          onClick={onStartTest}
          disabled={!canStart}
        >
          Begin Test
        </button>
        <button
          type="button"
          className={`${GHOST_BORDERED_BUTTON_CLASSES} px-6 py-3 rounded-lg cursor-pointer`}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface InProgressStateProps {
  driverName: string;
  mechanicsAllocated: number;
  progress: number;
  estimatedDays: number | null;
  testsCompleted: number;
  onStop: () => void;
}

function InProgressState({
  driverName,
  mechanicsAllocated,
  progress,
  estimatedDays,
  testsCompleted,
  onStop,
}: InProgressStateProps) {
  const progressPercent = (progress / MAX_TEST_PROGRESS) * 100;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-3 gap-8">
          <SummaryStat label="Test Driver" value={driverName} />
          <SummaryStat label="Mechanics Allocated" value={`${mechanicsAllocated}%`} />
          <SummaryStat label="Tests Completed" value={testsCompleted} />
        </div>
      </div>

      {/* Progress Card */}
      <div className="card p-6">
        <SectionHeading>Test Progress</SectionHeading>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-secondary">Progress</span>
            <span className="font-semibold text-primary">
              {progress} / {MAX_TEST_PROGRESS}
            </span>
          </div>
          <ProgressBar value={progressPercent} />

          {estimatedDays !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Estimated time remaining</span>
              <span className="text-secondary">
                ~{estimatedDays} {estimatedDays === 1 ? 'day' : 'days'}
              </span>
            </div>
          )}

          <p className="text-xs text-muted mt-4">
            {testsCompleted === 0
              ? 'This test will reveal your chassis handling rating.'
              : 'This test will discover a specific handling problem.'}
          </p>
        </div>
      </div>

      {/* Stop Button */}
      <div>
        <button
          type="button"
          className={`${GHOST_BORDERED_BUTTON_CLASSES} px-6 py-3 rounded-lg cursor-pointer`}
          onClick={onStop}
        >
          Stop Test
        </button>
        <p className="text-xs text-muted mt-2">
          Stopping early will lose all progress on this test.
        </p>
      </div>
    </div>
  );
}

interface ResultsStateProps {
  testsCompleted: number;
  handlingPercent: number;
  discoveredProblems: HandlingProblem[];
  latestProblem: HandlingProblem | null;
  onDismiss: () => void;
}

function ResultsState({
  testsCompleted,
  handlingPercent,
  discoveredProblems,
  latestProblem,
  onDismiss,
}: ResultsStateProps) {
  const isFirstTest = testsCompleted === 1;

  return (
    <div className="space-y-6">
      {/* Results Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <SectionHeading>Test Complete!</SectionHeading>

        <div className="mt-6">
          {isFirstTest ? (
            <div className="text-center space-y-4">
              <p className="text-secondary">Chassis handling rating discovered:</p>
              <div className="text-5xl font-bold text-primary">{handlingPercent}%</div>
              <p className="text-sm text-muted max-w-md mx-auto">
                This is your car's overall handling performance. Run more tests to discover
                specific handling problems that can be fixed to improve performance.
              </p>
            </div>
          ) : latestProblem ? (
            <div className="text-center space-y-4">
              <p className="text-secondary">Handling problem discovered:</p>
              <div className="text-2xl font-bold text-primary">
                {PROBLEM_LABELS[latestProblem]}
              </div>
              <p className="text-sm text-muted max-w-md mx-auto">
                {PROBLEM_DESCRIPTIONS[latestProblem]}
              </p>
              <p className="text-xs text-muted">
                Go to Design → Current Year Chassis to assign designers to solve this problem.
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-secondary">No new problems found!</p>
              <p className="text-sm text-muted">
                All handling problems have been discovered.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Discovered Problems Summary */}
      {discoveredProblems.length > 0 && (
        <div className="card p-6">
          <SectionHeading>Discovered Problems ({discoveredProblems.length})</SectionHeading>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {discoveredProblems.map((problem) => (
              <div key={problem} className="p-3 surface-secondary rounded-lg">
                <div className="text-sm font-medium text-primary">
                  {PROBLEM_LABELS[problem]}
                </div>
                <div className="text-xs text-muted mt-1">
                  {PROBLEM_DESCRIPTIONS[problem]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div>
        <button
          type="button"
          className="px-6 py-3 rounded-lg font-medium cursor-pointer"
          style={ACCENT_BORDERED_BUTTON_STYLE}
          onClick={onDismiss}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Testing() {
  const queryClient = useQueryClient();
  const { gameState, playerTeam } = useDerivedGameState();

  // Local UI state for setup mode
  const [isInSetup, setIsInSetup] = useState(false);
  const [setupDriverId, setSetupDriverId] = useState<string | null>(null);
  const [setupMechanics, setSetupMechanics] = useState(50);

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading testing data...</p>
      </div>
    );
  }

  const teamState = gameState.teamStates[playerTeam.id];
  const testSession = teamState.testSession;
  const designState = teamState.designState;

  // Get team drivers for dropdown
  const teamDrivers = gameState.drivers.filter((d) => d.teamId === playerTeam.id);

  // Get mechanic staff counts for estimation
  const defaultStaffCounts: StaffCounts = { trainee: 0, average: 0, good: 0, 'very-good': 0, excellent: 0 };
  const mechanicCounts = teamState.staffCounts[Department.Mechanics] ?? defaultStaffCounts;
  const mechanicCount = getMechanicCount(mechanicCounts);

  // Determine view state
  const viewState = isInSetup ? 'setup' : determineViewState(testSession);

  // Calculate handling info from design state
  const handlingKnown = designState.currentYearChassis.handlingRevealed !== null;
  const handlingPercent = designState.currentYearChassis.handlingRevealed ?? 0;
  const discoveredProblems = designState.currentYearChassis.problems
    .filter((p) => p.discovered)
    .map((p) => p.problem);

  // Estimate test completion
  const estimatedDays = useMemo(() => {
    if (viewState === 'setup') {
      // Estimate for setup state using setup values
      const mockSession: TestSession = {
        active: true,
        driverId: setupDriverId,
        mechanicsAllocated: setupMechanics,
        progress: 0,
        accumulatedWorkUnits: 0,
        testsCompleted: testSession.testsCompleted,
      };
      return estimateTestCompletionDays(
        mockSession,
        mechanicCounts,
        playerTeam.factory.facilities
      );
    }
    if (viewState === 'in-progress') {
      return estimateTestCompletionDays(
        testSession,
        mechanicCounts,
        playerTeam.factory.facilities
      );
    }
    return null;
  }, [viewState, setupDriverId, setupMechanics, testSession, mechanicCounts, playerTeam.factory.facilities]);

  // Handlers
  const handleStartSetup = useCallback(() => {
    setSetupDriverId(teamDrivers[0]?.id ?? null);
    // Default to 50% - slider will snap to nearest valid step
    setSetupMechanics(50);
    setIsInSetup(true);
  }, [teamDrivers]);

  const handleCancelSetup = useCallback(() => {
    setIsInSetup(false);
  }, []);

  const handleStartTest = useCallback(async () => {
    if (!setupDriverId) return;

    await window.electronAPI.invoke(IpcChannels.TESTING_START, {
      driverId: setupDriverId,
      mechanicsAllocated: setupMechanics,
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.gameState });
    setIsInSetup(false);
  }, [setupDriverId, setupMechanics, queryClient]);

  const handleResetTestSession = useCallback(async () => {
    await window.electronAPI.invoke(IpcChannels.TESTING_STOP);
    queryClient.invalidateQueries({ queryKey: queryKeys.gameState });
  }, [queryClient]);

  // Get driver name for in-progress display
  const testDriverName = useMemo(() => {
    if (!testSession.driverId) return 'Unknown';
    const driver = teamDrivers.find((d) => d.id === testSession.driverId);
    return driver ? `${driver.firstName} ${driver.lastName}` : 'Unknown';
  }, [testSession.driverId, teamDrivers]);

  // Find latest discovered problem (for results view)
  const latestProblem = useMemo(() => {
    if (discoveredProblems.length === 0) return null;
    // The most recently discovered problem is the last in the list
    return discoveredProblems[discoveredProblems.length - 1] ?? null;
  }, [discoveredProblems]);

  return (
    <div className="max-w-3xl">
      {viewState === 'empty' && (
        <EmptyState
          onStartSetup={handleStartSetup}
          testsCompleted={testSession.testsCompleted}
          handlingKnown={handlingKnown}
          handlingPercent={handlingPercent}
        />
      )}

      {viewState === 'setup' && (
        <SetupState
          drivers={teamDrivers}
          selectedDriverId={setupDriverId}
          onDriverChange={setSetupDriverId}
          mechanicsAllocated={setupMechanics}
          onMechanicsChange={setSetupMechanics}
          mechanicCount={mechanicCount}
          estimatedDays={estimatedDays}
          onStartTest={handleStartTest}
          onCancel={handleCancelSetup}
        />
      )}

      {viewState === 'in-progress' && (
        <InProgressState
          driverName={testDriverName}
          mechanicsAllocated={testSession.mechanicsAllocated}
          progress={testSession.progress}
          estimatedDays={estimatedDays}
          testsCompleted={testSession.testsCompleted}
          onStop={handleResetTestSession}
        />
      )}

      {viewState === 'results' && (
        <ResultsState
          testsCompleted={testSession.testsCompleted}
          handlingPercent={handlingPercent}
          discoveredProblems={discoveredProblems}
          latestProblem={latestProblem}
          onDismiss={handleResetTestSession}
        />
      )}
    </div>
  );
}
