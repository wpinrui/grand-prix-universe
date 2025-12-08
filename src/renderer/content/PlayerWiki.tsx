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

/** Minimal team info needed for display */
type TeamInfo = { id: string; name: string };

/** Readable labels for event types */
const EVENT_TYPE_LABELS: Record<string, string> = {
  CAREER_STARTED: 'Career Started',
  TEAM_CHANGED: 'Team Change',
  RACE_FINISH: 'Race Finish',
  QUALIFYING_RESULT: 'Qualifying',
  RACE_RETIREMENT: 'Race Retirement',
  CRASH_INCIDENT: 'Crash Incident',
  CHAMPIONSHIP_WON: 'Championship Won',
  POSITION_IMPROVED: 'Position Improved',
  POINTS_MILESTONE: 'Points Milestone',
  DRIVER_SIGNED: 'Driver Signed',
  DRIVER_RELEASED: 'Driver Released',
  STAFF_HIRED: 'Staff Hired',
  STAFF_FIRED: 'Staff Fired',
  CONTRACT_EXPIRED: 'Contract Expired',
  SPONSOR_SIGNED: 'Sponsor Signed',
  SPONSOR_LOST: 'Sponsor Lost',
  PRIZE_MONEY_RECEIVED: 'Prize Money',
  CAR_DESIGNED: 'Car Designed',
  UPGRADE_COMPLETED: 'Upgrade Completed',
  TEST_SESSION_RUN: 'Test Session',
  MEDIA_STATEMENT: 'Media Statement',
  PRESS_CONFERENCE: 'Press Conference',
};

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

/**
 * Get readable label for an event type
 */
function getEventTypeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}

/**
 * Generate a description for an event based on its type and data
 */
function getEventDescription(event: GameEvent, teams: TeamInfo[]): string {
  const getTeamName = (teamId: string) => teams.find((t) => t.id === teamId)?.name ?? teamId;

  switch (event.type) {
    case 'CAREER_STARTED': {
      const playerName = event.data.playerName as string;
      const teamId = event.data.teamId as string;
      return `${playerName} began their management career with ${getTeamName(teamId)}.`;
    }
    case 'TEAM_CHANGED': {
      const fromTeam = event.data.fromTeamId as string | undefined;
      const toTeam = event.data.toTeamId as string;
      if (fromTeam) {
        return `Moved from ${getTeamName(fromTeam)} to ${getTeamName(toTeam)}.`;
      }
      return `Joined ${getTeamName(toTeam)}.`;
    }
    default:
      return '';
  }
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
    <div className="flex border-b border-subtle mb-6">
      {WIKI_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`relative px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === tab.id ? 'text-primary' : 'text-muted hover:text-secondary'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500"
              style={{ boxShadow: '0 0 8px var(--accent-500)' }}
            />
          )}
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

interface TimelineEventProps {
  event: GameEvent;
  teams: TeamInfo[];
  isLast: boolean;
}

function TimelineEvent({ event, teams, isLast }: TimelineEventProps) {
  const description = getEventDescription(event, teams);

  return (
    <div className={`relative pl-6 ${isLast ? '' : 'pb-6'}`}>
      {/* Timeline connector line - hidden on last event */}
      {!isLast && <div className="absolute left-[7px] top-3 bottom-0 w-px bg-neutral-700" />}

      {/* Timeline dot */}
      <div
        className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-accent-500 bg-neutral-900"
        style={{ boxShadow: '0 0 6px var(--accent-500)' }}
      />

      {/* Event content */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-medium text-accent-400 uppercase tracking-wide">
            {getEventTypeLabel(event.type)}
          </span>
          <span className="text-xs text-muted">{formatGameDate(event.date)}</span>
        </div>
        {description && <p className="text-secondary text-sm">{description}</p>}
      </div>
    </div>
  );
}

interface CareerTimelineProps {
  events: GameEvent[];
  teams: TeamInfo[];
}

function CareerTimeline({ events, teams }: CareerTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-muted italic">
          No career events yet. Your timeline will populate as you progress through your career.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => (
        <TimelineEvent
          key={event.id}
          event={event}
          teams={teams}
          isLast={index === events.length - 1}
        />
      ))}
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function PlayerWiki() {
  const { gameState, playerTeam } = useDerivedGameState();
  const [allEvents, setAllEvents] = useState<GameEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WikiTab>('stats');

  // Query ALL career events for the player manager
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
          order: 'desc', // Newest first for timeline
        });
        setAllEvents(events);
      } catch (err) {
        setError('Failed to load career history');
        console.error('Failed to query career events:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [gameId]);

  // Extract CAREER_STARTED event from all events
  const careerEvent = allEvents.find((e) => e.type === 'CAREER_STARTED') ?? null;

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
        return <CareerTimeline events={allEvents} teams={gameState.teams} />;
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
