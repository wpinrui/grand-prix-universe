import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDerivedGameState, queryKeys } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { SectionHeading, TabBar, Dropdown } from '../components';
import type { Tab, DropdownOption } from '../components';
import { ACCENT_CARD_STYLE, ACCENT_BORDERED_BUTTON_STYLE, GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatCurrency, SPONSOR_TIER_LABELS } from '../utils/format';
import { seasonToYear } from '../../shared/utils/date-utils';
import { IpcChannels } from '../../shared/ipc';
import {
  SponsorTier,
  SponsorPlacement,
  NegotiationPhase,
  StakeholderType,
  type Sponsor,
  type SponsorNegotiation,
  type SponsorContractTerms,
} from '../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type DealsTab = 'browse' | 'negotiations';
type TierFilter = 'all' | SponsorTier;

// ===========================================
// CONSTANTS
// ===========================================

const TABS: Tab<DealsTab>[] = [
  { id: 'browse', label: 'Browse Sponsors' },
  { id: 'negotiations', label: 'Negotiations' },
];

const TIER_FILTER_OPTIONS: DropdownOption<TierFilter>[] = [
  { value: 'all', label: 'All Tiers' },
  { value: SponsorTier.Title, label: 'Title' },
  { value: SponsorTier.Major, label: 'Major' },
  { value: SponsorTier.Minor, label: 'Minor' },
];

type DurationValue = '1' | '2' | '3';

const DURATION_OPTIONS: DropdownOption<DurationValue>[] = [
  { value: '1', label: '1 Year' },
  { value: '2', label: '2 Years' },
  { value: '3', label: '3 Years' },
];

/** Industry icons */
const INDUSTRY_ICONS: Record<string, string> = {
  'oil-gas': '\u26FD',
  technology: '\u{1F4BB}',
  finance: '\u{1F4B3}',
  telecommunications: '\u{1F4F1}',
  payments: '\u{1F4B8}',
  'water-technology': '\u{1F4A7}',
  consulting: '\u{1F4BC}',
  aviation: '\u2708\uFE0F',
  luxury: '\u{1F48E}',
  beverages: '\u{1F37A}',
  logistics: '\u{1F4E6}',
  apparel: '\u{1F455}',
  insurance: '\u{1F6E1}\uFE0F',
  tyres: '\u{1F6DE}',
  components: '\u2699\uFE0F',
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

function getPlacementForTier(tier: SponsorTier): SponsorPlacement {
  switch (tier) {
    case SponsorTier.Title:
      return SponsorPlacement.Primary;
    case SponsorTier.Major:
      return SponsorPlacement.Secondary;
    case SponsorTier.Minor:
    default:
      return SponsorPlacement.Tertiary;
  }
}

function getPhaseLabel(phase: NegotiationPhase): string {
  switch (phase) {
    case NegotiationPhase.AwaitingResponse:
      return 'Awaiting Response';
    case NegotiationPhase.ResponseReceived:
      return 'Response Received';
    case NegotiationPhase.Completed:
      return 'Completed';
    case NegotiationPhase.Failed:
      return 'Failed';
  }
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

interface SponsorCardProps {
  sponsor: Sponsor;
  isContracted: boolean;
  isNegotiating: boolean;
  onContact: () => void;
}

function SponsorCard({ sponsor, isContracted, isNegotiating, onContact }: SponsorCardProps) {
  return (
    <div className="card p-4 flex items-center gap-4" style={ACCENT_CARD_STYLE}>
      <SponsorLogo sponsor={sponsor} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-primary truncate">{sponsor.name}</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-muted">
            {SPONSOR_TIER_LABELS[sponsor.tier]}
          </span>
        </div>
        <p className="text-sm text-muted capitalize">{sponsor.industry.replace(/-/g, ' ')}</p>
        <p className="text-sm text-secondary mt-1">
          Base: {formatCurrency(sponsor.baseMonthlyPayment)}/mo
        </p>
      </div>

      <div className="flex-shrink-0">
        {isContracted ? (
          <span className="text-sm text-emerald-400">Contracted</span>
        ) : isNegotiating ? (
          <span className="text-sm text-amber-400">Negotiating</span>
        ) : (
          <button
            type="button"
            onClick={onContact}
            className="btn cursor-pointer px-4 py-2 text-sm font-medium"
            style={ACCENT_BORDERED_BUTTON_STYLE}
          >
            Contact
          </button>
        )}
      </div>
    </div>
  );
}

interface ContactModalProps {
  sponsor: Sponsor;
  currentSeason: number;
  onClose: () => void;
  onSubmit: (terms: SponsorContractTerms) => void;
}

function ContactModal({ sponsor, currentSeason, onClose, onSubmit }: ContactModalProps) {
  const [duration, setDuration] = useState<DurationValue>('2');
  const [monthlyPayment, setMonthlyPayment] = useState(sponsor.baseMonthlyPayment);
  const [signingBonus, setSigningBonus] = useState(Math.round(sponsor.baseMonthlyPayment * 2));

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
      <div className="card p-6 max-w-md w-full mx-4" style={ACCENT_CARD_STYLE}>
        <h2 className="text-xl font-bold text-primary mb-4">Contact {sponsor.name}</h2>

        <div className="flex items-center gap-3 mb-6">
          <SponsorLogo sponsor={sponsor} size="md" />
          <div>
            <p className="text-sm text-muted capitalize">{sponsor.industry.replace(/-/g, ' ')}</p>
            <p className="text-xs text-secondary">{SPONSOR_TIER_LABELS[sponsor.tier]} Sponsor</p>
          </div>
        </div>

        <p className="text-sm text-muted mb-4">
          Propose contract terms for {seasonToYear(currentSeason + 1)} season.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-secondary mb-1">Monthly Payment</label>
            <input
              type="number"
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(Number(e.target.value))}
              className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-primary"
              min={0}
              step={10000}
            />
            <p className="text-xs text-muted mt-1">
              Base rate: {formatCurrency(sponsor.baseMonthlyPayment)}/mo
            </p>
          </div>

          <div>
            <label className="block text-sm text-secondary mb-1">Signing Bonus</label>
            <input
              type="number"
              value={signingBonus}
              onChange={(e) => setSigningBonus(Number(e.target.value))}
              className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-primary"
              min={0}
              step={10000}
            />
          </div>

          <div>
            <label className="block text-sm text-secondary mb-1">Duration</label>
            <Dropdown<DurationValue>
              options={DURATION_OPTIONS}
              value={duration}
              onChange={setDuration}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
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
            className="btn cursor-pointer flex-1 px-4 py-2 font-medium"
            style={ACCENT_BORDERED_BUTTON_STYLE}
          >
            Send Proposal
          </button>
        </div>
      </div>
    </div>
  );
}

interface NegotiationCardProps {
  negotiation: SponsorNegotiation;
  sponsor: Sponsor;
  onAccept: () => void;
  onReject: () => void;
}

function NegotiationCard({ negotiation, sponsor, onAccept, onReject }: NegotiationCardProps) {
  const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
  const terms = lastRound?.terms as SponsorContractTerms | undefined;
  const isPlayerTurn = negotiation.phase === NegotiationPhase.ResponseReceived;
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
              isPlayerTurn ? 'text-amber-400' :
              'text-blue-400'
            }>
              {getPhaseLabel(negotiation.phase)}
            </span>
            <span className="text-muted">•</span>
            <span className="text-muted">Round {negotiation.currentRound}</span>
          </div>
        </div>
      </div>

      {terms && !isComplete && !isFailed && (
        <div className="mt-4 pt-4 border-t border-neutral-700">
          <h4 className="text-sm font-medium text-secondary mb-2">
            {lastRound?.offeredBy === 'player' ? 'Your Offer' : 'Their Offer'}
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

      {isPlayerTurn && (
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

      {isComplete && (
        <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-lg">
          <p className="text-sm text-emerald-400 text-center">
            Contract signed for {seasonToYear(negotiation.forSeason)} season!
          </p>
        </div>
      )}

      {isFailed && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
          <p className="text-sm text-red-400 text-center">
            Negotiation ended without agreement.
          </p>
        </div>
      )}
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

interface DealsProps {
  /** When true, hides the section heading (used when embedded in Sponsors) */
  embedded?: boolean;
  /** Initial tier filter to apply (e.g., when navigating from an empty sponsor slot) */
  initialTierFilter?: SponsorTier;
}

export function Deals({ embedded = false, initialTierFilter }: DealsProps) {
  const [activeTab, setActiveTab] = useState<DealsTab>('browse');
  const [tierFilter, setTierFilter] = useState<TierFilter>(initialTierFilter ?? 'all');
  const [contactingSponsor, setContactingSponsor] = useState<Sponsor | null>(null);

  // Sync tier filter when initialTierFilter prop changes (e.g., clicking a different empty slot)
  useEffect(() => {
    if (initialTierFilter) {
      setTierFilter(initialTierFilter);
    }
  }, [initialTierFilter]);

  const { gameState, isLoading } = useDerivedGameState();
  const queryClient = useQueryClient();

  const refreshGameState = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.gameState });
  }, [queryClient]);

  // Get player's current sponsor deals
  const playerDeals = useMemo(() => {
    if (!gameState) return new Set<string>();
    return new Set(
      gameState.sponsorDeals
        .filter((d) => d.teamId === gameState.player.teamId)
        .map((d) => d.sponsorId)
    );
  }, [gameState]);

  // Get player's active sponsor negotiations
  const activeNegotiations = useMemo(() => {
    if (!gameState) return [];
    return gameState.negotiations.filter(
      (n): n is SponsorNegotiation =>
        n.stakeholderType === StakeholderType.Sponsor &&
        n.teamId === gameState.player.teamId
    );
  }, [gameState]);

  const negotiatingSponsorIds = useMemo(() => {
    return new Set(
      activeNegotiations
        .filter((n) => n.phase !== NegotiationPhase.Completed && n.phase !== NegotiationPhase.Failed)
        .map((n) => n.sponsorId)
    );
  }, [activeNegotiations]);

  // Filter sponsors for browse tab
  const filteredSponsors = useMemo(() => {
    if (!gameState) return [];
    let sponsors = gameState.sponsors;
    if (tierFilter !== 'all') {
      sponsors = sponsors.filter((s) => s.tier === tierFilter);
    }
    // Sort by tier (Title > Major > Minor), then by base payment
    const tierOrder = { [SponsorTier.Title]: 0, [SponsorTier.Major]: 1, [SponsorTier.Minor]: 2 };
    return [...sponsors].sort((a, b) => {
      const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.baseMonthlyPayment - a.baseMonthlyPayment;
    });
  }, [gameState, tierFilter]);

  // Handlers
  const handleStartNegotiation = useCallback(async (terms: SponsorContractTerms) => {
    if (!contactingSponsor) return;
    try {
      await window.electronAPI.invoke(IpcChannels.SPONSOR_START_NEGOTIATION, {
        sponsorId: contactingSponsor.id,
        terms,
      });
      refreshGameState();
      setContactingSponsor(null);
      setActiveTab('negotiations');
    } catch (error) {
      console.error('Failed to start negotiation:', error);
    }
  }, [contactingSponsor, refreshGameState]);

  const handleRespondToOffer = useCallback(async (negotiationId: string, response: 'accept' | 'reject') => {
    try {
      await window.electronAPI.invoke(IpcChannels.SPONSOR_RESPOND_TO_OFFER, {
        negotiationId,
        response,
      });
      refreshGameState();
    } catch (error) {
      console.error('Failed to respond to offer:', error);
    }
  }, [refreshGameState]);

  if (isLoading) {
    return (
      <div className="p-4">
        <SectionHeading>Deals</SectionHeading>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="p-4">
        <SectionHeading>Deals</SectionHeading>
        <p className="text-muted">No game data available.</p>
      </div>
    );
  }

  const currentSeason = gameState.currentSeason.seasonNumber;
  const pendingNegotiations = activeNegotiations.filter(
    (n) => n.phase === NegotiationPhase.ResponseReceived
  );

  return (
    <div className="space-y-4">
      {!embedded && <SectionHeading>Deals</SectionHeading>}

      <TabBar<DealsTab>
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badge={pendingNegotiations.length > 0 ? { tabId: 'negotiations', count: pendingNegotiations.length } : undefined}
      />

      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="card p-4" style={ACCENT_CARD_STYLE}>
            <div className="flex items-start gap-3">
              <div className="text-blue-400 text-xl">ℹ️</div>
              <div>
                <h3 className="text-sm font-semibold text-primary mb-1">
                  Sponsor Negotiations
                </h3>
                <p className="text-xs text-muted">
                  Contact sponsors to negotiate deals for next season. Higher-tier sponsors pay more
                  but have stricter requirements. Your team's championship position affects their interest.
                </p>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-secondary">Filter by tier:</span>
            <div className="w-40">
              <Dropdown<TierFilter>
                options={TIER_FILTER_OPTIONS}
                value={tierFilter}
                onChange={setTierFilter}
              />
            </div>
          </div>

          {/* Sponsor list */}
          <div className="space-y-3">
            {filteredSponsors.map((sponsor) => (
              <SponsorCard
                key={sponsor.id}
                sponsor={sponsor}
                isContracted={playerDeals.has(sponsor.id)}
                isNegotiating={negotiatingSponsorIds.has(sponsor.id)}
                onContact={() => setContactingSponsor(sponsor)}
              />
            ))}
            {filteredSponsors.length === 0 && (
              <p className="text-center text-muted py-8">
                No sponsors found matching filter.
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'negotiations' && (
        <div className="space-y-4">
          {activeNegotiations.length === 0 ? (
            <div className="card p-8 text-center" style={ACCENT_CARD_STYLE}>
              <p className="text-muted mb-2">No active negotiations.</p>
              <p className="text-sm text-secondary">
                Browse sponsors to start a negotiation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeNegotiations.map((negotiation) => {
                const sponsor = gameState.sponsors.find((s) => s.id === negotiation.sponsorId);
                if (!sponsor) return null;
                return (
                  <NegotiationCard
                    key={negotiation.id}
                    negotiation={negotiation}
                    sponsor={sponsor}
                    onAccept={() => handleRespondToOffer(negotiation.id, 'accept')}
                    onReject={() => handleRespondToOffer(negotiation.id, 'reject')}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Contact Modal */}
      {contactingSponsor && (
        <ContactModal
          sponsor={contactingSponsor}
          currentSeason={currentSeason}
          onClose={() => setContactingSponsor(null)}
          onSubmit={handleStartNegotiation}
        />
      )}
    </div>
  );
}
