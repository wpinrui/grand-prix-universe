import { useState, useMemo } from 'react';
import { Dropdown } from '../components';
import type { DropdownOption } from '../components';
import { ACCENT_CARD_STYLE, ACCENT_BORDERED_BUTTON_STYLE, GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatCurrency, SPONSOR_TIER_LABELS } from '../utils/format';
import { seasonToYear } from '../../shared/utils/date-utils';
import {
  NegotiationPhase,
  type Sponsor,
  type SponsorNegotiation,
  type SponsorContractTerms,
  type ActiveSponsorDeal,
} from '../../shared/domain';
import {
  computeAcceptanceProbabilities,
  getLikelihoodBand,
  getReputationStanding,
  getRequiredPosition,
  computeReputationRatio,
  calculateWillingPayment,
  getPlacementForTier,
  TIER_PAYMENT_RANGES,
  HARD_GATE_MULTIPLIER,
  SOFT_GATE_MULTIPLIER,
} from '../../shared/domain/sponsor-probability';

// ===========================================
// TYPES
// ===========================================

export type DurationValue = '1' | '2' | '3';

/** Optional initial terms for pre-populating ContactModal (e.g., from a renewal) */
export interface RenewalInitialTerms {
  monthlyPayment: number;
  signingBonus: number;
  duration: DurationValue;
}

export const DURATION_OPTIONS: DropdownOption<DurationValue>[] = [
  { value: '1', label: '1 Year' },
  { value: '2', label: '2 Years' },
  { value: '3', label: '3 Years' },
];

/** Industry icons (matches Sponsors.tsx) */
const INDUSTRY_ICONS: Record<string, string> = {
  'oil-gas': '⛽',
  technology: '\u{1F4BB}',
  finance: '\u{1F4B3}',
  telecommunications: '\u{1F4F1}',
  payments: '\u{1F4B8}',
  'water-technology': '\u{1F4A7}',
  consulting: '\u{1F4BC}',
  aviation: '✈️',
  luxury: '\u{1F48E}',
  beverages: '\u{1F37A}',
  logistics: '\u{1F4E6}',
  apparel: '\u{1F455}',
  insurance: '\u{1F6E1}️',
  tyres: '\u{1F6DE}',
  components: '⚙️',
  'consumer-electronics': '\u{1F4F7}',
  entertainment: '\u{1F3AC}',
  hospitality: '\u{1F3E8}',
  food: '\u{1F35E}',
  'consumer-goods': '\u{1F6D2}',
  beauty: '\u{1F484}',
  industrial: '\u{1F3ED}',
};

const DEFAULT_ICON = '\u{1F4BC}';

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function getIndustryIcon(industry: string): string {
  return INDUSTRY_ICONS[industry] ?? DEFAULT_ICON;
}

/** Return the name of the sponsor causing a rival conflict, or null */
export function getRivalConflictName(
  sponsor: Sponsor,
  playerDealsForSponsor: ActiveSponsorDeal[],
  allSponsors: Sponsor[]
): string | null {
  if (!sponsor.rivalGroup) return null;
  for (const deal of playerDealsForSponsor) {
    const existing = allSponsors.find((s) => s.id === deal.sponsorId);
    if (existing?.rivalGroup === sponsor.rivalGroup) return existing.name;
  }
  return null;
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

interface SponsorLogoProps {
  sponsor: Sponsor;
  size: 'sm' | 'md';
}

function SponsorLogo({ sponsor, size }: SponsorLogoProps) {
  const sizeClasses = size === 'sm' ? 'w-10 h-10 rounded' : 'w-12 h-12 rounded-lg';
  const iconSize = size === 'sm' ? 'text-lg' : 'text-xl';
  const imgPadding = size === 'sm' ? 'p-0.5' : 'p-1';

  return (
    <div className={`flex-shrink-0 ${sizeClasses} bg-white flex items-center justify-center overflow-hidden`}>
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className={`max-w-full max-h-full object-contain ${imgPadding}`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <span className={`${sponsor.logoUrl ? 'hidden' : ''} ${iconSize}`}>
        {getIndustryIcon(sponsor.industry)}
      </span>
    </div>
  );
}

// ===========================================
// REPUTATION STANDING BADGE
// ===========================================

const REP_STANDING_STYLES = {
  'Strong match': 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50',
  'Borderline': 'bg-amber-900/40 text-amber-400 border border-amber-700/50',
  'Below requirements': 'bg-red-900/40 text-red-400 border border-red-700/50',
} as const;

function RepStandingBadge({ standing }: { standing: ReturnType<typeof getReputationStanding> }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${REP_STANDING_STYLES[standing]}`}>
      {standing}
    </span>
  );
}

// ===========================================
// LIKELIHOOD BAND INDICATOR
// ===========================================

const BAND_STYLES = {
  'Likely to accept': { text: 'text-emerald-400', label: 'Likely to accept' },
  'Likely to counter': { text: 'text-amber-400', label: 'Likely to counter' },
  'Toss-up': { text: 'text-blue-400', label: 'Toss-up' },
  'Likely to reject': { text: 'text-red-400', label: 'Likely to reject' },
} as const;

export function LikelihoodBandIndicator({ band }: { band: ReturnType<typeof getLikelihoodBand> }) {
  const style = BAND_STYLES[band];
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-neutral-800/60 border border-neutral-700 rounded">
      <span className="text-xs text-muted">Likelihood of acceptance</span>
      <span className={`text-sm font-semibold ${style.text}`}>{style.label}</span>
    </div>
  );
}

// ===========================================
// BROWSE SPONSOR CARD
// ===========================================

export interface BrowseSponsorCardProps {
  sponsor: Sponsor;
  isContracted: boolean;
  isNegotiating: boolean;
  isSlotFull: boolean;
  rivalConflictName: string | null;
  isBelowRepFloor: boolean;
  repStanding: ReturnType<typeof getReputationStanding>;
  negotiationId: string | null;
  onContact: () => void;
  onViewNegotiations: () => void;
}

export function BrowseSponsorCard({
  sponsor,
  isContracted,
  isNegotiating,
  isSlotFull,
  rivalConflictName,
  isBelowRepFloor,
  repStanding,
  negotiationId,
  onContact,
  onViewNegotiations,
}: BrowseSponsorCardProps) {
  const hasHardBlocker = isSlotFull || rivalConflictName !== null || isBelowRepFloor;

  const blockerReason =
    rivalConflictName !== null
      ? `Conflicts with ${rivalConflictName}`
      : isBelowRepFloor
      ? 'Below reputation requirement'
      : isSlotFull
      ? 'Slot at capacity'
      : null;

  const renderCTA = () => {
    if (isContracted) return <span className="text-sm text-emerald-400">Contracted</span>;

    if (isNegotiating && negotiationId) {
      return (
        <button
          type="button"
          onClick={onViewNegotiations}
          className={`btn cursor-pointer px-4 py-2 text-sm font-medium ${GHOST_BORDERED_BUTTON_CLASSES}`}
        >
          View in Negotiations
        </button>
      );
    }

    if (hasHardBlocker) {
      return (
        <button
          type="button"
          disabled
          className="btn px-4 py-2 text-sm font-medium opacity-40 cursor-not-allowed border border-neutral-600 text-neutral-500"
        >
          Contact
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onContact}
        className="btn cursor-pointer px-4 py-2 text-sm font-medium"
        style={ACCENT_BORDERED_BUTTON_STYLE}
      >
        Contact
      </button>
    );
  };

  return (
    <div className="card p-4 flex items-center gap-4" style={ACCENT_CARD_STYLE}>
      <SponsorLogo sponsor={sponsor} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-primary truncate">{sponsor.name}</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-muted">
            {SPONSOR_TIER_LABELS[sponsor.tier]}
          </span>
          <RepStandingBadge standing={repStanding} />
          {rivalConflictName !== null && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/50 font-medium">
              Rival conflict
            </span>
          )}
        </div>
        <p className="text-sm text-muted capitalize mt-0.5">{sponsor.industry.replace(/-/g, ' ')}</p>
        {blockerReason && (
          <p className="text-xs text-red-400 mt-1 italic">{blockerReason}</p>
        )}
      </div>

      <div className="flex-shrink-0">
        {renderCTA()}
      </div>
    </div>
  );
}

// ===========================================
// CONTACT MODAL
// ===========================================

export interface ContactModalProps {
  sponsor: Sponsor;
  teamPosition: number;
  totalTeams: number;
  existingPlayerDeals: ActiveSponsorDeal[];
  allSponsors: Sponsor[];
  onClose: () => void;
  onSubmit: (terms: SponsorContractTerms) => void;
  /** Pre-populated values, e.g. from a renewal offer */
  initialTerms?: RenewalInitialTerms;
}

export function ContactModal({
  sponsor,
  teamPosition,
  totalTeams,
  existingPlayerDeals,
  allSponsors,
  onClose,
  onSubmit,
  initialTerms,
}: ContactModalProps) {
  const [duration, setDuration] = useState<DurationValue>(initialTerms?.duration ?? '2');
  const [monthlyPayment, setMonthlyPayment] = useState(initialTerms?.monthlyPayment ?? sponsor.baseMonthlyPayment);
  const [signingBonus, setSigningBonus] = useState(initialTerms?.signingBonus ?? Math.round(sponsor.baseMonthlyPayment * 2));

  // Hard blocker checks
  const rivalConflictName = getRivalConflictName(sponsor, existingPlayerDeals, allSponsors);
  const reputationRatio = computeReputationRatio(teamPosition, totalTeams, sponsor.minReputation);
  const isBelowHardGate = reputationRatio < HARD_GATE_MULTIPLIER;
  const isBelowSoftGate = reputationRatio < SOFT_GATE_MULTIPLIER;
  const hasHardBlocker = rivalConflictName !== null || isBelowHardGate;

  const blockerMessage =
    rivalConflictName !== null
      ? `Cannot negotiate: rival group conflict with ${rivalConflictName}`
      : isBelowHardGate
      ? "Cannot negotiate: your team's reputation is below this sponsor's requirement"
      : null;

  // Live likelihood band — uses the engine's own willing-payment + probability functions
  const willingPayment = useMemo(
    () => calculateWillingPayment(sponsor, teamPosition, totalTeams),
    [sponsor, teamPosition, totalTeams]
  );

  const likelihoodBand = useMemo(() => {
    if (hasHardBlocker) return getLikelihoodBand({ accept: 0, counter: 0, reject: 1 });
    const paymentRatio = monthlyPayment / willingPayment;
    const probs = computeAcceptanceProbabilities(paymentRatio, isBelowHardGate, isBelowSoftGate);
    return getLikelihoodBand(probs);
  }, [monthlyPayment, willingPayment, isBelowHardGate, isBelowSoftGate, hasHardBlocker]);

  // Reference line
  const tierRange = TIER_PAYMENT_RANGES[sponsor.tier];

  // Requirements blurb
  const requiredPosition = getRequiredPosition(totalTeams, sponsor.minReputation);
  const requirementsBlurb = `Requires top-${requiredPosition} championship finish`;

  // Slider ranges
  const maxMonthly = sponsor.baseMonthlyPayment * 3;
  const maxBonus = sponsor.baseMonthlyPayment * 6;
  const sliderStep = Math.max(1000, Math.round(sponsor.baseMonthlyPayment / 100) * 1000);

  const handleSubmit = () => {
    onSubmit({
      monthlyPayment,
      signingBonus,
      duration: parseInt(duration, 10),
      placement: getPlacementForTier(sponsor.tier),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card max-w-md w-full mx-4" style={ACCENT_CARD_STYLE}>
        {/* Modal header */}
        <div className="flex items-start gap-3 p-5 border-b border-neutral-700">
          <SponsorLogo sponsor={sponsor} size="md" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-primary leading-tight">{sponsor.name}</h2>
            <p className="text-xs text-muted mt-0.5">
              {SPONSOR_TIER_LABELS[sponsor.tier]} Sponsor · {requirementsBlurb}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-primary text-xl leading-none flex-shrink-0 mt-0.5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Hard blocker */}
          {hasHardBlocker && blockerMessage && (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-400 font-medium">
              {blockerMessage}
            </div>
          )}

          {/* Likelihood band */}
          {!hasHardBlocker && <LikelihoodBandIndicator band={likelihoodBand} />}

          {/* Reference line */}
          <div className="text-xs text-muted italic border-l-2 border-neutral-600 pl-2">
            Sponsors of this tier typically pay {formatCurrency(tierRange.low)}–{formatCurrency(tierRange.high)}/mo
          </div>

          {/* Sliders */}
          <div className={hasHardBlocker ? 'opacity-40 pointer-events-none space-y-4' : 'space-y-4'}>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <label className="text-secondary font-medium">Monthly Payment</label>
                <span className="text-primary font-medium">{formatCurrency(monthlyPayment)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxMonthly}
                step={sliderStep}
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <label className="text-secondary font-medium">Signing Bonus</label>
                <span className="text-primary font-medium">{formatCurrency(signingBonus)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxBonus}
                step={sliderStep}
                value={signingBonus}
                onChange={(e) => setSigningBonus(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>

            <div>
              <label className="block text-sm text-secondary font-medium mb-1">Duration</label>
              <Dropdown<DurationValue>
                options={DURATION_OPTIONS}
                value={duration}
                onChange={setDuration}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className={`btn cursor-pointer flex-1 px-4 py-2 ${GHOST_BORDERED_BUTTON_CLASSES}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={hasHardBlocker}
            className={`btn flex-1 px-4 py-2 font-medium ${hasHardBlocker ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            style={hasHardBlocker ? undefined : ACCENT_BORDERED_BUTTON_STYLE}
          >
            Submit Proposal
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// NEGOTIATION CARD
// ===========================================

export interface NegotiationCardProps {
  negotiation: SponsorNegotiation;
  sponsor: Sponsor;
  isSlotFilled?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onSign?: () => void;
  onDecline?: () => void;
}

export function NegotiationCard({ negotiation, sponsor, isSlotFilled = false, onAccept, onReject, onSign, onDecline }: NegotiationCardProps) {
  const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
  const terms = lastRound?.terms as SponsorContractTerms | undefined;
  const isResponseReceived = negotiation.phase === NegotiationPhase.ResponseReceived;
  const isPendingConfirmation = negotiation.phase === NegotiationPhase.PendingPlayerConfirmation;
  const isComplete = negotiation.phase === NegotiationPhase.Completed;
  const isFailed = negotiation.phase === NegotiationPhase.Failed;

  return (
    <div className="card p-4" style={ACCENT_CARD_STYLE}>
      <div className="flex items-start gap-4">
        <SponsorLogo sponsor={sponsor} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-primary">{sponsor.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-muted">
              {SPONSOR_TIER_LABELS[sponsor.tier]}
            </span>
          </div>

          <p className="text-sm text-muted mb-2">
            For {seasonToYear(negotiation.forSeason)} season
          </p>

          <div className="flex items-center gap-2 text-sm">
            <span className={
              isComplete ? 'text-emerald-400' :
              isFailed ? 'text-red-400' :
              isResponseReceived || isPendingConfirmation ? 'text-amber-400' :
              'text-blue-400'
            }>
              {isPendingConfirmation ? 'Accepted — awaiting your signature' :
               isComplete ? 'Completed' :
               isFailed ? 'Failed' :
               isResponseReceived ? 'Response Received' :
               'Awaiting Response'}
            </span>
            <span className="text-muted">•</span>
            <span className="text-muted">Round {negotiation.currentRound}</span>
          </div>
        </div>
      </div>

      {terms && !isComplete && (
        <div className="mt-4 pt-4 border-t border-neutral-700">
          <h4 className="text-sm font-medium text-secondary mb-2">
            {isPendingConfirmation ? 'Accepted Terms' :
             isFailed ? 'Last Offer' :
             lastRound?.offeredBy === 'player' ? 'Your Offer' : 'Their Offer'}
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted">Monthly:</span>
              <span className="text-primary ml-2">{formatCurrency(terms.monthlyPayment)}</span>
            </div>
            <div>
              <span className="text-muted">Signing:</span>
              <span className="text-primary ml-2">{formatCurrency(terms.signingBonus)}</span>
            </div>
            <div>
              <span className="text-muted">Duration:</span>
              <span className="text-primary ml-2">{terms.duration} yr</span>
            </div>
          </div>
        </div>
      )}

      {isResponseReceived && (
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onReject}
            className={`btn cursor-pointer flex-1 px-4 py-2 ${GHOST_BORDERED_BUTTON_CLASSES}`}
          >
            Reject
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="btn cursor-pointer flex-1 px-4 py-2 font-medium"
            style={ACCENT_BORDERED_BUTTON_STYLE}
          >
            Accept
          </button>
        </div>
      )}

      {isPendingConfirmation && (
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onDecline}
            className={`btn cursor-pointer flex-1 px-4 py-2 ${GHOST_BORDERED_BUTTON_CLASSES}`}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onSign}
            disabled={isSlotFilled}
            className={`btn cursor-pointer flex-1 px-4 py-2 font-medium ${isSlotFilled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={isSlotFilled ? undefined : ACCENT_BORDERED_BUTTON_STYLE}
            title={isSlotFilled ? 'Slot filled by another deal' : undefined}
          >
            {isSlotFilled ? 'Slot filled.' : 'Sign'}
          </button>
        </div>
      )}

      {isComplete && (
        <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-lg">
          <p className="text-sm text-emerald-400 text-center">
            Contract signed for {seasonToYear(negotiation.forSeason)} season!
          </p>
        </div>
      )}

      {isFailed && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
          {negotiation.rejectionReason ? (
            <p className="text-sm text-red-300 italic">"{negotiation.rejectionReason}"</p>
          ) : (
            <p className="text-sm text-red-400 text-center">
              Negotiation ended without agreement.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================
// SECTION HEADER
// ===========================================

interface SectionHeaderProps {
  title: string;
  count?: number;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function SectionHeader({ title, count, collapsible, collapsed, onToggle }: SectionHeaderProps) {
  return (
    <div
      className={`flex items-center gap-2 py-2 ${collapsible ? 'cursor-pointer select-none' : ''}`}
      onClick={collapsible ? onToggle : undefined}
    >
      <span className="text-sm font-semibold text-secondary uppercase tracking-wide">{title}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500 text-black font-bold">{count}</span>
      )}
      {collapsible && (
        <span className="text-muted text-xs ml-auto">{collapsed ? '▶' : '▼'}</span>
      )}
    </div>
  );
}

// ===========================================
// TOAST
// ===========================================

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-neutral-800 border border-neutral-600 rounded-lg shadow-lg text-sm text-primary pointer-events-none">
      {message}
    </div>
  );
}
