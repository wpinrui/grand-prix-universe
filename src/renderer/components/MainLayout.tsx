import { useState } from 'react';
import { Check, Calendar } from 'lucide-react';
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
      <aside className="sidebar flex flex-col w-40 bg-gray-800 border-r border-gray-700">
        {sections.map((section) => {
          const Icon = section.icon;
          const isSelected = section.id === selectedSectionId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => handleSectionClick(section)}
              className={`flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Icon size={24} />
              <span className="text-sm font-medium">{section.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1">
        {/* Top Bar */}
        <header className="top-bar flex items-center justify-between h-14 px-5 bg-gray-800 border-b border-gray-700">
          <div className="text-xl font-semibold">
            {selectedSection.label}: {selectedSubItem?.label}
          </div>
          <div className="flex items-center gap-4">
            {/* Calendar Button */}
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer transition-colors"
              title="Calendar"
            >
              <Calendar size={18} />
              <span className="text-sm">Week 1, March 2025</span>
            </button>
            {/* Budget */}
            <div className="text-xl font-semibold text-green-400">$50,000,000</div>
          </div>
        </header>

        {/* Content Area */}
        <main className="content flex-1 p-8 overflow-auto">
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-2xl">
              {selectedSection.label} &gt; {selectedSubItem?.label}
            </p>
          </div>
        </main>

        {/* Bottom Bar */}
        <footer className="bottom-bar flex items-center h-16 px-5 bg-gray-800 border-t border-gray-700">
          {/* Team Logo Placeholder */}
          <div className="w-14 h-12 bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
            LOGO
          </div>

          {/* Sub-navigation */}
          <nav className="sub-nav flex items-center ml-5 gap-2">
            {selectedSection.subItems.map((subItem) => {
              const SubIcon = subItem.icon;
              const isSelected = subItem.id === selectedSubItemId;
              return (
                <button
                  key={subItem.id}
                  type="button"
                  onClick={() => handleSubItemClick(subItem.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  <SubIcon size={20} />
                  <span className="text-sm font-medium">{subItem.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Next Race Info Placeholder */}
          <div className="flex items-center gap-2 text-base text-gray-400 mr-5">
            <span>ROUND 1</span>
          </div>

          {/* Advance Button */}
          <button
            type="button"
            className="flex items-center justify-center w-12 h-12 bg-green-600 hover:bg-green-500 rounded cursor-pointer transition-colors"
            title="Advance"
          >
            <Check size={28} />
          </button>
        </footer>
      </div>
    </div>
  );
}
