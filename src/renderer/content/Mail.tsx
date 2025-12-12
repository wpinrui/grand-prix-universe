import { useState, useEffect, useMemo, useCallback } from 'react';
import { User, ChevronDown, ChevronRight, Search, ArrowRight } from 'lucide-react';
import { useDerivedGameState, useMarkEmailRead } from '../hooks';
import { SectionHeading, Dropdown, EntityLink } from '../components';
import { CalendarEventType, EmailCategory, CHASSIS_STAGE_DISPLAY_NAMES, CHASSIS_STAGE_ORDER } from '../../shared/domain';
import { useEntityNavigation } from '../utils/entity-navigation';
import type {
  CalendarEvent,
  Chief,
  Team,
  GameDate,
  ChassisStageCompleteData,
  TechBreakthroughData,
  TechDevelopmentCompleteData,
  HandlingSolutionCompleteData,
} from '../../shared/domain';
import type { DropdownOption } from '../components/Dropdown';
import { getFilteredCalendarEvents } from '../utils/calendar-event-utils';
import { formatGameDate, formatDateGroupHeader, dateKey } from '../../shared/utils/date-utils';
import { getFullName } from '../utils/format';
import { generateFaceDataUri, FREE_AGENT_COLORS } from '../utils/face-generator';
import { ACCENT_BORDERED_BUTTON_STYLE } from '../utils/theme-styles';

// ===========================================
// TYPES
// ===========================================

interface DateGroup {
  date: GameDate;
  key: string;
  emails: CalendarEvent[];
}

// ===========================================
// CATEGORY FILTER OPTIONS
// ===========================================

type CategoryFilterValue = 'all' | EmailCategory;

const CATEGORY_FILTER_OPTIONS: DropdownOption<CategoryFilterValue>[] = [
  { value: 'all', label: 'All Categories' },
  { value: EmailCategory.ChassisStageComplete, label: 'Chassis Stage' },
  { value: EmailCategory.TechBreakthrough, label: 'Tech Breakthrough' },
  { value: EmailCategory.TechDevelopmentComplete, label: 'Tech Development' },
  { value: EmailCategory.HandlingSolutionComplete, label: 'Handling Solution' },
  { value: EmailCategory.TestComplete, label: 'Testing' },
];

// ===========================================
// CATEGORY BADGE CONFIG
// ===========================================

const CATEGORY_BADGE_CONFIG: Record<EmailCategory, { label: string; className: string }> = {
  [EmailCategory.ChassisStageComplete]: {
    label: 'Chassis',
    className: 'bg-blue-600/20 text-blue-400',
  },
  [EmailCategory.TechBreakthrough]: {
    label: 'Breakthrough',
    className: 'bg-emerald-600/20 text-emerald-400',
  },
  [EmailCategory.TechDevelopmentComplete]: {
    label: 'Development',
    className: 'bg-purple-600/20 text-purple-400',
  },
  [EmailCategory.HandlingSolutionComplete]: {
    label: 'Handling',
    className: 'bg-amber-600/20 text-amber-400',
  },
  [EmailCategory.TestComplete]: {
    label: 'Testing',
    className: 'bg-cyan-600/20 text-cyan-400',
  },
  [EmailCategory.PartReady]: {
    label: 'Parts',
    className: 'bg-orange-600/20 text-orange-400',
  },
  [EmailCategory.PostRaceRepair]: {
    label: 'Repairs',
    className: 'bg-red-600/20 text-red-400',
  },
  [EmailCategory.SpecRelease]: {
    label: 'Engine',
    className: 'bg-indigo-600/20 text-indigo-400',
  },
};

// ===========================================
// HELPERS
// ===========================================

const DEFAULT_SENDER = 'System';

function getSenderDisplay(email: CalendarEvent): string {
  return email.sender || DEFAULT_SENDER;
}

function groupEmailsByDate(emails: CalendarEvent[]): DateGroup[] {
  const groupMap = new Map<string, DateGroup>();

  for (const email of emails) {
    const key = dateKey(email.date);
    const existing = groupMap.get(key);
    if (existing) {
      existing.emails.push(email);
    } else {
      groupMap.set(key, { date: email.date, key, emails: [email] });
    }
  }

  // Convert to array (already sorted by date since emails come sorted)
  return Array.from(groupMap.values());
}

// ===========================================
// SENDER AVATAR COMPONENT
// ===========================================

interface SenderAvatarProps {
  email: CalendarEvent;
  chiefs: Chief[];
  teams: Team[];
  size?: number;
}

function SenderAvatar({ email, chiefs, teams, size = 32 }: SenderAvatarProps) {
  const chief = email.senderId ? chiefs.find((c) => c.id === email.senderId) : null;
  const team = chief?.teamId ? teams.find((t) => t.id === chief.teamId) : null;

  // Generate face data URI for chief avatars
  const faceDataUri = useMemo(() => {
    if (!chief) return null;
    const teamColors = team
      ? { primary: team.primaryColor, secondary: team.secondaryColor }
      : FREE_AGENT_COLORS;
    // Chiefs don't have nationality in the data model, use empty string for default appearance
    return generateFaceDataUri(chief.id, '', teamColors);
  }, [chief, team]);

  // No senderId or chief not found - show fallback icon
  if (!chief || !faceDataUri) {
    return (
      <div
        className="rounded-full bg-[var(--neutral-700)] flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <User size={size * 0.6} className="text-muted" />
      </div>
    );
  }

  return (
    <img
      src={faceDataUri}
      alt={getFullName(chief)}
      className="rounded-full overflow-hidden shrink-0 bg-[var(--neutral-700)] object-contain"
      style={{ width: size, height: size }}
    />
  );
}

// ===========================================
// CONSTANTS
// ===========================================

const MAX_MAIL_ITEMS = 50;

// ===========================================
// BADGE COMPONENTS
// ===========================================

interface CategoryBadgeProps {
  category: EmailCategory | undefined;
}

function CategoryBadge({ category }: CategoryBadgeProps) {
  if (!category) return null;
  const config = CATEGORY_BADGE_CONFIG[category];
  if (!config) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${config.className}`}>
      {config.label}
    </span>
  );
}

function ImportantBadge() {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400">
      Important
    </span>
  );
}

// ===========================================
// LEFT PANEL - EMAIL LIST
// ===========================================

interface EmailListItemProps {
  email: CalendarEvent;
  isSelected: boolean;
  onSelect: () => void;
  chiefs: Chief[];
  teams: Team[];
}

function EmailListItem({ email, isSelected, onSelect, chiefs, teams }: EmailListItemProps) {
  const isUnread = !email.read;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-[var(--accent-900)]/40 border-l-2 border-l-[var(--accent-500)]'
          : 'hover:bg-[var(--neutral-800)]/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Unread indicator */}
        <div className="w-2 shrink-0 pt-3">
          {isUnread && <div className="w-2 h-2 rounded-full bg-[var(--accent-500)]" />}
        </div>
        <SenderAvatar email={email} chiefs={chiefs} teams={teams} size={32} />
        <div className="flex-1 min-w-0">
          {/* Sender + time row */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${isSelected || isUnread ? 'text-primary font-medium' : 'text-secondary'}`}>
              {getSenderDisplay(email)}
            </span>
            <span className="text-xs text-muted shrink-0">
              {formatGameDate(email.date, 'short')}
            </span>
          </div>
          {/* Subject row */}
          <p className={`text-sm truncate mt-0.5 ${isSelected ? 'text-secondary' : 'text-muted'} ${isUnread ? 'font-medium' : ''}`}>
            {email.subject}
          </p>
          {/* Category badge + Critical badge */}
          <div className="flex items-center gap-2 mt-1">
            <CategoryBadge category={email.emailCategory} />
            {email.critical && <ImportantBadge />}
          </div>
        </div>
      </div>
    </button>
  );
}

// ===========================================
// DATE GROUP HEADER
// ===========================================

interface DateGroupHeaderProps {
  group: DateGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

function DateGroupHeader({ group, isExpanded, onToggle }: DateGroupHeaderProps) {
  const itemCount = group.emails.length;
  const itemText = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 bg-[var(--neutral-800)] cursor-pointer hover:bg-[var(--neutral-700)] transition-colors"
    >
      <span className="text-sm font-medium text-primary">
        {formatDateGroupHeader(group.date)} ({itemText})
      </span>
      {isExpanded ? (
        <ChevronDown size={16} className="text-muted" />
      ) : (
        <ChevronRight size={16} className="text-muted" />
      )}
    </button>
  );
}

interface EmailListPanelProps {
  groups: DateGroup[];
  selectedId: string | null;
  onSelectEmail: (id: string) => void;
  chiefs: Chief[];
  teams: Team[];
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
}

function EmailListPanel({
  groups,
  selectedId,
  onSelectEmail,
  chiefs,
  teams,
  collapsedGroups,
  onToggleGroup,
}: EmailListPanelProps) {
  if (groups.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-secondary">No messages yet.</p>
        <p className="text-muted text-sm mt-1">
          Messages from departments and staff will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => {
        const isExpanded = !collapsedGroups.has(group.key);
        return (
          <div key={group.key}>
            <DateGroupHeader
              group={group}
              isExpanded={isExpanded}
              onToggle={() => onToggleGroup(group.key)}
            />
            {isExpanded && (
              <div className="divide-y divide-subtle">
                {group.emails.map((email) => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    isSelected={selectedId === email.id}
                    onSelect={() => onSelectEmail(email.id)}
                    chiefs={chiefs}
                    teams={teams}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===========================================
// RICH DETAIL RENDERERS
// ===========================================

// Shared helper to find chief by ID
function findChief(chiefId: string | undefined, chiefs: Chief[]): Chief | null {
  return chiefId ? chiefs.find((c) => c.id === chiefId) ?? null : null;
}

// Shared component for chief designer link
function ChiefDesignerLink({ chief }: { chief: Chief | null }) {
  if (!chief) return null;
  return (
    <div className="text-sm text-secondary">
      Chief Designer:{' '}
      <EntityLink type="chief" id={chief.id}>
        {getFullName(chief)}
      </EntityLink>
    </div>
  );
}

// Shared component for View Design Screen button
function ViewDesignButton() {
  const navigateToEntity = useEntityNavigation();
  return (
    <button
      type="button"
      onClick={() => navigateToEntity('engineering-design', '')}
      className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors"
      style={ACCENT_BORDERED_BUTTON_STYLE}
    >
      View Design Screen
      <ArrowRight size={16} />
    </button>
  );
}

interface ChassisStageDetailProps {
  data: ChassisStageCompleteData;
  chiefs: Chief[];
}

function ChassisStageDetail({ data, chiefs }: ChassisStageDetailProps) {
  const chief = findChief(data.chiefId, chiefs);

  return (
    <div className="space-y-4">
      {/* Stage progress indicator */}
      <div className="p-4 rounded-lg bg-[var(--neutral-800)]">
        <div className="text-xs text-muted mb-2">Chassis Design Progress</div>
        <div className="flex items-center gap-2">
          {CHASSIS_STAGE_ORDER.map((stage, idx) => {
            const isComplete = idx <= data.completedStageIndex;
            const isCurrent = idx === data.completedStageIndex;
            const stageName = CHASSIS_STAGE_DISPLAY_NAMES[stage];
            return (
              <div key={stage} className="flex-1">
                <div
                  className={`h-2 rounded ${
                    isComplete ? 'bg-emerald-500' : 'bg-[var(--neutral-600)]'
                  } ${isCurrent ? 'ring-2 ring-emerald-400' : ''}`}
                />
                <div className={`text-xs mt-1 text-center ${isComplete ? 'text-emerald-400' : 'text-muted'}`}>
                  {stageName}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-[var(--neutral-800)]">
          <div className="text-xs text-muted">Target Year</div>
          <div className="text-lg font-medium text-primary">{data.chassisYear}</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--neutral-800)]">
          <div className="text-xs text-muted">Efficiency Rating</div>
          <div className="text-lg font-medium text-primary">{data.efficiency.toFixed(1)}</div>
        </div>
      </div>

      <ChiefDesignerLink chief={chief} />
      <ViewDesignButton />
    </div>
  );
}

interface TechBreakthroughDetailProps {
  data: TechBreakthroughData;
  chiefs: Chief[];
}

function TechBreakthroughDetail({ data, chiefs }: TechBreakthroughDetailProps) {
  const chief = findChief(data.chiefId, chiefs);

  return (
    <div className="space-y-4">
      {/* Improvement highlight */}
      <div className="p-4 rounded-lg bg-emerald-900/30 border border-emerald-600/30">
        <div className="text-xs text-emerald-400 mb-1">Breakthrough Discovered</div>
        <div className="text-2xl font-bold text-emerald-400">+{data.statIncrease}</div>
        <div className="text-sm text-secondary mt-1">
          {data.componentName} {data.attributeName}
        </div>
      </div>

      {/* Development time */}
      <div className="p-3 rounded-lg bg-[var(--neutral-800)]">
        <div className="text-xs text-muted">Estimated Development Time</div>
        <div className="text-lg font-medium text-primary">~{data.estimatedDays} days</div>
      </div>

      <ChiefDesignerLink chief={chief} />
      <ViewDesignButton />
    </div>
  );
}

interface TechDevelopmentDetailProps {
  data: TechDevelopmentCompleteData;
  chiefs: Chief[];
}

function TechDevelopmentDetail({ data, chiefs }: TechDevelopmentDetailProps) {
  const chief = findChief(data.chiefId, chiefs);

  return (
    <div className="space-y-4">
      {/* Completion highlight */}
      <div className="p-4 rounded-lg bg-purple-900/30 border border-purple-600/30">
        <div className="text-xs text-purple-400 mb-1">Development Complete</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-purple-400">{data.newValue}</span>
          <span className="text-sm text-purple-300">(+{data.statIncrease})</span>
        </div>
        <div className="text-sm text-secondary mt-1">
          {data.componentName} {data.attributeName}
        </div>
      </div>

      {/* Progress bar */}
      <div className="p-3 rounded-lg bg-[var(--neutral-800)]">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">{data.componentName} {data.attributeName}</span>
          <span className="text-primary">{data.newValue}/100</span>
        </div>
        <div className="h-2 bg-[var(--neutral-600)] rounded overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all"
            style={{ width: `${Math.min(data.newValue, 100)}%` }}
          />
        </div>
      </div>

      <ChiefDesignerLink chief={chief} />
      <ViewDesignButton />
    </div>
  );
}

interface HandlingSolutionDetailProps {
  data: HandlingSolutionCompleteData;
  chiefs: Chief[];
}

function HandlingSolutionDetail({ data, chiefs }: HandlingSolutionDetailProps) {
  const chief = findChief(data.chiefId, chiefs);

  return (
    <div className="space-y-4">
      {/* Solution highlight */}
      <div className="p-4 rounded-lg bg-amber-900/30 border border-amber-600/30">
        <div className="text-xs text-amber-400 mb-1">Handling Problem Solved</div>
        <div className="text-lg font-bold text-amber-400">{data.problemName}</div>
        <div className="text-sm text-secondary mt-1">
          Handling improved by +{data.handlingImprovement} points
        </div>
      </div>

      <ChiefDesignerLink chief={chief} />
      <ViewDesignButton />
    </div>
  );
}

// ===========================================
// RIGHT PANEL - EMAIL DETAIL
// ===========================================

interface EmailDetailPanelProps {
  email: CalendarEvent | null;
  chiefs: Chief[];
  teams: Team[];
}

function EmailDetailPanel({ email, chiefs, teams }: EmailDetailPanelProps) {
  if (!email) {
    return (
      <div className="h-full flex items-center justify-center text-muted">
        <p>Select an email to view details</p>
      </div>
    );
  }

  // Render rich content based on email data category
  const renderRichContent = () => {
    const { data } = email;
    if (!data) return null;

    switch (data.category) {
      case EmailCategory.ChassisStageComplete:
        return <ChassisStageDetail data={data} chiefs={chiefs} />;
      case EmailCategory.TechBreakthrough:
        return <TechBreakthroughDetail data={data} chiefs={chiefs} />;
      case EmailCategory.TechDevelopmentComplete:
        return <TechDevelopmentDetail data={data} chiefs={chiefs} />;
      case EmailCategory.HandlingSolutionComplete:
        return <HandlingSolutionDetail data={data} chiefs={chiefs} />;
      default:
        return null;
    }
  };

  const richContent = renderRichContent();

  return (
    <div className="p-4">
      {/* Header */}
      <div className="border-b border-subtle pb-3 mb-4">
        <div className="flex items-start gap-4">
          <SenderAvatar email={email} chiefs={chiefs} teams={teams} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-primary font-medium">{getSenderDisplay(email)}</h3>
                <p className="text-xs text-muted mt-0.5">{formatGameDate(email.date)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CategoryBadge category={email.emailCategory} />
                {email.critical && <ImportantBadge />}
              </div>
            </div>
          </div>
        </div>
        <h2 className="text-lg text-primary mt-3">{email.subject}</h2>
      </div>

      {/* Rich content or fallback body */}
      {richContent ? (
        <div className="space-y-4">
          {/* Body text */}
          {email.body && (
            <div className="text-secondary text-sm leading-relaxed whitespace-pre-wrap">
              {email.body}
            </div>
          )}
          {/* Rich detail content */}
          {richContent}
        </div>
      ) : email.body ? (
        <div className="text-secondary text-sm leading-relaxed whitespace-pre-wrap">
          {email.body}
        </div>
      ) : (
        <p className="text-muted text-sm italic">No additional details.</p>
      )}
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Mail() {
  const { gameState } = useDerivedGameState();
  const markEmailRead = useMarkEmailRead();
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>('all');

  // Handler to select an email and mark it as read
  const handleSelectEmail = useCallback(
    (emailId: string) => {
      setSelectedEmailId(emailId);
      // Mark as read if not already
      const email = gameState?.calendarEvents.find((e) => e.id === emailId);
      if (email && !email.read) {
        markEmailRead.mutate(emailId);
      }
    },
    [gameState?.calendarEvents, markEmailRead]
  );

  const allMailItems = useMemo(() => {
    if (!gameState) return [];
    return getFilteredCalendarEvents(
      gameState.calendarEvents,
      gameState.currentDate,
      CalendarEventType.Email,
      MAX_MAIL_ITEMS
    );
  }, [gameState]);

  // Apply search and category filters
  const mailItems = useMemo(() => {
    let filtered = allMailItems;

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((e) => e.emailCategory === categoryFilter);
    }

    // Search filter (case-insensitive, matches subject or sender)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.subject.toLowerCase().includes(query) ||
          (e.sender && e.sender.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [allMailItems, categoryFilter, searchQuery]);

  const dateGroups = useMemo(() => groupEmailsByDate(mailItems), [mailItems]);

  // Auto-select first email, or reset if current selection becomes invalid
  useEffect(() => {
    const selectionIsValid = selectedEmailId && mailItems.some((e) => e.id === selectedEmailId);
    if (!selectionIsValid) {
      setSelectedEmailId(mailItems.length > 0 ? mailItems[0].id : null);
    }
  }, [mailItems, selectedEmailId]);

  const selectedEmail = useMemo(
    () => mailItems.find((e) => e.id === selectedEmailId) || null,
    [mailItems, selectedEmailId]
  );

  const handleToggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading mail...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SectionHeading>Mail</SectionHeading>

      {/* Search and filter toolbar */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search bar */}
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 surface-primary border border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)]"
          />
        </div>
        {/* Category filter */}
        <Dropdown
          id="mail-category-filter"
          options={CATEGORY_FILTER_OPTIONS}
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v)}
        />
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left panel - Email list */}
        <div className="w-80 shrink-0 card overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <EmailListPanel
              groups={dateGroups}
              selectedId={selectedEmailId}
              onSelectEmail={handleSelectEmail}
              chiefs={gameState.chiefs}
              teams={gameState.teams}
              collapsedGroups={collapsedGroups}
              onToggleGroup={handleToggleGroup}
            />
          </div>
        </div>

        {/* Right panel - Email detail */}
        <div className="flex-1 card overflow-hidden">
          <div className="h-full overflow-y-auto">
            <EmailDetailPanel
              email={selectedEmail}
              chiefs={gameState.chiefs}
              teams={gameState.teams}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
