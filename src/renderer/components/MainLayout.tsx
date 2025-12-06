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
import { TeamProfile, SavedGames, GameOptions } from '../content';
import { RoutePaths } from '../routes';

type ActiveDialog = 'restart' | 'quit' | null;

// ===========================================
// SIMPLE OPTION SCREENS
// ===========================================

interface ActionScreenProps {
  onShowDialog: () => void;
}

function RestartScreen({ onShowDialog }: ActionScreenProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-primary">Restart Game</h1>
      <p className="text-secondary">
        Start over from the title screen. Your current game progress will be lost unless you have saved.
      </p>
      <button
        type="button"
        onClick={onShowDialog}
        className="btn px-6 py-2 font-semibold bg-amber-600 text-white border border-amber-500 rounded-lg hover:bg-amber-500 transition-all duration-200"
      >
        Restart Game
      </button>
    </div>
  );
}

function QuitScreen({ onShowDialog }: ActionScreenProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-primary">Quit Game</h1>
      <p className="text-secondary">
        Exit the application. Your current game progress will be lost unless you have saved.
      </p>
      <button
        type="button"
        onClick={onShowDialog}
        className="btn px-6 py-2 font-semibold bg-red-600 text-white border border-red-500 rounded-lg hover:bg-red-500 transition-all duration-200"
      >
        Quit Game
      </button>
    </div>
  );
}

// ===========================================
// MAIN LAYOUT
// ===========================================

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
  const handleRestartConfirm = () => {
    clearGameState();
    navigate(RoutePaths.TITLE);
  };

  const handleQuitConfirm = () => {
    quitApp();
  };

  const closeDialog = () => setActiveDialog(null);

  // Check if showing placeholder content (not implemented screens)
  const isOptionsScreen = selectedSectionId === 'options';
  const isImplemented =
    (selectedSectionId === 'team' && selectedSubItemId === 'profile') ||
    (isOptionsScreen && ['saved-games', 'game-options', 'restart', 'quit'].includes(selectedSubItemId));
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
          ) : isOptionsScreen && selectedSubItemId === 'restart' ? (
            <RestartScreen onShowDialog={() => setActiveDialog('restart')} />
          ) : isOptionsScreen && selectedSubItemId === 'quit' ? (
            <QuitScreen onShowDialog={() => setActiveDialog('quit')} />
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

      {/* Confirmation Dialogs */}
      {activeDialog === 'restart' && (
        <ConfirmDialog
          title="Restart Game?"
          message="Are you sure you want to restart? Any unsaved progress will be lost."
          confirmLabel="Restart"
          onConfirm={handleRestartConfirm}
          onCancel={closeDialog}
        />
      )}
      {activeDialog === 'quit' && (
        <ConfirmDialog
          title="Quit Game?"
          message="Are you sure you want to quit? Any unsaved progress will be lost."
          confirmLabel="Quit"
          onConfirm={handleQuitConfirm}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
