import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  sections,
  defaultSection,
  defaultSubItem,
  type SectionId,
  type Section,
} from '../navigation';
import { useDerivedGameState, useTeamTheme, useClearGameState, useQuitApp, useAutoSaveListener } from '../hooks';
import { SectionButton } from './NavButtons';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { SimulationOverlay } from './SimulationOverlay';
import { CalendarPreviewPanel } from './CalendarPreviewPanel';
import { ConfirmDialog } from './ConfirmDialog';
import { AutoSaveToast } from './AutoSaveToast';
import { BackgroundLayer } from './BackgroundLayer';
import {
  TeamProfile,
  SavedGames,
  GameOptions,
  ActionScreen,
  ACTION_CONFIGS,
  isActionType,
  type ActionType,
  Championship,
  Races,
  Results,
  RaceWeekend,
} from '../content';
import { GamePhase } from '../../shared/domain';
import { RoutePaths } from '../routes';

type ActiveDialog = ActionType | null;

export function MainLayout() {
  const [selectedSectionId, setSelectedSectionId] = useState<SectionId>(defaultSection);
  const [selectedSubItemId, setSelectedSubItemId] = useState<string>(defaultSubItem);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [showAutoSaveToast, setShowAutoSaveToast] = useState(false);
  const [isCalendarPreviewOpen, setIsCalendarPreviewOpen] = useState(false);

  const navigate = useNavigate();
  const clearGameState = useClearGameState();
  const quitApp = useQuitApp();

  const { gameState, playerTeam, nextRace } = useDerivedGameState();

  // Auto-save toast handlers
  const handleAutoSave = useCallback((_filename: string) => setShowAutoSaveToast(true), []);
  const handleDismissToast = useCallback(() => setShowAutoSaveToast(false), []);
  useAutoSaveListener(handleAutoSave);

  // Apply team-based theming (CSS variables on :root)
  useTeamTheme(playerTeam?.primaryColor ?? null);

  // Safe: selectedSectionId always matches a valid section (defaults to 'team')
  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? sections[0];
  const selectedSubItem =
    selectedSection.subItems.find((sub) => sub.id === selectedSubItemId) ?? selectedSection.subItems[0];

  const handleSectionClick = (section: Section) => {
    setSelectedSectionId(section.id);
    setSelectedSubItemId(section.subItems[0].id);
  };

  const handleSubItemClick = (subItemId: string) => {
    setSelectedSubItemId(subItemId);
  };

  // Navigation helper for content components
  const navigateToProfile = () => {
    setSelectedSectionId('team');
    setSelectedSubItemId('profile');
  };

  // Dialog handlers
  const actionHandlers: Record<ActionType, () => void> = {
    restart: () => {
      clearGameState();
      navigate(RoutePaths.TITLE);
    },
    quit: () => quitApp(),
  };

  const closeDialog = () => setActiveDialog(null);

  // Calendar preview handlers
  const toggleCalendarPreview = useCallback(() => {
    setIsCalendarPreviewOpen((prev) => !prev);
  }, []);
  const closeCalendarPreview = useCallback(() => {
    setIsCalendarPreviewOpen(false);
  }, []);

  const isOptionsScreen = selectedSectionId === 'options';

  // Shared calendar data props (used by both CalendarPreviewPanel and SimulationOverlay)
  const calendarDataProps = gameState?.currentDate
    ? {
        currentDate: gameState.currentDate,
        events: gameState.calendarEvents ?? [],
        calendar: gameState.currentSeason?.calendar ?? [],
        circuits: gameState.circuits ?? [],
        nextRace,
      }
    : null;

  // Race weekend takes over the entire screen (no navigation)
  if (gameState?.phase === GamePhase.RaceWeekend) {
    return (
      <div className="flex w-full h-screen surface-base text-primary">
        {playerTeam && (
          <BackgroundLayer
            teamId={playerTeam.id}
            tintColor="var(--accent-900)"
            position="absolute"
            tintOpacity={75}
            baseOpacity={92}
          />
        )}
        <div className="relative z-10 w-full h-full">
          <RaceWeekend />
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (selectedSectionId === 'team' && selectedSubItemId === 'profile') {
      return <TeamProfile />;
    }

    if (selectedSectionId === 'fia' && selectedSubItemId === 'championship') {
      return <Championship />;
    }

    if (selectedSectionId === 'fia' && selectedSubItemId === 'races') {
      return <Races />;
    }

    if (selectedSectionId === 'fia' && selectedSubItemId === 'results') {
      return <Results />;
    }

    if (isOptionsScreen) {
      switch (selectedSubItemId) {
        case 'saved-games':
          return <SavedGames onNavigateToProfile={navigateToProfile} />;
        case 'game-options':
          return <GameOptions />;
        default:
          if (isActionType(selectedSubItemId)) {
            return (
              <ActionScreen
                {...ACTION_CONFIGS[selectedSubItemId].screen}
                onShowDialog={() => setActiveDialog(selectedSubItemId)}
              />
            );
          }
      }
    }

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-2xl font-semibold text-secondary">
            {selectedSection.label}: {selectedSubItem.label}
          </p>
          <p className="text-muted mt-2 text-sm">Coming soon</p>
        </div>
      </div>
    );
  };

  return (
    <div className="main-layout flex w-full h-screen surface-base text-primary">
      {/* Left Sidebar - wider */}
      <aside className="sidebar flex flex-col w-52 surface-primary border-r border-subtle">
        <div className="flex flex-col py-3">
          {sections.map((section) => (
            <SectionButton
              key={section.id}
              section={section}
              isSelected={section.id === selectedSectionId}
              onClick={() => handleSectionClick(section)}
            />
          ))}
        </div>
      </aside>

      {/* Main Area */}
      <div className="relative flex flex-col flex-1 min-w-0">
        <TopBar
          sectionLabel={selectedSection.label}
          subItemLabel={selectedSubItem.label}
          currentDate={gameState?.currentDate ?? null}
          playerTeam={playerTeam}
          onCalendarClick={toggleCalendarPreview}
        />

        {/* Calendar Preview Panel */}
        {calendarDataProps && (
          <CalendarPreviewPanel
            {...calendarDataProps}
            isVisible={isCalendarPreviewOpen && !(gameState?.simulation?.isSimulating ?? false)}
            onClose={closeCalendarPreview}
          />
        )}

        {/* Content Area - with background image, blur, and team tint */}
        <main className="content relative flex-1 overflow-hidden">
          {playerTeam && (
            <BackgroundLayer
              teamId={playerTeam.id}
              tintColor="var(--accent-900)"
              position="absolute"
              tintOpacity={75}
              baseOpacity={92}
            />
          )}

          {/* Content layer */}
          <div className="relative z-10 h-full p-8 overflow-auto">
            {renderContent()}
          </div>
        </main>

        <BottomBar
          playerTeam={playerTeam}
          selectedSection={selectedSection}
          selectedSubItemId={selectedSubItemId}
          onSubItemClick={handleSubItemClick}
          nextRace={nextRace}
        />
      </div>

      {/* Confirmation Dialog */}
      {activeDialog && (
        <ConfirmDialog
          {...ACTION_CONFIGS[activeDialog].dialog}
          onConfirm={actionHandlers[activeDialog]}
          onCancel={closeDialog}
        />
      )}

      {/* Auto-save Toast */}
      {showAutoSaveToast && (
        <AutoSaveToast
          message="Game auto-saved"
          onDismiss={handleDismissToast}
        />
      )}

      {/* Simulation Overlay - full screen during simulation */}
      {calendarDataProps && (
        <SimulationOverlay
          {...calendarDataProps}
          isVisible={gameState?.simulation?.isSimulating ?? false}
          isPostSeason={gameState?.phase === GamePhase.PostSeason}
          sectionLabel={selectedSection.label}
          subItemLabel={selectedSubItem.label}
          playerTeam={playerTeam}
        />
      )}
    </div>
  );
}
