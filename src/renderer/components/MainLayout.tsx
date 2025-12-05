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
    <div className="main-layout flex w-full h-screen bg-gray-900 text-white">
      {/* Left Sidebar */}
      <aside className="sidebar flex flex-col w-40 bg-gray-800 border-r border-gray-700">
        {sections.map((section) => (
          <SectionButton
            key={section.id}
            section={section}
            isSelected={section.id === selectedSectionId}
            onClick={() => handleSectionClick(section)}
          />
        ))}
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1">
        <TopBar
          sectionLabel={selectedSection.label}
          subItemLabel={selectedSubItem.label}
          currentDate={gameState?.currentDate ?? null}
          playerTeam={playerTeam}
        />

        {/* Content Area */}
        <main className="content flex-1 p-8 overflow-auto">
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-2xl">
              {selectedSection.label}: {selectedSubItem.label}
            </p>
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
    </div>
  );
}
