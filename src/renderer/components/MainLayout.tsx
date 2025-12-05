import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  sections,
  defaultSection,
  defaultSubItem,
  type SectionId,
  type Section,
} from '../navigation';

export function MainLayout() {
  const [selectedSectionId, setSelectedSectionId] = useState<SectionId>(defaultSection);
  const [selectedSubItemId, setSelectedSubItemId] = useState<string>(defaultSubItem);

  const selectedSection = sections.find((s) => s.id === selectedSectionId) as Section;
  const selectedSubItem = selectedSection.subItems.find((sub) => sub.id === selectedSubItemId);

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
      <aside className="sidebar flex flex-col w-24 bg-gray-800 border-r border-gray-700">
        {sections.map((section) => {
          const Icon = section.icon;
          const isSelected = section.id === selectedSectionId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => handleSectionClick(section)}
              className={`flex flex-col items-center justify-center py-3 cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] mt-1 font-medium">{section.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1">
        {/* Top Bar */}
        <header className="top-bar flex items-center justify-between h-12 px-4 bg-gray-800 border-b border-gray-700">
          <div className="text-lg font-semibold">
            {selectedSection.label}: {selectedSubItem?.label}
          </div>
          <div className="text-lg font-mono text-green-400">$50,000,000</div>
        </header>

        {/* Content Area */}
        <main className="content flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-xl">
              {selectedSection.label} &gt; {selectedSubItem?.label}
            </p>
          </div>
        </main>

        {/* Bottom Bar */}
        <footer className="bottom-bar flex items-center h-14 px-4 bg-gray-800 border-t border-gray-700">
          {/* Team Logo Placeholder */}
          <div className="w-12 h-10 bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
            LOGO
          </div>

          {/* Sub-navigation */}
          <nav className="sub-nav flex items-center ml-4 gap-1">
            {selectedSection.subItems.map((subItem) => {
              const SubIcon = subItem.icon;
              const isSelected = subItem.id === selectedSubItemId;
              return (
                <button
                  key={subItem.id}
                  type="button"
                  onClick={() => handleSubItemClick(subItem.id)}
                  className={`flex flex-col items-center justify-center px-3 py-1 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  <SubIcon size={16} />
                  <span className="text-[9px] mt-0.5 font-medium">{subItem.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Next Race Info Placeholder */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mr-4">
            <span>ROUND 1</span>
          </div>

          {/* Advance Button */}
          <button
            type="button"
            className="flex items-center justify-center w-10 h-10 bg-green-600 hover:bg-green-500 rounded cursor-pointer transition-colors"
            title="Advance"
          >
            <Check size={24} />
          </button>
        </footer>
      </div>
    </div>
  );
}
