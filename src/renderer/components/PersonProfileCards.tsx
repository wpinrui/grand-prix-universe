/**
 * Shared card components for displaying person profiles (drivers, staff).
 * Used by WorldDrivers and WorldStaff pages.
 * Modular design allows reuse across different person types.
 */
import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { FlagIcon } from './FlagIcon';
import { EntityLink } from './EntityLink';
import { ACCENT_TEXT_STYLE, ACCENT_CARD_STYLE } from '../utils/theme-styles';
import { generateFace, type TeamColors } from '../utils/face-generator';
import { seasonToYear } from '../../shared/utils/date-utils';
import { formatAnnualSalary, pluralize } from '../utils/format';
import { getPercentageColorClass } from './ContentPrimitives';

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

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-secondary w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[var(--neutral-700)] rounded-full overflow-hidden">
        <div
          className={`h-full ${getPercentageColorClass(value)} transition-all`}
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
  /** Team ID for EntityLink (required if teamName is provided) */
  teamId?: string | null;
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

/** Returns class names for person dropdown option based on selection state */
const getPersonOptionClasses = (isSelected: boolean) =>
  `px-4 py-2 cursor-pointer transition-colors hover:bg-[var(--neutral-700)] ${
    isSelected ? 'text-[var(--accent-400)]' : 'text-primary'
  }`;

export function PersonHeader({
  name,
  nationality,
  photoUrl,
  teamName,
  teamId,
  roleText,
  subtitle,
  raceNumber,
  personId,
  teamColors,
  allOptions,
  selectedId,
  onSelect,
}: PersonHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const faceContainerRef = useRef<HTMLDivElement>(null);

  const showDropdown = allOptions && allOptions.length > 0 && onSelect;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate face when no photo URL but faces.js props are provided
  useEffect(() => {
    if (!photoUrl && personId && teamColors && faceContainerRef.current) {
      // Clear previous content
      faceContainerRef.current.innerHTML = '';
      generateFace(faceContainerRef.current, personId, nationality, teamColors, 128);
    }
  }, [photoUrl, personId, nationality, teamColors]);

  const toggleDropdown = () => setIsDropdownOpen((prev) => !prev);

  const handleOptionClick = (optionId: string) => {
    setIsDropdownOpen(false);
    onSelect?.(optionId);
  };

  const showFacejs = !photoUrl && personId && teamColors;

  return (
    <div className="flex gap-6">
      {/* Photo */}
      <div className="w-32 h-40 rounded-lg overflow-hidden shrink-0 surface-inset relative">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : showFacejs ? (
          <div ref={faceContainerRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-muted text-sm">No Photo</span>
          </div>
        )}
        {raceNumber !== undefined && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white font-bold text-sm">
            #{raceNumber}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="relative inline-flex items-center gap-3" ref={dropdownRef}>
          <h1
            className={`text-2xl font-bold text-primary ${
              showDropdown ? 'cursor-pointer hover:text-[var(--accent-400)] transition-colors' : ''
            }`}
            onClick={showDropdown ? toggleDropdown : undefined}
          >
            {name}
          </h1>
          {showDropdown && (
            <>
              <button
                type="button"
                onClick={toggleDropdown}
                className="p-1 text-muted hover:text-primary cursor-pointer transition-colors"
                title="Select person"
              >
                <svg
                  className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isDropdownOpen && (
                <ul className="absolute top-full left-0 mt-1 z-50 min-w-64 max-h-80 overflow-auto surface-primary border border-subtle rounded-lg shadow-lg py-1">
                  {allOptions.map((option) => (
                    <li
                      key={option.id}
                      onClick={() => handleOptionClick(option.id)}
                      className={getPersonOptionClasses(option.id === selectedId)}
                    >
                      {option.label}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <FlagIcon country={nationality} size="md" />
        </div>

        <div className="flex items-center gap-3 mt-1">
          <span className="text-secondary font-medium">{roleText}</span>
          {teamName && (
            <>
              <span className="text-muted">·</span>
              {teamId ? (
                <EntityLink type="team" id={teamId} className="text-[var(--accent-400)] hover:underline">
                  {teamName}
                </EntityLink>
              ) : (
                <span className="text-secondary">{teamName}</span>
              )}
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

/**
 * Determines the contract relationship between a person and the player's team.
 */
export function getContractRelationship(
  personTeamId: string | null,
  playerTeamId: string
): ContractRelationship {
  if (personTeamId === null) return 'free-agent';
  if (personTeamId === playerTeamId) return 'own-team';
  return 'other-team';
}

interface ContractPanelProps {
  salary: number;
  contractEndSeason: number;
  currentSeason: number;
  /** Called when contract action button is clicked */
  onEnterTalks?: () => void;
  /** Relationship to this person for button text */
  relationship: ContractRelationship;
}

/** Button text based on contract relationship */
const CONTRACT_BUTTON_TEXT: Record<ContractRelationship, string> = {
  'own-team': 'Renegotiate Contract',
  'other-team': 'Approach Driver',
  'free-agent': 'Offer Contract',
};

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
  const contractEndYear = seasonToYear(contractEndSeason);

  return (
    <StatPanel title="Contract" accent={isExpiring && !isFreeAgent}>
      {isFreeAgent ? (
        <div className="text-amber-400 font-medium">Free Agent</div>
      ) : (
        <div className="space-y-2">
          <StatRow label="Salary" value={formatAnnualSalary(salary)} />
          <StatRow label="Expires" value={`End of ${contractEndYear}`} />
          <StatRow
            label="Years Left"
            value={
              <span className={isExpiring ? 'text-amber-400' : ''}>
                {pluralize(yearsRemaining, 'year')}
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
          {CONTRACT_BUTTON_TEXT[relationship]}
        </button>
      )}
    </StatPanel>
  );
}

