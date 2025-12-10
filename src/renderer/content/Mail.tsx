import { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'lucide-react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { CalendarEventType } from '../../shared/domain';
import type { CalendarEvent, Chief, Team } from '../../shared/domain';
import { getFilteredCalendarEvents } from '../utils/calendar-event-utils';
import { formatGameDate } from '../../shared/utils/date-utils';
import { generateFace, FREE_AGENT_COLORS } from '../utils/face-generator';

// ===========================================
// HELPERS
// ===========================================

const DEFAULT_SENDER = 'System';

function getSenderDisplay(email: CalendarEvent): string {
  return email.sender || DEFAULT_SENDER;
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
  const faceContainerRef = useRef<HTMLDivElement>(null);
  const chief = email.senderId ? chiefs.find((c) => c.id === email.senderId) : null;
  const team = chief?.teamId ? teams.find((t) => t.id === chief.teamId) : null;

  useEffect(() => {
    if (chief && faceContainerRef.current) {
      faceContainerRef.current.innerHTML = '';
      const teamColors = team
        ? { primary: team.primaryColor, secondary: team.secondaryColor }
        : FREE_AGENT_COLORS;
      // Chiefs don't have nationality in the data model, use empty string for default appearance
      generateFace(faceContainerRef.current, chief.id, '', teamColors, size);
    }
  }, [chief, team, size]);

  // No senderId or chief not found - show fallback icon
  if (!chief) {
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
    <div
      ref={faceContainerRef}
      className="rounded-full overflow-hidden shrink-0 bg-[var(--neutral-700)]"
      style={{ width: size, height: size }}
    />
  );
}

// ===========================================
// CONSTANTS
// ===========================================

const MAX_MAIL_ITEMS = 50;

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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 border-b border-subtle last:border-b-0 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-[var(--accent-900)]/40 border-l-2 border-l-[var(--accent-500)]'
          : 'hover:bg-[var(--neutral-800)]/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <SenderAvatar email={email} chiefs={chiefs} teams={teams} size={32} />
        <div className="flex-1 min-w-0">
          {/* Sender + time row */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${isSelected ? 'text-primary font-medium' : 'text-secondary'}`}>
              {getSenderDisplay(email)}
            </span>
            <span className="text-xs text-muted shrink-0">
              {formatGameDate(email.date, 'short')}
            </span>
          </div>
          {/* Subject row */}
          <p className={`text-sm truncate mt-0.5 ${isSelected ? 'text-secondary' : 'text-muted'}`}>
            {email.subject}
          </p>
          {/* Critical badge */}
          {email.critical && (
            <span className="text-xs text-amber-400 mt-1 inline-block">Important</span>
          )}
        </div>
      </div>
    </button>
  );
}

interface EmailListPanelProps {
  emails: CalendarEvent[];
  selectedId: string | null;
  onSelectEmail: (id: string) => void;
  chiefs: Chief[];
  teams: Team[];
}

function EmailListPanel({ emails, selectedId, onSelectEmail, chiefs, teams }: EmailListPanelProps) {
  if (emails.length === 0) {
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
    <div className="divide-y divide-subtle">
      {emails.map((email) => (
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
              {email.critical && (
                <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-amber-600/20 text-amber-400 rounded">
                  Important
                </span>
              )}
            </div>
          </div>
        </div>
        <h2 className="text-lg text-primary mt-3">{email.subject}</h2>
      </div>

      {/* Body */}
      {email.body ? (
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
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const mailItems = useMemo(() => {
    if (!gameState) return [];
    return getFilteredCalendarEvents(
      gameState.calendarEvents,
      gameState.currentDate,
      CalendarEventType.Email,
      MAX_MAIL_ITEMS
    );
  }, [gameState]);

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

      {/* Two-panel layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left panel - Email list */}
        <div className="w-80 shrink-0 card overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <EmailListPanel
              emails={mailItems}
              selectedId={selectedEmailId}
              onSelectEmail={setSelectedEmailId}
              chiefs={gameState.chiefs}
              teams={gameState.teams}
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
