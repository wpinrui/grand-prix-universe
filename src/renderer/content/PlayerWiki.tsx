import { useEffect, useState } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, SummaryStat, DetailRow, CenteredMessage } from '../components';
import { ACCENT_CARD_STYLE } from '../utils/theme-styles';
import { formatGameDate } from '../../shared/utils/date-utils';
import { PLAYER_MANAGER_ID } from '../../shared/domain/events';
import { IpcChannels } from '../../shared/ipc';
import type { GameEvent, GameDate } from '../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type WikiTab = 'stats' | 'timeline' | 'biography';

interface CareerStartedData {
  playerName: string;
  teamId: string;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Calculate number of seasons played from start year to current year
 * A season counts if the player has played any part of it
 */
function calculateSeasonsPlayed(startYear: number, currentYear: number): number {
  return currentYear - startYear + 1;
}

/**
 * Extract career started data from CAREER_STARTED event
 */
function getCareerStartedData(event: GameEvent): CareerStartedData | null {
  if (event.type !== 'CAREER_STARTED') return null;
  return {
    playerName: event.data.playerName as string,
    teamId: event.data.teamId as string,
  };
}

// ===========================================
// COMPONENTS
// ===========================================

interface StatRowProps {
  label: string;
  value: string | number;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-subtle last:border-b-0">
      <span className="text-secondary">{label}</span>
      <span className="text-primary font-medium">{value}</span>
    </div>
  );
}

const WIKI_TABS: { id: WikiTab; label: string }[] = [
  { id: 'stats', label: 'Stats' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'biography', label: 'Biography' },
];

interface WikiTabBarProps {
  activeTab: WikiTab;
  onTabChange: (tab: WikiTab) => void;
}

function WikiTabBar({ activeTab, onTabChange }: WikiTabBarProps) {
  return (
    <div className="flex gap-1 mb-6">
      {WIKI_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            activeTab === tab.id
              ? 'bg-accent-600 text-white'
              : 'bg-neutral-700 text-secondary hover:bg-neutral-600'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface CareerStatsProps {
  playerName: string;
  careerStartDate: GameDate;
  startingTeamName: string;
  currentTeamName: string;
  seasonsPlayed: number;
}

function CareerStats({
  playerName,
  careerStartDate,
  startingTeamName,
  currentTeamName,
  seasonsPlayed,
}: CareerStatsProps) {
  const hasChangedTeams = startingTeamName !== currentTeamName;

  return (
    <div className="space-y-8">
      {/* Summary Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-3 gap-8">
          <SummaryStat label="Career Started" value={formatGameDate(careerStartDate)} />
          <SummaryStat label="Seasons Played" value={seasonsPlayed} />
          <SummaryStat label="Current Team" value={currentTeamName} />
        </div>
      </div>

      {/* Career Details */}
      <section>
        <SectionHeading>Career Overview</SectionHeading>
        <div className="card p-4">
          <StatRow label="Manager Name" value={playerName} />
          <StatRow label="Career Started" value={formatGameDate(careerStartDate)} />
          <StatRow label="Starting Team" value={startingTeamName} />
          {hasChangedTeams && <StatRow label="Current Team" value={currentTeamName} />}
          <StatRow label="Seasons in Management" value={seasonsPlayed} />
        </div>
      </section>

      {/* Future Stats Placeholder */}
      <section>
        <SectionHeading>Career Statistics</SectionHeading>
        <div className="card p-4">
          <DetailRow label="Race Wins" value="—" />
          <DetailRow label="Podium Finishes" value="—" />
          <DetailRow label="Pole Positions" value="—" />
          <DetailRow label="Championship Titles" value="—" />
          <p className="text-muted text-sm mt-4 italic">
            Statistics will be populated as you progress through your career.
          </p>
        </div>
      </section>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function PlayerWiki() {
  const { gameState, playerTeam } = useDerivedGameState();
  const [careerEvent, setCareerEvent] = useState<GameEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WikiTab>('stats');

  // Query career events for the player manager
  // Only refetch when gameId changes (new game loaded), not on every state update
  const gameId = gameState?.gameId;
  useEffect(() => {
    if (!gameId) return;

    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const events = await window.electronAPI.invoke(IpcChannels.EVENTS_QUERY, {
          entityIds: [PLAYER_MANAGER_ID],
          types: ['CAREER_STARTED'],
          limit: 1,
          order: 'asc',
        });
        setCareerEvent(events[0] ?? null);
      } catch (err) {
        setError('Failed to load career history');
        console.error('Failed to query career events:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [gameId]);

  if (!gameState || !playerTeam) {
    return <CenteredMessage>Loading player data...</CenteredMessage>;
  }

  if (isLoading) {
    return <CenteredMessage>Loading career history...</CenteredMessage>;
  }

  if (error) {
    return <CenteredMessage>{error}</CenteredMessage>;
  }

  if (!careerEvent) {
    return <CenteredMessage>No career history found.</CenteredMessage>;
  }

  const careerData = getCareerStartedData(careerEvent);
  if (!careerData) {
    return <CenteredMessage>Unable to load career data.</CenteredMessage>;
  }

  // Find starting team name from teams list
  const startingTeam = gameState.teams.find((t) => t.id === careerData.teamId);
  const startingTeamName = startingTeam?.name ?? careerData.teamId;

  const seasonsPlayed = calculateSeasonsPlayed(
    careerEvent.date.year,
    gameState.currentDate.year
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'stats':
        return (
          <CareerStats
            playerName={careerData.playerName}
            careerStartDate={careerEvent.date}
            startingTeamName={startingTeamName}
            currentTeamName={playerTeam.name}
            seasonsPlayed={seasonsPlayed}
          />
        );
      case 'timeline':
        return (
          <div className="card p-6">
            <p className="text-muted italic">
              Timeline view coming soon. This will show a chronological list of career events.
            </p>
          </div>
        );
      case 'biography':
        return (
          <div className="card p-6">
            <p className="text-muted italic">
              Biography view coming soon. This will display a Wikipedia-style narrative of your career.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl">
      <WikiTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      {renderTabContent()}
    </div>
  );
}
