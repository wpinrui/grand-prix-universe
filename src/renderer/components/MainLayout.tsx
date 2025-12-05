import { useState } from 'react';
import {
  sections,
  defaultSection,
  defaultSubItem,
  type SectionId,
  type Section,
} from '../navigation';
import { useDerivedGameState, useTeamTheme } from '../hooks';
import { SectionButton } from './NavButtons';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { TeamProfile } from '../content';

export function MainLayout() {
  const [selectedSectionId, setSelectedSectionId] = useState<SectionId>(defaultSection);
  const [selectedSubItemId, setSelectedSubItemId] = useState<string>(defaultSubItem);

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

  return (
    <div className="main-layout flex w-full h-screen surface-base text-primary">
      {/* Left Sidebar */}
      <aside className="sidebar flex flex-col w-44 surface-primary border-r border-subtle">
        <div className="flex flex-col py-2">
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

        {/* Content Area */}
        <main className="content flex-1 p-8 overflow-auto surface-base">
          {selectedSectionId === 'team' && selectedSubItemId === 'profile' ? (
            <TeamProfile />
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
    </div>
  );
}
