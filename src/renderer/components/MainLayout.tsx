import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  sections,
  defaultSection,
  defaultSubItem,
  type SectionId,
  type Section,
} from '../navigation';
import { useDerivedGameState, useTeamTheme, useClearGameState, useQuitApp } from '../hooks';
import { SectionButton } from './NavButtons';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { ConfirmDialog } from './ConfirmDialog';
import {
  TeamProfile,
  SavedGames,
  GameOptions,
  ActionScreen,
  ACTION_CONFIGS,
  isActionType,
  type ActionType,
} from '../content';
import { RoutePaths } from '../routes';

type ActiveDialog = ActionType | null;

// Sub-items that have been implemented in the options section
const IMPLEMENTED_OPTIONS_SUBITEMS = new Set(['saved-games', 'game-options', 'restart', 'quit']);

export function MainLayout() {
  const [selectedSectionId, setSelectedSectionId] = useState<SectionId>(defaultSection);
  const [selectedSubItemId, setSelectedSubItemId] = useState<string>(defaultSubItem);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  const navigate = useNavigate();
  const clearGameState = useClearGameState();
  const quitApp = useQuitApp();

  const { gameState, playerTeam, nextRace } = useDerivedGameState();

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

  // Check if showing placeholder content (not implemented screens)
  const isOptionsScreen = selectedSectionId === 'options';
  const isImplemented =
    (selectedSectionId === 'team' && selectedSubItemId === 'profile') ||
    (isOptionsScreen && IMPLEMENTED_OPTIONS_SUBITEMS.has(selectedSubItemId));
  const isPlaceholder = !isImplemented;

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
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar
          sectionLabel={selectedSection.label}
          subItemLabel={selectedSubItem.label}
          currentDate={gameState?.currentDate ?? null}
          playerTeam={playerTeam}
        />

        {/* Content Area - with accent tint for placeholder */}
        <main
          className="content flex-1 p-8 overflow-auto"
          style={isPlaceholder ? {
            background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent-900) 20%, var(--neutral-950)) 0%, var(--neutral-950) 100%)',
          } : undefined}
        >
          {selectedSectionId === 'team' && selectedSubItemId === 'profile' ? (
            <TeamProfile />
          ) : isOptionsScreen && selectedSubItemId === 'saved-games' ? (
            <SavedGames onNavigateToProfile={navigateToProfile} />
          ) : isOptionsScreen && selectedSubItemId === 'game-options' ? (
            <GameOptions />
          ) : isOptionsScreen && isActionType(selectedSubItemId) ? (
            <ActionScreen
              {...ACTION_CONFIGS[selectedSubItemId].screen}
              onShowDialog={() => setActiveDialog(selectedSubItemId)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-2xl font-semibold text-secondary">
                  {selectedSection.label}: {selectedSubItem.label}
                </p>
                <p className="text-muted mt-2 text-sm">Coming soon</p>
              </div>
            </div>
          )}
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
    </div>
  );
}
