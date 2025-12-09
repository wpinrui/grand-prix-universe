/**
 * Shared card components for displaying person profiles (drivers, staff).
 * Used by WorldDrivers and WorldStaff pages.
 * Modular design allows reuse across different person types.
 */
import { useRef, useEffect, type CSSProperties } from 'react';
import { FlagIcon } from './FlagIcon';
import { ACCENT_TEXT_STYLE, ACCENT_CARD_STYLE } from '../utils/theme-styles';
import { generateFace, type TeamColors } from '../utils/face-generator';

// ===========================================
// ATTRIBUTE BAR COMPONENT
// ===========================================

interface AttributeBarProps {
  label: string;
  value: number; // 0-100
  maxValue?: number;
}

/**
 * Horizontal bar showing an attribute value (0-100 scale)
 */
export function AttributeBar({ label, value, maxValue = 100 }: AttributeBarProps) {
  const percentage = Math.min(100, (value / maxValue) * 100);

  // Color based on value
  const getBarColor = (val: number): string => {
    if (val >= 80) return 'bg-emerald-500';
    if (val >= 60) return 'bg-lime-500';
    if (val >= 40) return 'bg-amber-500';
    if (val >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-secondary w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[var(--neutral-700)] rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor(value)} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-primary w-8 text-right">{value}</span>
    </div>
  );
}

// ===========================================
// PROFILE HEADER COMPONENT
// ===========================================

interface PersonHeaderProps {
  /** Full name of the person */
  name: string;
  /** Country code for flag */
  nationality: string;
  /** Photo URL or null for placeholder */
  photoUrl: string | null;
  /** Current team name or null for free agent */
  teamName: string | null;
  /** Role/position text (e.g., "1st Driver", "Chief Designer") */
  roleText: string;
  /** Optional subtitle (e.g., age) */
  subtitle?: string;
  /** Optional race number for drivers */
  raceNumber?: number;
  /** Unique ID for faces.js generation (required if no photoUrl) */
  personId?: string;
  /** Team colors for faces.js (required if no photoUrl) */
  teamColors?: TeamColors;
  /** All available options for dropdown selector */
  allOptions?: { id: string; label: string }[];
  /** Current selected ID */
  selectedId?: string;
  /** Called when selection changes */
  onSelect?: (id: string) => void;
}

export function PersonHeader({
  name,
  nationality,
  photoUrl,
  teamName,
  roleText,
  subtitle,
  raceNumber,
  personId,
  teamColors,
  allOptions,
  selectedId,
  onSelect,
}: PersonHeaderProps) {
  const showDropdown = allOptions && allOptions.length > 0 && onSelect;
  const faceContainerRef = useRef<HTMLDivElement>(null);

  // Generate face when no photo URL but faces.js props are provided
  useEffect(() => {
    if (!photoUrl && personId && teamColors && faceContainerRef.current) {
      // Clear previous content
      faceContainerRef.current.innerHTML = '';
      generateFace(faceContainerRef.current, personId, nationality, teamColors, 128);
    }
  }, [photoUrl, personId, nationality, teamColors]);

  const showFacejs = !photoUrl && personId && teamColors;

  return (
    <div className="flex gap-6">
      {/* Photo */}
      <div className="w-32 h-40 rounded-lg overflow-hidden shrink-0 surface-inset flex items-center justify-center relative">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : showFacejs ? (
          <div ref={faceContainerRef} className="w-full h-full flex items-center justify-center" />
        ) : (
          <span className="text-muted text-sm">No Photo</span>
        )}
        {raceNumber !== undefined && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white font-bold text-sm">
            #{raceNumber}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          {showDropdown ? (
            <select
              value={selectedId}
              onChange={(e) => onSelect(e.target.value)}
              className="text-2xl font-bold text-primary bg-transparent border-none cursor-pointer hover:text-[var(--accent-400)] transition-colors focus:outline-none"
            >
              {allOptions.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[var(--neutral-800)]">
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="text-2xl font-bold text-primary">{name}</h1>
          )}
          <FlagIcon country={nationality} size="md" />
        </div>

        <div className="flex items-center gap-3 mt-1">
          <span className="text-secondary font-medium">{roleText}</span>
          {teamName && (
            <>
              <span className="text-muted">·</span>
              <span className="text-secondary">{teamName}</span>
            </>
          )}
        </div>

        {subtitle && <p className="text-sm text-muted mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}

// ===========================================
// STAT PANEL COMPONENT
// ===========================================

interface StatPanelProps {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}

export function StatPanel({ title, children, accent = false }: StatPanelProps) {
  const cardStyle: CSSProperties = accent ? ACCENT_CARD_STYLE : {};
  const titleStyle: CSSProperties = accent ? ACCENT_TEXT_STYLE : {};

  return (
    <div className="card p-4" style={cardStyle}>
      <h3
        className="text-sm font-semibold uppercase tracking-wider mb-3"
        style={titleStyle}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ===========================================
// STAT ROW COMPONENT
// ===========================================

interface StatRowProps {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}

export function StatRow({ label, value, muted = false }: StatRowProps) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className={muted ? 'text-muted text-sm' : 'text-secondary text-sm'}>{label}</span>
      <span className={muted ? 'text-muted text-sm' : 'text-primary font-medium'}>{value}</span>
    </div>
  );
}

// ===========================================
// CONTRACT PANEL COMPONENT
// ===========================================

export type ContractRelationship = 'own-team' | 'other-team' | 'free-agent';

interface ContractPanelProps {
  salary: number;
  contractEndSeason: number;
  currentSeason: number;
  /** Called when contract action button is clicked */
  onEnterTalks?: () => void;
  /** Relationship to this person for button text */
  relationship: ContractRelationship;
}

export function ContractPanel({
  salary,
  contractEndSeason,
  currentSeason,
  onEnterTalks,
  relationship,
}: ContractPanelProps) {
  const yearsRemaining = contractEndSeason - currentSeason;
  const isExpiring = yearsRemaining <= 1;
  const isFreeAgent = relationship === 'free-agent';

  // Convert season number to year (season 1 = 2025, etc.)
  const contractEndYear = 2024 + contractEndSeason;

  // Format salary
  const formatSalary = (amount: number): string => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M/yr`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K/yr`;
    return amount === 0 ? 'Free Agent' : `$${amount}/yr`;
  };

  // Button text based on relationship
  const getButtonText = (): string => {
    switch (relationship) {
      case 'own-team':
        return 'Renegotiate Contract';
      case 'other-team':
        return 'Approach Driver';
      case 'free-agent':
        return 'Offer Contract';
    }
  };

  return (
    <StatPanel title="Contract" accent={isExpiring && !isFreeAgent}>
      {isFreeAgent ? (
        <div className="text-amber-400 font-medium">Free Agent</div>
      ) : (
        <div className="space-y-2">
          <StatRow label="Salary" value={formatSalary(salary)} />
          <StatRow label="Expires" value={`End of ${contractEndYear}`} />
          <StatRow
            label="Years Left"
            value={
              <span className={isExpiring ? 'text-amber-400' : ''}>
                {yearsRemaining} {yearsRemaining === 1 ? 'year' : 'years'}
              </span>
            }
          />
        </div>
      )}
      {onEnterTalks && (
        <button
          type="button"
          onClick={onEnterTalks}
          className="mt-4 w-full py-2 px-4 rounded-lg font-medium bg-[var(--accent-600)] text-[var(--accent-contrast)] hover:brightness-110 transition cursor-pointer"
        >
          {getButtonText()}
        </button>
      )}
    </StatPanel>
  );
}

