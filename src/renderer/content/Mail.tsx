import { useState, useEffect, useMemo } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { CalendarEventType } from '../../shared/domain';
import type { CalendarEvent } from '../../shared/domain';
import { getFilteredCalendarEvents } from '../utils/calendar-event-utils';
import { formatGameDate } from '../../shared/utils/date-utils';

// ===========================================
// HELPERS
// ===========================================

const DEFAULT_SENDER = 'System';

function getSenderDisplay(email: CalendarEvent): string {
  return email.sender || DEFAULT_SENDER;
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
}

function EmailListItem({ email, isSelected, onSelect }: EmailListItemProps) {
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
    </button>
  );
}

interface EmailListPanelProps {
  emails: CalendarEvent[];
  selectedId: string | null;
  onSelectEmail: (id: string) => void;
}

function EmailListPanel({ emails, selectedId, onSelectEmail }: EmailListPanelProps) {
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
}

function EmailDetailPanel({ email }: EmailDetailPanelProps) {
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

  // Auto-select first email when list changes
  useEffect(() => {
    if (mailItems.length > 0 && !selectedEmailId) {
      setSelectedEmailId(mailItems[0].id);
    }
    // If selected email no longer exists, select first
    if (selectedEmailId && !mailItems.find((e) => e.id === selectedEmailId)) {
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
            />
          </div>
        </div>

        {/* Right panel - Email detail */}
        <div className="flex-1 card overflow-hidden">
          <div className="h-full overflow-y-auto">
            <EmailDetailPanel email={selectedEmail} />
          </div>
        </div>
      </div>
    </div>
  );
}
