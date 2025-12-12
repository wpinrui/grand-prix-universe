/**
 * Home page widget components
 * Reusable widgets for the home page dashboard
 */
import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, Mail, Newspaper, ChevronRight } from 'lucide-react';
import { FlagIcon } from './FlagIcon';
import { ProgressBar } from './ContentPrimitives';
import { NEWS_SOURCE_COLORS } from '../utils/theme-styles';
import { formatCurrency, formatOrdinal, getFullName } from '../utils/format';
import { formatGameDate, daysBetween, seasonToYear } from '../../shared/utils/date-utils';
import type { HomePageAlert, AlertSeverity } from '../utils/home-alerts';
import {
  ChassisDesignStage,
  NewsSource,
  type Team,
  type Driver,
  type DriverStanding,
  type ConstructorStanding,
  type CalendarEntry,
  type Circuit,
  type CalendarEvent,
  type DesignState,
  type PendingPart,
  type GameDate,
} from '../../shared/domain';

// ===========================================
// CONSTANTS
// ===========================================

const CHASSIS_STAGE_LABELS: Record<ChassisDesignStage, string> = {
  [ChassisDesignStage.Design]: 'Design',
  [ChassisDesignStage.CFD]: 'CFD',
  [ChassisDesignStage.Model]: 'Model',
  [ChassisDesignStage.WindTunnel]: 'Wind Tunnel',
};

const NEWS_SOURCE_LABELS: Record<NewsSource, string> = {
  [NewsSource.F1Official]: 'F1 Official',
  [NewsSource.TheRace]: 'The Race',
  [NewsSource.LocalMedia]: 'Local Media',
  [NewsSource.PitlaneInsider]: 'Pitlane Insider',
  [NewsSource.TechAnalysis]: 'Tech Analysis',
  [NewsSource.PaddockRumors]: 'Paddock Rumors',
  [NewsSource.FanVoice]: 'Fan Voice',
};

// ===========================================
// ALERT SEVERITY STYLING
// ===========================================

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  critical: <AlertCircle className="w-4 h-4 text-red-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

const SEVERITY_BORDER_CLASS: Record<AlertSeverity, string> = {
  critical: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
};

// ===========================================
// SECTION HEADING
// ===========================================

interface WidgetHeadingProps {
  children: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function WidgetHeading({ children, action }: WidgetHeadingProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h3>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-xs text-[var(--accent-400)] hover:text-[var(--accent-300)] cursor-pointer flex items-center gap-1"
        >
          {action.label}
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ===========================================
// CHAMPIONSHIP STANDINGS WIDGET
// ===========================================

interface StandingsTableProps {
  type: 'wdc' | 'wcc';
  standings: (DriverStanding | ConstructorStanding)[];
  highlightIds: string[];
  drivers?: Driver[];
  teams?: Team[];
  limit?: number;
  onViewAll: () => void;
}

export function StandingsTable({
  type,
  standings,
  highlightIds,
  drivers,
  teams,
  limit = 10,
  onViewAll,
}: StandingsTableProps) {
  const displayStandings = standings.slice(0, limit);
  const title = type === 'wdc' ? 'Drivers' : 'Constructors';

  return (
    <div className="card p-4">
      <WidgetHeading action={{ label: 'View All', onClick: onViewAll }}>{title}</WidgetHeading>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted border-b border-subtle">
            <th className="text-left py-1 w-8">Pos</th>
            <th className="text-left py-1">{type === 'wdc' ? 'Driver' : 'Team'}</th>
            <th className="text-right py-1 w-12">Pts</th>
          </tr>
        </thead>
        <tbody>
          {displayStandings.map((standing) => {
            const id = type === 'wdc'
              ? (standing as DriverStanding).driverId
              : (standing as ConstructorStanding).teamId;
            const isHighlighted = highlightIds.includes(id);

            let name = '';
            if (type === 'wdc' && drivers) {
              const driver = drivers.find((d) => d.id === id);
              name = driver ? `${driver.firstName.charAt(0)}. ${driver.lastName}` : id;
            } else if (type === 'wcc' && teams) {
              const team = teams.find((t) => t.id === id);
              name = team?.name ?? id;
            }

            return (
              <tr
                key={id}
                className={`border-b border-subtle last:border-b-0 ${
                  isHighlighted ? 'bg-[var(--accent-900)]/30' : ''
                }`}
              >
                <td className="py-1.5 text-muted">{standing.position}</td>
                <td className={`py-1.5 ${isHighlighted ? 'text-[var(--accent-400)] font-medium' : 'text-primary'}`}>
                  {name}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums text-secondary">
                  {standing.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===========================================
// NEXT RACE WIDGET
// ===========================================

interface NextRaceCardProps {
  nextRace: CalendarEntry;
  circuit: Circuit | undefined;
  currentDate: GameDate;
  totalRaces: number;
  onViewRaces: () => void;
}

export function NextRaceCard({ nextRace, circuit, currentDate, totalRaces, onViewRaces }: NextRaceCardProps) {
  const daysUntil = useMemo(() => {
    if (!circuit) return 0;
    // Calculate days until race
    const raceDate = { year: currentDate.year, month: nextRace.raceNumber, day: 1 }; // Simplified
    return Math.max(0, daysBetween(currentDate, raceDate));
  }, [currentDate, nextRace, circuit]);

  return (
    <div
      className="card p-5 cursor-pointer hover:border-[var(--accent-500)]/50 transition-colors"
      onClick={onViewRaces}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Next Race</div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-primary">{circuit?.name ?? 'Unknown Circuit'}</h2>
            {circuit && <FlagIcon country={circuit.country} size="md" />}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Race {nextRace.raceNumber} of {totalRaces}</div>
          <div className="text-sm text-[var(--accent-400)] font-medium mt-1">
            {daysUntil > 0 ? `${daysUntil} days` : 'Race Day!'}
          </div>
        </div>
      </div>

      {/* Weather placeholder */}
      <div className="flex items-center gap-4 text-sm text-muted">
        <span>Weather: TBD</span>
      </div>
    </div>
  );
}

// ===========================================
// TEAM STATUS GRID
// ===========================================

interface TeamStatusGridProps {
  budget: number;
  wccPosition: number | undefined;
  points: number;
  wins: number;
}

export function TeamStatusGrid({ budget, wccPosition, points, wins }: TeamStatusGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="card p-4 border-l-2 border-l-[var(--accent-500)]">
        <div className="text-xs text-muted uppercase tracking-wider mb-1">Budget</div>
        <div className="text-lg font-bold text-[var(--accent-400)]">{formatCurrency(budget)}</div>
      </div>
      <div className="card p-4">
        <div className="text-xs text-muted uppercase tracking-wider mb-1">Championship</div>
        <div className="text-lg font-bold text-primary">P{wccPosition ?? '-'}</div>
      </div>
      <div className="card p-4">
        <div className="text-xs text-muted uppercase tracking-wider mb-1">Points</div>
        <div className="text-lg font-bold text-primary">{points}</div>
      </div>
      <div className="card p-4">
        <div className="text-xs text-muted uppercase tracking-wider mb-1">Wins</div>
        <div className="text-lg font-bold text-primary">{wins}</div>
      </div>
    </div>
  );
}

// ===========================================
// DESIGN PROGRESS WIDGETS
// ===========================================

interface DesignProgressSectionProps {
  designState: DesignState;
  pendingParts: PendingPart[];
  currentDate: GameDate;
  onViewDesign: () => void;
}

export function DesignProgressSection({
  designState,
  pendingParts,
  currentDate: _currentDate,
  onViewDesign,
}: DesignProgressSectionProps) {
  const { nextYearChassis, activeTechnologyProjects, currentYearChassis } = designState;

  // Find current chassis stage
  const currentStage = nextYearChassis?.stages.find((s) => !s.completed);
  const activeHandlingProblem = currentYearChassis.activeDesignProblem;

  // Check if there's any active design work
  const hasActiveWork =
    (nextYearChassis && currentStage) ||
    activeTechnologyProjects.length > 0 ||
    activeHandlingProblem;

  if (!hasActiveWork && pendingParts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <WidgetHeading action={{ label: 'View Design', onClick: onViewDesign }}>Design Progress</WidgetHeading>

      {/* Next Year Chassis */}
      {nextYearChassis && currentStage && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary">
              {seasonToYear(nextYearChassis.targetSeason)} Chassis
            </span>
            <span className="text-xs text-muted">
              {CHASSIS_STAGE_LABELS[currentStage.stage]}
            </span>
          </div>
          <ProgressBar value={currentStage.progress * 10} max={100} />
        </div>
      )}

      {/* Technology Projects */}
      {activeTechnologyProjects.map((project) => (
        <div key={`${project.component}-${project.attribute}`} className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary capitalize">
              {project.component} {project.attribute}
            </span>
            <span className="text-xs text-muted">
              {project.phase === 'discovery' ? 'Discovery' : `+${project.payoff ?? '?'}`}
            </span>
          </div>
          {project.phase === 'development' && project.workUnitsRequired && (
            <ProgressBar
              value={project.workUnitsCompleted}
              max={project.workUnitsRequired}
            />
          )}
          {project.phase === 'discovery' && (
            <div className="text-xs text-muted italic">Awaiting breakthrough...</div>
          )}
        </div>
      ))}

      {/* Handling Solution */}
      {activeHandlingProblem && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary">
              Handling: {activeHandlingProblem.problem.replace(/([A-Z])/g, ' $1').trim()}
            </span>
          </div>
          <ProgressBar value={activeHandlingProblem.solutionProgress * 10} max={100} />
        </div>
      )}

      {/* Pending Parts (ready to install) */}
      {pendingParts.filter((p) => p.installedOnCars.length < 2).map((part) => (
        <div key={part.id} className="card p-4 border-l-2 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary">{part.item}</span>
            <span className="text-xs text-emerald-400">Ready to install</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===========================================
// DRIVER CARDS
// ===========================================

interface DriversAtGlanceProps {
  drivers: Driver[];
  standings: Map<string, DriverStanding>;
  onViewDriver: (driverId: string) => void;
}

export function DriversAtGlance({ drivers, standings, onViewDriver }: DriversAtGlanceProps) {
  if (drivers.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {drivers.map((driver) => {
        const standing = standings.get(driver.id);
        return (
          <div
            key={driver.id}
            className="card p-4 cursor-pointer hover:border-[var(--accent-500)]/50 transition-colors"
            onClick={() => onViewDriver(driver.id)}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-14 rounded-lg overflow-hidden shrink-0 surface-inset flex items-center justify-center">
                {driver.photoUrl ? (
                  <img
                    src={driver.photoUrl}
                    alt={getFullName(driver)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted">No Photo</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-primary truncate">{getFullName(driver)}</div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-[var(--accent-400)]">
                    {standing ? formatOrdinal(standing.position) : '-'}
                  </span>
                  <span className="text-muted">{standing?.points ?? 0} pts</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===========================================
// ALERTS WIDGET
// ===========================================

interface AlertsWidgetProps {
  alerts: HomePageAlert[];
  onAlertClick: (section: string, subItem: string) => void;
}

export function AlertsWidget({ alerts, onAlertClick }: AlertsWidgetProps) {
  if (alerts.length === 0) {
    return (
      <div className="card p-4 text-center">
        <span className="text-sm text-muted">No alerts at this time</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.slice(0, 5).map((alert) => (
        <div
          key={alert.id}
          className={`card p-3 border-l-2 ${SEVERITY_BORDER_CLASS[alert.severity]} cursor-pointer hover:bg-[var(--neutral-800)]/50 transition-colors`}
          onClick={() => onAlertClick(alert.action.section, alert.action.subItem)}
        >
          <div className="flex items-start gap-2">
            {SEVERITY_ICON[alert.severity]}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted mb-0.5">{alert.category}</div>
              <div className="text-sm text-primary">{alert.message}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ===========================================
// MAIL WIDGET
// ===========================================

interface MailWidgetProps {
  emails: CalendarEvent[];
  currentDate: GameDate;
  onViewAll: () => void;
  onEmailClick: (emailId: string) => void;
}

export function MailWidget({ emails, currentDate: _currentDate, onViewAll, onEmailClick }: MailWidgetProps) {
  const unreadEmails = emails.slice(0, 5);
  const unreadCount = emails.length;

  return (
    <div className="card p-4">
      <WidgetHeading
        action={{
          label: unreadCount > 0 ? `View All (${unreadCount})` : 'View All',
          onClick: onViewAll,
        }}
      >
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <span>Unread Mail</span>
        </div>
      </WidgetHeading>

      {unreadEmails.length === 0 ? (
        <div className="text-sm text-muted text-center py-2">No unread mail</div>
      ) : (
        <div className="space-y-2">
          {unreadEmails.map((email) => (
            <div
              key={email.id}
              className="flex items-start gap-2 py-2 border-b border-subtle last:border-b-0 cursor-pointer hover:bg-[var(--neutral-800)]/30 -mx-2 px-2 rounded"
              onClick={() => onEmailClick(email.id)}
            >
              <div className="w-2 h-2 rounded-full bg-[var(--accent-500)] mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-primary truncate">{email.subject}</div>
                <div className="text-xs text-muted">{formatGameDate(email.date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================
// NEWS WIDGET
// ===========================================

interface NewsWidgetProps {
  headlines: CalendarEvent[];
  onViewAll: () => void;
}

export function NewsWidget({ headlines, onViewAll }: NewsWidgetProps) {
  return (
    <div className="card p-4">
      <WidgetHeading action={{ label: 'View All', onClick: onViewAll }}>
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          <span>Latest Headlines</span>
        </div>
      </WidgetHeading>

      {headlines.length === 0 ? (
        <div className="text-sm text-muted text-center py-2">No recent news</div>
      ) : (
        <div className="space-y-3">
          {headlines.map((headline) => {
            const sourceColors = headline.newsSource
              ? NEWS_SOURCE_COLORS[headline.newsSource]
              : { bg: 'bg-neutral-700', text: 'text-neutral-300' };

            return (
              <div key={headline.id} className="border-b border-subtle last:border-b-0 pb-3 last:pb-0">
                {headline.newsSource && (
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mb-1 ${sourceColors.bg} ${sourceColors.text}`}
                  >
                    {NEWS_SOURCE_LABELS[headline.newsSource]}
                  </span>
                )}
                <div className="text-sm text-primary">{headline.subject}</div>
                <div className="text-xs text-muted mt-1">{formatGameDate(headline.date)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
