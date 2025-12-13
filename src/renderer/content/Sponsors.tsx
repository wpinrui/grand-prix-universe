import { useState, useMemo } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, TabBar } from '../components';
import type { Tab } from '../components';
import { ACCENT_CARD_STYLE } from '../utils/theme-styles';
import { Deals } from './Deals';
import { formatCurrency, formatCompact } from '../utils/format';
import { seasonToYear } from '../../shared/utils/date-utils';
import {
  SponsorTier,
  type Sponsor,
  type ActiveSponsorDeal,
  type GameState,
} from '../../shared/domain';

// ===========================================
// TYPES
// ===========================================

type SponsorsTab = 'summary' | 'deals';

// ===========================================
// CONSTANTS
// ===========================================

const TABS: Tab<SponsorsTab>[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'deals', label: 'Deals' },
];

/** Fixed slot counts per tier */
const SLOT_COUNTS: Record<SponsorTier, number> = {
  [SponsorTier.Title]: 1,
  [SponsorTier.Major]: 3,
  [SponsorTier.Minor]: 5,
};

/** Industry icons (Lucide icon names mapped to emoji for now) */
const INDUSTRY_ICONS: Record<string, string> = {
  'oil-gas': '\u26FD', // fuel pump
  technology: '\u{1F4BB}', // laptop
  finance: '\u{1F4B3}', // credit card
  telecommunications: '\u{1F4F1}', // mobile phone
  payments: '\u{1F4B8}', // money with wings
  'water-technology': '\u{1F4A7}', // droplet
  consulting: '\u{1F4BC}', // briefcase
  aviation: '\u2708\uFE0F', // airplane
  luxury: '\u{1F48E}', // gem
  beverages: '\u{1F37A}', // beer mug
  logistics: '\u{1F4E6}', // package
  apparel: '\u{1F455}', // t-shirt
  insurance: '\u{1F6E1}\uFE0F', // shield
  tyres: '\u{1F6DE}', // wheel
  components: '\u2699\uFE0F', // gear
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

function getContractStatus(deal: ActiveSponsorDeal, currentSeason: number): { label: string; isExpiring: boolean } {
  const seasonsLeft = deal.endSeason - currentSeason;
  if (seasonsLeft <= 0) {
    return { label: 'Final Year', isExpiring: true };
  }
  if (seasonsLeft === 1) {
    return { label: '1 year left', isExpiring: true };
  }
  return { label: `${seasonsLeft} years left`, isExpiring: false };
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

interface SponsorLogoProps {
  sponsor: Sponsor;
  size: 'sm' | 'md' | 'lg';
}

/** Reusable sponsor logo with industry icon fallback */
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
              {startYear}-{endYear}
            </span>
            <span className={status.isExpiring ? 'text-amber-400' : 'text-muted'}>
              {status.isExpiring && '\u26A0\uFE0F '}{status.label}
            </span>
          </div>
          {deal.guaranteed && (
            <div className="mt-1 text-xs text-emerald-400">
              \u2713 Guaranteed payment
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
}

function EmptySlot({ tier, variant }: EmptySlotProps) {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  if (variant === 'compact') {
    return (
      <div className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-800/30 min-w-[100px]">
        <span className="text-2xl text-neutral-600">+</span>
        <span className="text-xs text-neutral-500 mt-1">Empty</span>
      </div>
    );
  }

  const isLarge = variant === 'large';

  return (
    <div
      className={`card ${isLarge ? 'p-6' : 'p-4'} flex items-center justify-center border-2 border-dashed border-neutral-700 bg-neutral-800/30`}
      style={{ minHeight: isLarge ? EMPTY_SLOT_MIN_HEIGHT.large : EMPTY_SLOT_MIN_HEIGHT.medium }}
    >
      <div className="text-center">
        <div className={`${isLarge ? 'text-4xl' : 'text-2xl'} text-neutral-600 mb-2`}>+</div>
        <div className="text-sm text-neutral-500">Empty {tierLabel} Slot</div>
        <div className="text-xs text-neutral-600 mt-1">Go to Deals to find sponsors</div>
      </div>
    </div>
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

      {/* Name */}
      <div className="text-xs font-medium text-primary text-center truncate w-full" title={sponsor.name}>
        {sponsor.name}
      </div>

      {/* Payment */}
      <div className="text-xs text-secondary mt-1">
        ${formatCompact(deal.monthlyPayment)}/mo
      </div>

      {/* Contract */}
      <div className={`text-xs mt-1 ${status.isExpiring ? 'text-amber-400' : 'text-muted'}`}>
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
}

function TierSection({ title, tier, deals, sponsors, currentSeason, slotCount }: TierSectionProps) {
  const isTitle = tier === SponsorTier.Title;
  const isMinor = tier === SponsorTier.Minor;

  // Create slots array with deals + empty slots
  const slots = Array.from({ length: slotCount }, (_, i) => deals[i] ?? null);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-secondary uppercase tracking-wide">
        {title}
      </h2>

      {isMinor ? (
        // Minor sponsors: compact row
        <div className="flex flex-wrap gap-3">
          {slots.map((deal, index) => {
            if (!deal) {
              return <EmptySlot key={`empty-${index}`} tier={tier} variant="compact" />;
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
        // Title/Major sponsors: cards
        <div className={isTitle ? '' : 'grid grid-cols-3 gap-4'}>
          {slots.map((deal, index) => {
            if (!deal) {
              return (
                <EmptySlot
                  key={`empty-${index}`}
                  tier={tier}
                  variant={isTitle ? 'large' : 'medium'}
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
// MAIN COMPONENT
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

  return {
    titleDeals,
    majorDeals,
    minorDeals,
    totalMonthly,
    titleMonthly,
    majorMonthly,
    minorMonthly,
  };
}

function SponsorsSummary() {
  const { gameState, isLoading } = useDerivedGameState();

  const sponsorData = useMemo(() => {
    if (!gameState) return null;
    return computeSponsorData(gameState, gameState.player.teamId);
  }, [gameState]);

  if (isLoading) {
    return <p className="text-muted">Loading...</p>;
  }

  if (!gameState || !sponsorData) {
    return <p className="text-muted">No game data available.</p>;
  }

  const currentSeason = gameState.currentSeason.seasonNumber;
  const sponsors = gameState.sponsors;

  return (
    <div className="space-y-6">
      {/* Income Summary */}
      <IncomeSummary
        totalMonthly={sponsorData.totalMonthly}
        titleIncome={sponsorData.titleMonthly}
        majorIncome={sponsorData.majorMonthly}
        minorIncome={sponsorData.minorMonthly}
      />

      {/* Title Sponsor */}
      <TierSection
        title="Title Sponsor"
        tier={SponsorTier.Title}
        deals={sponsorData.titleDeals}
        sponsors={sponsors}
        currentSeason={currentSeason}
        slotCount={SLOT_COUNTS[SponsorTier.Title]}
      />

      {/* Major Sponsors */}
      <TierSection
        title="Major Sponsors"
        tier={SponsorTier.Major}
        deals={sponsorData.majorDeals}
        sponsors={sponsors}
        currentSeason={currentSeason}
        slotCount={SLOT_COUNTS[SponsorTier.Major]}
      />

      {/* Minor Sponsors */}
      <TierSection
        title="Minor Sponsors"
        tier={SponsorTier.Minor}
        deals={sponsorData.minorDeals}
        sponsors={sponsors}
        currentSeason={currentSeason}
        slotCount={SLOT_COUNTS[SponsorTier.Minor]}
      />
    </div>
  );
}

interface SponsorsProps {
  initialTab?: string;
  onTabChange?: (tab: SponsorsTab) => void;
}

export function Sponsors({ initialTab, onTabChange }: SponsorsProps) {
  const resolvedInitialTab = (initialTab === 'summary' || initialTab === 'deals') ? initialTab : 'summary';
  const [activeTab, setActiveTab] = useState<SponsorsTab>(resolvedInitialTab);

  const handleTabChange = (tab: SponsorsTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="space-y-4">
      <SectionHeading>Sponsors</SectionHeading>

      <TabBar<SponsorsTab>
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {activeTab === 'summary' && <SponsorsSummary />}
      {activeTab === 'deals' && <Deals embedded />}
    </div>
  );
}
