import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDerivedGameState, queryKeys } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { SectionHeading, TabBar, Dropdown } from '../components';
import type { Tab, DropdownOption } from '../components';
import { ACCENT_CARD_STYLE, ACCENT_BORDERED_BUTTON_STYLE, GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatCurrency, formatCompact, SPONSOR_TIER_LABELS } from '../utils/format';
import { seasonToYear } from '../../shared/utils/date-utils';
import { IpcChannels } from '../../shared/ipc';
import {
  SponsorTier,
  NegotiationPhase,
  StakeholderType,
  type Sponsor,
  type ActiveSponsorDeal,
  type GameState,
  type SponsorNegotiation,
  type SponsorContractTerms,
} from '../../shared/domain';
import { SPONSOR_SLOT_COUNTS } from '../../shared/domain/engine-utils';
import {
  getReputationStanding,
  computeReputationRatio,
  calculateWillingPayment,
  HARD_GATE_MULTIPLIER,
} from '../../shared/domain/sponsor-probability';
import {
  getRivalConflictName,
  BrowseSponsorCard,
  ContactModal,
  NegotiationCard,
  SectionHeader,
  Toast,
  type RenewalInitialTerms,
  type DurationValue,
} from './Deals';

// ===========================================
// TYPES
// ===========================================

export type SponsorsTab = 'summary' | 'browse' | 'negotiations' | 'renewals';

type TierFilter = 'all' | SponsorTier;

// ===========================================
// CONSTANTS
// ===========================================

const TABS: Tab<SponsorsTab>[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'browse', label: 'Browse' },
  { id: 'negotiations', label: 'Negotiations' },
  { id: 'renewals', label: 'Renewals' },
];

/** Fixed slot counts per tier */
const SLOT_COUNTS: Record<SponsorTier, number> = {
  [SponsorTier.Title]: 1,
  [SponsorTier.Major]: 3,
  [SponsorTier.Minor]: 5,
};

const TIER_FILTER_OPTIONS: DropdownOption<TierFilter>[] = [
  { value: 'all', label: 'All Tiers' },
  { value: SponsorTier.Title, label: 'Title' },
  { value: SponsorTier.Major, label: 'Major' },
  { value: SponsorTier.Minor, label: 'Minor' },
];

/** Industry icons (Lucide icon names mapped to emoji for now) */
const INDUSTRY_ICONS: Record<string, string> = {
  'oil-gas': '⛽', // fuel pump
  technology: '\u{1F4BB}', // laptop
  finance: '\u{1F4B3}', // credit card
  telecommunications: '\u{1F4F1}', // mobile phone
  payments: '\u{1F4B8}', // money with wings
  'water-technology': '\u{1F4A7}', // droplet
  consulting: '\u{1F4BC}', // briefcase
  aviation: '✈️', // airplane
  luxury: '\u{1F48E}', // gem
  beverages: '\u{1F37A}', // beer mug
  logistics: '\u{1F4E6}', // package
  apparel: '\u{1F455}', // t-shirt
  insurance: '\u{1F6E1}️', // shield
  tyres: '\u{1F6DE}', // wheel
  components: '⚙️', // gear
  'consumer-electronics': '\u{1F4F7}', // camera
  entertainment: '\u{1F3AC}', // clapper board
  hospitality: '\u{1F3E8}', // hotel
  food: '\u{1F35E}', // bread
  'consumer-goods': '\u{1F6D2}', // shopping cart
  beauty: '\u{1F484}', // lipstick
  industrial: '\u{1F3ED}', // factory
};

const DEFAULT_ICON = '\u{1F4BC}'; // briefcase

/** Min heights for empty slot variants */
const EMPTY_SLOT_MIN_HEIGHT = {
  large: 140,
  medium: 100,
} as const;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function getIndustryIcon(industry: string): string {
  return INDUSTRY_ICONS[industry] ?? DEFAULT_ICON;
}

function getSponsorById(sponsors: Sponsor[], sponsorId: string): Sponsor | null {
  return sponsors.find((s) => s.id === sponsorId) ?? null;
}

/** Seasons remaining colour: green 3+, amber 2, red 1 */
function seasonsRemainingColor(seasonsLeft: number): string {
  if (seasonsLeft >= 3) return 'text-emerald-400';
  if (seasonsLeft === 2) return 'text-amber-400';
  return 'text-red-400';
}

function getContractStatus(deal: ActiveSponsorDeal, currentSeason: number): { label: string; color: string } {
  const seasonsLeft = deal.endSeason - currentSeason;
  if (seasonsLeft <= 0) return { label: 'Final Year', color: 'text-red-400' };
  if (seasonsLeft === 1) return { label: '1 season left', color: seasonsRemainingColor(1) };
  return { label: `${seasonsLeft} seasons left`, color: seasonsRemainingColor(seasonsLeft) };
}

// ===========================================
// SUB-COMPONENTS — SUMMARY TAB
// ===========================================

interface SponsorLogoProps {
  sponsor: Sponsor;
  size: 'sm' | 'md' | 'lg';
}

function SponsorLogo({ sponsor, size }: SponsorLogoProps) {
  const sizeClasses = {
    sm: 'w-10 h-10 rounded',
    md: 'w-12 h-12 rounded-lg',
    lg: 'w-20 h-20 rounded-lg',
  };
  const iconSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };
  const imgPadding = {
    sm: 'p-0.5',
    md: 'p-1',
    lg: 'p-1',
  };

  return (
    <div className={`flex-shrink-0 ${sizeClasses[size]} bg-white flex items-center justify-center overflow-hidden`}>
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className={`max-w-full max-h-full object-contain ${imgPadding[size]}`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <span className={`${sponsor.logoUrl ? 'hidden' : ''} ${iconSizes[size]}`}>
        {getIndustryIcon(sponsor.industry)}
      </span>
    </div>
  );
}

interface IncomeSummaryProps {
  totalMonthly: number;
  titleIncome: number;
  majorIncome: number;
  minorIncome: number;
}

function IncomeSummary({ totalMonthly, titleIncome, majorIncome, minorIncome }: IncomeSummaryProps) {
  const annualIncome = totalMonthly * 12;

  return (
    <div className="card p-6" style={ACCENT_CARD_STYLE}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-muted mb-1">Monthly Sponsor Income</div>
          <div className="text-3xl font-bold text-primary">{formatCurrency(totalMonthly)}</div>
          <div className="text-sm text-secondary mt-1">{formatCurrency(annualIncome)}/year</div>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted mb-2">Breakdown (monthly)</div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-secondary">Title:</span>
              <span className="text-primary font-medium">{formatCurrency(titleIncome)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-secondary">Major:</span>
              <span className="text-primary font-medium">{formatCurrency(majorIncome)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-secondary">Minor:</span>
              <span className="text-primary font-medium">{formatCurrency(minorIncome)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SponsorCardProps {
  sponsor: Sponsor;
  deal: ActiveSponsorDeal;
  currentSeason: number;
  variant: 'large' | 'medium';
}

function SponsorCard({ sponsor, deal, currentSeason, variant }: SponsorCardProps) {
  const status = getContractStatus(deal, currentSeason);
  const startYear = seasonToYear(deal.startSeason);
  const endYear = seasonToYear(deal.endSeason);
  const seasonsLeft = deal.endSeason - currentSeason;

  const isLarge = variant === 'large';

  return (
    <div
      className={`card ${isLarge ? 'p-6' : 'p-4'} flex ${isLarge ? 'flex-row gap-6' : 'flex-col gap-3'}`}
      style={ACCENT_CARD_STYLE}
    >
      <SponsorLogo sponsor={sponsor} size={isLarge ? 'lg' : 'md'} />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className={`font-semibold text-primary ${isLarge ? 'text-xl' : 'text-base'} truncate`}>
              {sponsor.name}
            </h3>
            <p className="text-sm text-muted capitalize">{sponsor.industry.replace(/-/g, ' ')}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`font-bold text-primary ${isLarge ? 'text-xl' : 'text-base'}`}>
              {formatCurrency(deal.monthlyPayment)}
              <span className="text-sm font-normal text-muted">/mo</span>
            </div>
          </div>
        </div>

        <div className={`${isLarge ? 'mt-4 pt-4 border-t border-neutral-700' : 'mt-2'}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">
              {startYear}–{endYear}
            </span>
            <span className={status.color}>
              {seasonsLeft <= 1 && '⚠️ '}{status.label}
            </span>
          </div>
          {deal.guaranteed && (
            <div className="mt-1 text-xs text-emerald-400">
              ✓ Guaranteed payment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EmptySlotProps {
  tier: SponsorTier;
  variant: 'large' | 'medium' | 'compact';
  onClick?: () => void;
}

function EmptySlot({ tier, variant, onClick }: EmptySlotProps) {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  const baseClasses = 'cursor-pointer transition-colors hover:border-neutral-500 hover:bg-neutral-800/50';

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-800/30 min-w-[100px] ${baseClasses}`}
      >
        <span className="text-2xl text-neutral-600">+</span>
        <span className="text-xs text-neutral-500 mt-1">Empty</span>
      </button>
    );
  }

  const isLarge = variant === 'large';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card ${isLarge ? 'p-6' : 'p-4'} flex items-center justify-center border-2 border-dashed border-neutral-700 bg-neutral-800/30 w-full ${baseClasses}`}
      style={{ minHeight: isLarge ? EMPTY_SLOT_MIN_HEIGHT.large : EMPTY_SLOT_MIN_HEIGHT.medium }}
    >
      <div className="text-center">
        <div className={`${isLarge ? 'text-4xl' : 'text-2xl'} text-neutral-600 mb-2`}>+</div>
        <div className="text-sm text-neutral-500">Empty {tierLabel} Slot</div>
        <div className="text-xs text-neutral-600 mt-1">Click to browse sponsors</div>
      </div>
    </button>
  );
}

interface MinorSponsorChipProps {
  sponsor: Sponsor;
  deal: ActiveSponsorDeal;
  currentSeason: number;
}

function MinorSponsorChip({ sponsor, deal, currentSeason }: MinorSponsorChipProps) {
  const status = getContractStatus(deal, currentSeason);
  const startYear = seasonToYear(deal.startSeason);
  const endYear = seasonToYear(deal.endSeason);

  return (
    <div className="flex flex-col items-center p-3 rounded-lg bg-neutral-800/50 border border-neutral-700 min-w-[100px]">
      <div className="mb-2">
        <SponsorLogo sponsor={sponsor} size="sm" />
      </div>

      <div className="text-xs font-medium text-primary text-center truncate w-full" title={sponsor.name}>
        {sponsor.name}
      </div>

      <div className="text-xs text-secondary mt-1">
        ${formatCompact(deal.monthlyPayment)}/mo
      </div>

      <div className={`text-xs mt-1 ${status.color}`}>
        {startYear}-{endYear.toString().slice(-2)}
      </div>
    </div>
  );
}

interface TierSectionProps {
  title: string;
  tier: SponsorTier;
  deals: ActiveSponsorDeal[];
  sponsors: Sponsor[];
  currentSeason: number;
  slotCount: number;
  onEmptySlotClick?: (tier: SponsorTier) => void;
}

function TierSection({ title, tier, deals, sponsors, currentSeason, slotCount, onEmptySlotClick }: TierSectionProps) {
  const isTitle = tier === SponsorTier.Title;
  const isMinor = tier === SponsorTier.Minor;

  const slots = Array.from({ length: slotCount }, (_, i) => deals[i] ?? null);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-secondary uppercase tracking-wide">
        {title}
      </h2>

      {isMinor ? (
        <div className="flex flex-wrap gap-3">
          {slots.map((deal, index) => {
            if (!deal) {
              return <EmptySlot key={`empty-${index}`} tier={tier} variant="compact" onClick={() => onEmptySlotClick?.(tier)} />;
            }
            const sponsor = getSponsorById(sponsors, deal.sponsorId);
            if (!sponsor) return null;
            return (
              <MinorSponsorChip
                key={deal.sponsorId}
                sponsor={sponsor}
                deal={deal}
                currentSeason={currentSeason}
              />
            );
          })}
        </div>
      ) : (
        <div className={isTitle ? '' : 'grid grid-cols-3 gap-4'}>
          {slots.map((deal, index) => {
            if (!deal) {
              return (
                <EmptySlot
                  key={`empty-${index}`}
                  tier={tier}
                  variant={isTitle ? 'large' : 'medium'}
                  onClick={() => onEmptySlotClick?.(tier)}
                />
              );
            }
            const sponsor = getSponsorById(sponsors, deal.sponsorId);
            if (!sponsor) return null;
            return (
              <SponsorCard
                key={deal.sponsorId}
                sponsor={sponsor}
                deal={deal}
                currentSeason={currentSeason}
                variant={isTitle ? 'large' : 'medium'}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===========================================
// SUMMARY PANEL
// ===========================================

interface SponsorData {
  titleDeals: ActiveSponsorDeal[];
  majorDeals: ActiveSponsorDeal[];
  minorDeals: ActiveSponsorDeal[];
  totalMonthly: number;
  titleMonthly: number;
  majorMonthly: number;
  minorMonthly: number;
}

function computeSponsorData(gameState: GameState, playerTeamId: string): SponsorData {
  const teamDeals = gameState.sponsorDeals.filter((d) => d.teamId === playerTeamId);

  const titleDeals = teamDeals.filter((d) => d.tier === SponsorTier.Title);
  const majorDeals = teamDeals.filter((d) => d.tier === SponsorTier.Major);
  const minorDeals = teamDeals.filter((d) => d.tier === SponsorTier.Minor);

  const titleMonthly = titleDeals.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const majorMonthly = majorDeals.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const minorMonthly = minorDeals.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const totalMonthly = titleMonthly + majorMonthly + minorMonthly;

  return { titleDeals, majorDeals, minorDeals, totalMonthly, titleMonthly, majorMonthly, minorMonthly };
}

interface SponsorsSummaryProps {
  onEmptySlotClick?: (tier: SponsorTier) => void;
}

function SponsorsSummary({ onEmptySlotClick }: SponsorsSummaryProps) {
  const { gameState, isLoading } = useDerivedGameState();

  const sponsorData = useMemo(() => {
    if (!gameState) return null;
    return computeSponsorData(gameState, gameState.player.teamId);
  }, [gameState]);

  if (isLoading) return <p className="text-muted">Loading...</p>;
  if (!gameState || !sponsorData) return <p className="text-muted">No game data available.</p>;

  const currentSeason = gameState.currentSeason.seasonNumber;
  const sponsors = gameState.sponsors;

  return (
    <div className="space-y-6">
      <IncomeSummary
        totalMonthly={sponsorData.totalMonthly}
        titleIncome={sponsorData.titleMonthly}
        majorIncome={sponsorData.majorMonthly}
        minorIncome={sponsorData.minorMonthly}
      />

      <TierSection
        title="Title Sponsor"
        tier={SponsorTier.Title}
        deals={sponsorData.titleDeals}
        sponsors={sponsors}
        currentSeason={currentSeason}
        slotCount={SLOT_COUNTS[SponsorTier.Title]}
        onEmptySlotClick={onEmptySlotClick}
      />

      <TierSection
        title="Major Sponsors"
        tier={SponsorTier.Major}
        deals={sponsorData.majorDeals}
        sponsors={sponsors}
        currentSeason={currentSeason}
        slotCount={SLOT_COUNTS[SponsorTier.Major]}
        onEmptySlotClick={onEmptySlotClick}
      />

      <TierSection
        title="Minor Sponsors"
        tier={SponsorTier.Minor}
        deals={sponsorData.minorDeals}
        sponsors={sponsors}
        currentSeason={currentSeason}
        slotCount={SLOT_COUNTS[SponsorTier.Minor]}
        onEmptySlotClick={onEmptySlotClick}
      />
    </div>
  );
}

// ===========================================
// RENEWALS PANEL
// ===========================================

interface RenewalCardProps {
  deal: ActiveSponsorDeal;
  sponsor: Sponsor;
  renewalPayment: number;
  onAccept: () => void;
  onDecline: () => void;
  onCounter: () => void;
}

function RenewalCard({ deal, sponsor, renewalPayment, onAccept, onDecline, onCounter }: RenewalCardProps) {
  const startYear = seasonToYear(deal.startSeason);
  const endYear = seasonToYear(deal.endSeason);
  const tierLabel = SPONSOR_TIER_LABELS[sponsor.tier];

  return (
    <div className="card p-4" style={ACCENT_CARD_STYLE}>
      <div className="flex items-start gap-4">
        <SponsorLogo sponsor={sponsor} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-primary">{sponsor.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-muted">{tierLabel}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/50 font-medium">
              Expiring
            </span>
          </div>
          <p className="text-sm text-muted mb-2">Current deal: {startYear}–{endYear}</p>

          <div className="mt-2 pt-2 border-t border-neutral-700">
            <p className="text-xs text-secondary font-medium mb-1">Renewal offer (1 season)</p>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted">Monthly:</span>
                <span className="text-primary font-medium ml-2">{formatCurrency(renewalPayment)}</span>
              </div>
              <div>
                <span className="text-muted">Signing bonus:</span>
                <span className="text-muted ml-2">None</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={onDecline}
          className={`btn cursor-pointer flex-1 px-4 py-2 text-sm ${GHOST_BORDERED_BUTTON_CLASSES}`}
        >
          Decline
        </button>
        <button
          type="button"
          onClick={onCounter}
          className={`btn cursor-pointer flex-1 px-4 py-2 text-sm font-medium ${GHOST_BORDERED_BUTTON_CLASSES}`}
        >
          Counter
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="btn cursor-pointer flex-1 px-4 py-2 text-sm font-medium"
          style={ACCENT_BORDERED_BUTTON_STYLE}
        >
          Accept
        </button>
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

interface ContactSponsorState {
  sponsor: Sponsor;
  initialTerms?: RenewalInitialTerms;
}

interface SponsorsProps {
  initialTab?: SponsorsTab;
  onTabChange?: (tab: SponsorsTab) => void;
}

export function Sponsors({ initialTab, onTabChange }: SponsorsProps) {
  const [activeTab, setActiveTab] = useState<SponsorsTab>(initialTab ?? 'summary');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [contactSponsorState, setContactSponsorState] = useState<ContactSponsorState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { gameState, isLoading } = useDerivedGameState();
  const queryClient = useQueryClient();

  const refreshGameState = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.gameState });
  }, [queryClient]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Derived state
  const playerDealsList = useMemo(() => {
    if (!gameState) return [] as ActiveSponsorDeal[];
    return gameState.sponsorDeals.filter((d) => d.teamId === gameState.player.teamId);
  }, [gameState]);

  const playerDeals = useMemo(() => new Set(playerDealsList.map((d) => d.sponsorId)), [playerDealsList]);

  const allNegotiations = useMemo(() => {
    if (!gameState) return [];
    return gameState.negotiations.filter(
      (n): n is SponsorNegotiation =>
        n.stakeholderType === StakeholderType.Sponsor &&
        n.teamId === gameState.player.teamId
    );
  }, [gameState]);

  const needsAttention = useMemo(() =>
    allNegotiations.filter(
      (n) => n.phase === NegotiationPhase.ResponseReceived || n.phase === NegotiationPhase.PendingPlayerConfirmation
    ), [allNegotiations]);

  const sentNegotiations = useMemo(() =>
    allNegotiations.filter((n) => n.phase === NegotiationPhase.AwaitingResponse),
    [allNegotiations]);

  const historyNegotiations = useMemo(() =>
    allNegotiations.filter(
      (n) => n.phase === NegotiationPhase.Failed || n.phase === NegotiationPhase.Completed
    ), [allNegotiations]);

  const activeNegotiationBySponsorId = useMemo(() => {
    const map = new Map<string, SponsorNegotiation>();
    for (const n of allNegotiations) {
      if (n.phase !== NegotiationPhase.Completed && n.phase !== NegotiationPhase.Failed) {
        map.set(n.sponsorId, n);
      }
    }
    return map;
  }, [allNegotiations]);

  const tierSlotsFull = useMemo(() => {
    if (!gameState) return {} as Record<SponsorTier, boolean>;
    const playerTeamId = gameState.player.teamId;
    const result = {} as Record<SponsorTier, boolean>;
    for (const tier of Object.values(SponsorTier)) {
      const dealCount = gameState.sponsorDeals.filter(
        (d) => d.teamId === playerTeamId && d.tier === tier
      ).length;
      result[tier] = dealCount >= SPONSOR_SLOT_COUNTS[tier];
    }
    return result;
  }, [gameState]);

  const { teamPosition, totalTeams } = useMemo(() => {
    if (!gameState) return { teamPosition: 1, totalTeams: 10 };
    const standings = gameState.currentSeason.constructorStandings;
    const standing = standings.find((s) => s.teamId === gameState.player.teamId);
    return {
      teamPosition: standing?.position ?? standings.length,
      totalTeams: Math.max(standings.length, 1),
    };
  }, [gameState]);

  const filteredSponsors = useMemo(() => {
    if (!gameState) return [];
    let sponsors = gameState.sponsors;
    if (tierFilter !== 'all') {
      sponsors = sponsors.filter((s) => s.tier === tierFilter);
    }
    const tierOrder = { [SponsorTier.Title]: 0, [SponsorTier.Major]: 1, [SponsorTier.Minor]: 2 };
    return [...sponsors].sort((a, b) => {
      const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.baseMonthlyPayment - a.baseMonthlyPayment;
    });
  }, [gameState, tierFilter]);

  // Renewal deals (expiring at end of current season)
  const renewalDeals = useMemo(() => {
    if (!gameState) return [];
    const currentSeason = gameState.currentSeason.seasonNumber;
    return playerDealsList.filter((d) => d.endSeason === currentSeason);
  }, [gameState, playerDealsList]);

  // Tab switching
  const handleTabChange = (tab: SponsorsTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleEmptySlotClick = (tier: SponsorTier) => {
    setTierFilter(tier);
    setActiveTab('browse');
    onTabChange?.('browse');
  };

  // Handlers
  const handleStartNegotiation = useCallback(async (terms: SponsorContractTerms) => {
    if (!contactSponsorState) return;
    const sponsorName = contactSponsorState.sponsor.name;
    try {
      await window.electronAPI.invoke(IpcChannels.SPONSOR_START_NEGOTIATION, {
        sponsorId: contactSponsorState.sponsor.id,
        terms,
      });
      refreshGameState();
      setContactSponsorState(null);
      showToast(`Proposal sent to ${sponsorName}.`);
    } catch (error) {
      console.error('Failed to start negotiation:', error);
    }
  }, [contactSponsorState, refreshGameState, showToast]);

  const handleRespondToOffer = useCallback(async (negotiationId: string, response: 'accept' | 'reject') => {
    try {
      await window.electronAPI.invoke(IpcChannels.SPONSOR_RESPOND_TO_OFFER, { negotiationId, response });
      refreshGameState();
    } catch (error) {
      console.error('Failed to respond to offer:', error);
    }
  }, [refreshGameState]);

  const handleSign = useCallback(async (negotiationId: string) => {
    try {
      await window.electronAPI.invoke(IpcChannels.SPONSOR_SIGN, negotiationId);
      refreshGameState();
    } catch (error) {
      console.error('Failed to sign deal:', error);
    }
  }, [refreshGameState]);

  const handleDecline = useCallback(async (negotiationId: string) => {
    try {
      await window.electronAPI.invoke(IpcChannels.SPONSOR_DECLINE, negotiationId);
      refreshGameState();
    } catch (error) {
      console.error('Failed to decline deal:', error);
    }
  }, [refreshGameState]);

  const handleAcceptRenewal = useCallback(async (sponsorId: string) => {
    try {
      await window.electronAPI.invoke(IpcChannels.SPONSOR_ACCEPT_RENEWAL, sponsorId);
      refreshGameState();
    } catch (error) {
      console.error('Failed to accept renewal:', error);
    }
  }, [refreshGameState]);

  const handleDeclineRenewal = useCallback(async (sponsorId: string) => {
    try {
      await window.electronAPI.invoke(IpcChannels.SPONSOR_DECLINE_RENEWAL, sponsorId);
      refreshGameState();
    } catch (error) {
      console.error('Failed to decline renewal:', error);
    }
  }, [refreshGameState]);

  const handleCounterRenewal = useCallback((deal: ActiveSponsorDeal, sponsor: Sponsor) => {
    const renewalPayment = calculateWillingPayment(sponsor, teamPosition, totalTeams);
    const initialTerms: RenewalInitialTerms = {
      monthlyPayment: renewalPayment,
      signingBonus: 0,
      duration: '1' as DurationValue,
    };
    setContactSponsorState({ sponsor, initialTerms });
  }, [teamPosition, totalTeams]);

  const activeNegotiationCount = needsAttention.length;

  const renewalCount = renewalDeals.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SectionHeading>Sponsors</SectionHeading>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="space-y-4">
        <SectionHeading>Sponsors</SectionHeading>
        <p className="text-muted">No game data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading>Sponsors</SectionHeading>

      <TabBar<SponsorsTab>
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        badge={
          activeNegotiationCount > 0
            ? { tabId: 'negotiations', count: activeNegotiationCount }
            : renewalCount > 0
            ? { tabId: 'renewals', count: renewalCount }
            : undefined
        }
      />

      {activeTab === 'summary' && (
        <SponsorsSummary onEmptySlotClick={handleEmptySlotClick} />
      )}

      {activeTab === 'browse' && (
        <div className="space-y-4">
          <div className="card p-4" style={ACCENT_CARD_STYLE}>
            <div className="flex items-start gap-3">
              <div className="text-blue-400 text-xl">{'ℹ️'}</div>
              <div>
                <h3 className="text-sm font-semibold text-primary mb-1">Sponsor Negotiations</h3>
                <p className="text-xs text-muted">
                  Contact sponsors to negotiate deals for next season. Higher-tier sponsors pay more
                  but have stricter requirements. Your team's championship position affects their interest.
                </p>
              </div>
            </div>
          </div>

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

          <div className="space-y-3">
            {filteredSponsors.map((sponsor) => {
              const isContracted = playerDeals.has(sponsor.id);
              const activeNeg = activeNegotiationBySponsorId.get(sponsor.id) ?? null;
              const isNegotiating = activeNeg !== null;
              const isSlotFull = !isContracted && !isNegotiating && tierSlotsFull[sponsor.tier];
              const rivalConflictName = isContracted
                ? null
                : getRivalConflictName(sponsor, playerDealsList, gameState.sponsors);
              const repStanding = getReputationStanding(teamPosition, totalTeams, sponsor.minReputation);
              const repRatio = computeReputationRatio(teamPosition, totalTeams, sponsor.minReputation);
              const isBelowRepFloor = !isContracted && repRatio < HARD_GATE_MULTIPLIER;

              return (
                <BrowseSponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  isContracted={isContracted}
                  isNegotiating={isNegotiating}
                  isSlotFull={isSlotFull}
                  rivalConflictName={rivalConflictName}
                  isBelowRepFloor={isBelowRepFloor}
                  repStanding={repStanding}
                  negotiationId={activeNeg?.id ?? null}
                  onContact={() => setContactSponsorState({ sponsor })}
                  onViewNegotiations={() => handleTabChange('negotiations')}
                />
              );
            })}
            {filteredSponsors.length === 0 && (
              <p className="text-center text-muted py-8">No sponsors found matching filter.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'negotiations' && (
        <div className="space-y-2">
          <SectionHeader title="Needs your attention" count={needsAttention.length} />
          {needsAttention.length === 0 ? (
            <p className="text-sm text-muted px-1 pb-2">Nothing needs your attention right now.</p>
          ) : (
            <div className="space-y-3 pb-2">
              {needsAttention.map((negotiation) => {
                const sponsor = gameState.sponsors.find((s) => s.id === negotiation.sponsorId);
                if (!sponsor) return null;
                const slotFilled = negotiation.phase === NegotiationPhase.PendingPlayerConfirmation
                  ? tierSlotsFull[sponsor.tier]
                  : false;
                return (
                  <NegotiationCard
                    key={negotiation.id}
                    negotiation={negotiation}
                    sponsor={sponsor}
                    isSlotFilled={slotFilled}
                    onAccept={() => handleRespondToOffer(negotiation.id, 'accept')}
                    onReject={() => handleRespondToOffer(negotiation.id, 'reject')}
                    onSign={() => handleSign(negotiation.id)}
                    onDecline={() => handleDecline(negotiation.id)}
                  />
                );
              })}
            </div>
          )}

          <SectionHeader title="Sent" count={sentNegotiations.length} />
          {sentNegotiations.length === 0 ? (
            <p className="text-sm text-muted px-1 pb-2">No proposals awaiting a response.</p>
          ) : (
            <div className="space-y-3 pb-2">
              {sentNegotiations.map((negotiation) => {
                const sponsor = gameState.sponsors.find((s) => s.id === negotiation.sponsorId);
                if (!sponsor) return null;
                return (
                  <NegotiationCard
                    key={negotiation.id}
                    negotiation={negotiation}
                    sponsor={sponsor}
                  />
                );
              })}
            </div>
          )}

          <SectionHeader
            title="History"
            count={historyNegotiations.length}
            collapsible
            collapsed={historyCollapsed}
            onToggle={() => setHistoryCollapsed((c) => !c)}
          />
          {!historyCollapsed && (
            <div className="space-y-3 pb-2">
              {historyNegotiations.length === 0 ? (
                <p className="text-sm text-muted px-1">No history yet.</p>
              ) : (
                historyNegotiations.map((negotiation) => {
                  const sponsor = gameState.sponsors.find((s) => s.id === negotiation.sponsorId);
                  if (!sponsor) return null;
                  return (
                    <NegotiationCard
                      key={negotiation.id}
                      negotiation={negotiation}
                      sponsor={sponsor}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'renewals' && (
        <div className="space-y-3">
          {renewalDeals.length === 0 ? (
            <div className="card p-6 text-center" style={ACCENT_CARD_STYLE}>
              <p className="text-muted">No deals are up for renewal this season.</p>
            </div>
          ) : (
            renewalDeals.map((deal) => {
              const sponsor = gameState.sponsors.find((s) => s.id === deal.sponsorId);
              if (!sponsor) return null;
              const renewalPayment = calculateWillingPayment(sponsor, teamPosition, totalTeams);
              return (
                <RenewalCard
                  key={deal.sponsorId}
                  deal={deal}
                  sponsor={sponsor}
                  renewalPayment={renewalPayment}
                  onAccept={() => handleAcceptRenewal(deal.sponsorId)}
                  onDecline={() => handleDeclineRenewal(deal.sponsorId)}
                  onCounter={() => handleCounterRenewal(deal, sponsor)}
                />
              );
            })
          )}
        </div>
      )}

      {/* Contact Modal (Browse → Contact, or Renewals → Counter) */}
      {contactSponsorState && (
        <ContactModal
          sponsor={contactSponsorState.sponsor}
          teamPosition={teamPosition}
          totalTeams={totalTeams}
          existingPlayerDeals={playerDealsList}
          allSponsors={gameState.sponsors}
          onClose={() => setContactSponsorState(null)}
          onSubmit={handleStartNegotiation}
          initialTerms={contactSponsorState.initialTerms}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}
