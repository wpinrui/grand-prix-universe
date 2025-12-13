import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  sections,
  defaultSection,
  defaultSubItem,
  type SectionId,
  type Section,
} from '../navigation';
import { useDerivedGameState, useTeamTheme, useClearGameState, useQuitApp, useAutoSaveListener, useDismissAppointmentNews } from '../hooks';
import { EntityNavigationContext, getEntityRoute, type EntityType } from '../utils/entity-navigation';
import { SectionButton } from './NavButtons';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { SimulationOverlay } from './SimulationOverlay';
import { CalendarPreviewPanel } from './CalendarPreviewPanel';
import { ConfirmDialog } from './ConfirmDialog';
import { AutoSaveToast } from './AutoSaveToast';
import { BackgroundLayer } from './BackgroundLayer';
import { GlobalSearch, parsePageId } from './GlobalSearch';
import { AppointmentNewsModal } from './AppointmentNewsModal';
import type { SearchResultType } from '../hooks/useGlobalSearch';
import {
  Home,
  TeamProfile,
  News,
  Mail,
  Finance,
  Staff,
  PlayerWiki,
  Cars,
  Factory,
  Testing,
  Design,
  Construction,
  Contracts,
  Sponsors,
  SavedGames,
  GameOptions,
  ActionScreen,
  QUIT_DIALOG_CONFIG,
  Championship,
  Races,
  Results,
  RaceWeekend,
  WorldTeams,
  WorldDrivers,
  WorldStaff,
  WorldStats,
} from '../content';
import { GamePhase } from '../../shared/domain';
import { RoutePaths } from '../routes';

type ActiveDialog = 'quit' | null;

// Navigation history entry
interface HistoryEntry {
  sectionId: SectionId;
  subItemId: string;
  entityId?: string;
  entityType?: EntityType | 'race';
}

// Route map for simple components (no props needed)
const ROUTE_COMPONENTS: Partial<Record<SectionId, Record<string, React.ComponentType>>> = {
  home: {
    home: Home,
    profile: PlayerWiki,
  },
  inbox: {
    news: News,
  },
  team: {
    overview: TeamProfile,
    staff: Staff,
    factory: Factory,
  },
  engineering: {
    cars: Cars,
    testing: Testing,
    construction: Construction,
  },
  world: {
    stats: WorldStats,
  },
  commercial: {
    finance: Finance,
    contracts: Contracts,
  },
  options: {
    'game-options': GameOptions,
  },
};

export function MainLayout() {
  const [selectedSectionId, setSelectedSectionId] = useState<SectionId>(defaultSection);
  const [selectedSubItemId, setSelectedSubItemId] = useState<string>(defaultSubItem);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [showAutoSaveToast, setShowAutoSaveToast] = useState(false);
  const [isCalendarPreviewOpen, setIsCalendarPreviewOpen] = useState(false);
  const [targetRaceNumber, setTargetRaceNumber] = useState<number | null>(null);
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [targetDriverId, setTargetDriverId] = useState<string | null>(null);
  const [targetStaffId, setTargetStaffId] = useState<string | null>(null);
  const [targetEmailId, setTargetEmailId] = useState<string | null>(null);

  // Search modal state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Navigation history for back/forward (combined to avoid stale closure issues)
  const [navHistory, setNavHistory] = useState<{ entries: HistoryEntry[]; index: number }>({
    entries: [{ sectionId: defaultSection, subItemId: defaultSubItem }],
    index: 0,
  });

  // Track last visited sub-item per section (for restoring on section click)
  const [lastSubItemPerSection, setLastSubItemPerSection] = useState<Partial<Record<SectionId, string>>>({});

  // Track internal page tabs (for pages like Sponsors that have their own tabs)
  const [pageTabState, setPageTabState] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const clearGameState = useClearGameState();
  const quitApp = useQuitApp();
  const dismissAppointmentNews = useDismissAppointmentNews();

  const { gameState, playerTeam, nextRace } = useDerivedGameState();

  // Auto-save toast handlers
  const handleAutoSave = useCallback((_filename: string) => setShowAutoSaveToast(true), []);
  const handleDismissToast = useCallback(() => setShowAutoSaveToast(false), []);
  useAutoSaveListener(handleAutoSave);

  // Apply team-based theming (CSS variables on :root)
  useTeamTheme(playerTeam?.primaryColor ?? null);

  // Keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for navigation events from child components (e.g., Home page, AdvanceWeekButton)
  useEffect(() => {
    const handleNavigate = (e: CustomEvent<{ section: string; subItem: string; emailId?: string }>) => {
      const { section, subItem, emailId } = e.detail;
      setSelectedSectionId(section as SectionId);
      setSelectedSubItemId(subItem);
      setLastSubItemPerSection(prev => ({ ...prev, [section as SectionId]: subItem }));
      setTargetRaceNumber(null);
      setTargetTeamId(null);
      setTargetDriverId(null);
      setTargetStaffId(null);
      setTargetEmailId(emailId ?? null);
      setNavHistory((prev) => ({
        entries: [...prev.entries.slice(0, prev.index + 1), { sectionId: section as SectionId, subItemId: subItem }],
        index: prev.index + 1,
      }));
    };

    window.addEventListener('app:navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('app:navigate', handleNavigate as EventListener);
  }, []);

  // Clear all entity target states
  const clearAllTargets = useCallback(() => {
    setTargetRaceNumber(null);
    setTargetTeamId(null);
    setTargetDriverId(null);
    setTargetStaffId(null);
    setTargetEmailId(null);
  }, []);

  // Apply a history entry to navigation state
  const applyHistoryEntry = useCallback((entry: HistoryEntry) => {
    setSelectedSectionId(entry.sectionId);
    setSelectedSubItemId(entry.subItemId);

    // Restore entity-specific navigation based on entry type
    setTargetRaceNumber(entry.entityType === 'race' && entry.entityId ? parseInt(entry.entityId, 10) : null);
    setTargetTeamId(entry.entityType === 'team' ? entry.entityId ?? null : null);
    setTargetDriverId(entry.entityType === 'driver' ? entry.entityId ?? null : null);
    setTargetStaffId(entry.entityType === 'chief' || entry.entityType === 'principal' ? entry.entityId ?? null : null);
  }, []);

  // Push a new entry to navigation history
  const pushHistory = useCallback((entry: HistoryEntry) => {
    setNavHistory((prev) => ({
      entries: [...prev.entries.slice(0, prev.index + 1), entry],
      index: prev.index + 1,
    }));
  }, []);

  // Clear navigation history when simulation starts (advance time)
  const isSimulating = gameState?.simulation?.isSimulating ?? false;
  useEffect(() => {
    if (isSimulating) {
      // Reset to single entry with current page
      setNavHistory((prev) => ({
        entries: [prev.entries[prev.index] ?? { sectionId: defaultSection, subItemId: defaultSubItem }],
        index: 0,
      }));
    }
  }, [isSimulating]);

  // Navigate back in history
  const handleBack = useCallback(() => {
    setNavHistory((prev) => {
      if (prev.index <= 0) return prev;
      const newIndex = prev.index - 1;
      applyHistoryEntry(prev.entries[newIndex]);
      return { ...prev, index: newIndex };
    });
  }, [applyHistoryEntry]);

  // Navigate forward in history
  const handleForward = useCallback(() => {
    setNavHistory((prev) => {
      if (prev.index >= prev.entries.length - 1) return prev;
      const newIndex = prev.index + 1;
      applyHistoryEntry(prev.entries[newIndex]);
      return { ...prev, index: newIndex };
    });
  }, [applyHistoryEntry]);

  const canGoBack = navHistory.index > 0;
  const canGoForward = navHistory.index < navHistory.entries.length - 1;

  // Safe: selectedSectionId always matches a valid section (defaults to 'home')
  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? sections[0];
  const selectedSubItem =
    selectedSection.subItems.find((sub) => sub.id === selectedSubItemId) ?? selectedSection.subItems[0];

  const handleSectionClick = (section: Section) => {
    const lastSubItem = lastSubItemPerSection[section.id] ?? section.subItems[0].id;
    setSelectedSectionId(section.id);
    setSelectedSubItemId(lastSubItem);
    clearAllTargets();
    pushHistory({ sectionId: section.id, subItemId: lastSubItem });
  };

  const handleSubItemClick = (subItemId: string) => {
    if (subItemId !== 'results') {
      setTargetRaceNumber(null);
    }
    if (subItemId !== 'teams') {
      setTargetTeamId(null);
    }
    if (subItemId !== 'drivers') {
      setTargetDriverId(null);
    }
    if (subItemId !== 'staff') {
      setTargetStaffId(null);
    }
    setSelectedSubItemId(subItemId);
    setLastSubItemPerSection(prev => ({ ...prev, [selectedSectionId]: subItemId }));
    pushHistory({ sectionId: selectedSectionId, subItemId });
  };

  // Navigation helper for content components
  const navigateToProfile = () => {
    setSelectedSectionId('home');
    setSelectedSubItemId('profile');
    setLastSubItemPerSection(prev => ({ ...prev, home: 'profile' }));
    pushHistory({ sectionId: 'home', subItemId: 'profile' });
  };

  const navigateToRaceReport = (raceNumber: number) => {
    setTargetRaceNumber(raceNumber);
    setSelectedSectionId('championship');
    setSelectedSubItemId('results');
    setLastSubItemPerSection(prev => ({ ...prev, championship: 'results' }));
    pushHistory({ sectionId: 'championship', subItemId: 'results', entityType: 'race', entityId: String(raceNumber) });
  };

  // Dialog handlers
  const handleQuitConfirm = () => quitApp();
  const closeDialog = () => setActiveDialog(null);

  // Calendar preview handlers
  const toggleCalendarPreview = useCallback(() => {
    setIsCalendarPreviewOpen((prev) => !prev);
  }, []);
  const closeCalendarPreview = useCallback(() => {
    setIsCalendarPreviewOpen(false);
  }, []);

  // Search handlers
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  // Entity navigation for Football Manager-style linking
  const navigateToEntity = useCallback((type: EntityType, id: string) => {
    const route = getEntityRoute(type, id);
    setSelectedSectionId(route.section);
    setSelectedSubItemId(route.subItem);
    setLastSubItemPerSection(prev => ({ ...prev, [route.section]: route.subItem }));
    // Pass entityId to the appropriate page
    if (type === 'race') {
      const raceNum = parseInt(id, 10);
      setTargetRaceNumber(Number.isNaN(raceNum) ? null : raceNum);
    } else if (type === 'team') {
      setTargetTeamId(id);
    } else if (type === 'driver') {
      setTargetDriverId(id);
    } else if (type === 'chief' || type === 'principal') {
      setTargetStaffId(id);
    }
    pushHistory({ sectionId: route.section, subItemId: route.subItem, entityType: type, entityId: id });
  }, [pushHistory]);

  const handleSearchSelect = useCallback((type: SearchResultType, id: string) => {
    if (type === 'page') {
      const parsed = parsePageId(id);
      if (parsed) {
        setSelectedSectionId(parsed.section);
        setSelectedSubItemId(parsed.subItem);
        setLastSubItemPerSection(prev => ({ ...prev, [parsed.section]: parsed.subItem }));
        clearAllTargets();
        pushHistory({ sectionId: parsed.section, subItemId: parsed.subItem });
      }
    } else {
      // Entity types - delegate to navigateToEntity
      navigateToEntity(type as EntityType, id);
    }
  }, [pushHistory, clearAllTargets, navigateToEntity]);

  const entityNavigationValue = useMemo(
    () => ({ navigateToEntity }),
    [navigateToEntity]
  );

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
    // Inbox section - Mail with initial email selection
    if (selectedSectionId === 'inbox' && selectedSubItemId === 'inbox') {
      return <Mail initialEmailId={targetEmailId} onEmailViewed={() => setTargetEmailId(null)} />;
    }

    // World section - entity views with props
    if (selectedSectionId === 'world' && selectedSubItemId === 'teams') {
      return <WorldTeams initialTeamId={targetTeamId} />;
    }
    if (selectedSectionId === 'world' && selectedSubItemId === 'drivers') {
      return <WorldDrivers initialDriverId={targetDriverId} />;
    }
    if (selectedSectionId === 'world' && selectedSubItemId === 'staff') {
      return <WorldStaff initialStaffId={targetStaffId} />;
    }

    // Championship section
    if (selectedSectionId === 'championship' && selectedSubItemId === 'standings') {
      return <Championship onNavigateToDriver={(driverId) => navigateToEntity('driver', driverId)} />;
    }
    if (selectedSectionId === 'championship' && selectedSubItemId === 'races') {
      return <Races onViewRaceReport={navigateToRaceReport} />;
    }
    if (selectedSectionId === 'championship' && selectedSubItemId === 'results') {
      return (
        <Results
          initialRaceNumber={targetRaceNumber}
          onRaceViewed={() => setTargetRaceNumber(null)}
          onNavigateToDriver={(driverId) => navigateToEntity('driver', driverId)}
        />
      );
    }

    // Design section - pass subpage to determine which view to render
    if (selectedSectionId === 'design') {
      return <Design initialTab={selectedSubItemId} />;
    }

    // Commercial > Sponsors - now includes Deals as tabs
    if (selectedSectionId === 'commercial' && selectedSubItemId === 'sponsors') {
      return (
        <Sponsors
          initialTab={pageTabState['sponsors']}
          onTabChange={(tab) => setPageTabState(prev => ({ ...prev, sponsors: tab }))}
        />
      );
    }

    // Options section
    if (selectedSectionId === 'options' && selectedSubItemId === 'saved-games') {
      return <SavedGames onNavigateToProfile={navigateToProfile} />;
    }
    if (selectedSectionId === 'options' && selectedSubItemId === 'quit') {
      return (
        <ActionScreen
          onBackToMainMenu={() => {
            clearGameState();
            navigate(RoutePaths.TITLE);
          }}
          onShowQuitDialog={() => setActiveDialog('quit')}
        />
      );
    }

    // Simple routes - use route map
    const RouteComponent = ROUTE_COMPONENTS[selectedSectionId]?.[selectedSubItemId];
    if (RouteComponent) {
      return <RouteComponent />;
    }

    // Fallback for unimplemented routes
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
    <EntityNavigationContext.Provider value={entityNavigationValue}>
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
            currentDate={gameState?.currentDate ?? null}
            playerTeam={playerTeam}
            onCalendarClick={toggleCalendarPreview}
            onSearchClick={openSearch}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={handleBack}
            onForward={handleForward}
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

        {/* Quit Confirmation Dialog */}
        {activeDialog === 'quit' && (
          <ConfirmDialog
            {...QUIT_DIALOG_CONFIG}
            onConfirm={handleQuitConfirm}
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
            playerTeam={playerTeam}
          />
        )}

        {/* Global Search Modal */}
        <GlobalSearch
          isOpen={isSearchOpen}
          onClose={closeSearch}
          onSelect={handleSearchSelect}
        />

        {/* Appointment News Modal - shown on game start */}
        {gameState?.pendingAppointmentNews && (
          <AppointmentNewsModal
            news={gameState.pendingAppointmentNews}
            onContinue={() => dismissAppointmentNews.mutate()}
          />
        )}
      </div>
    </EntityNavigationContext.Provider>
  );
}
