import { useState, useMemo, useCallback } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, TabBar } from '../components';
import type { Tab } from '../components';
import { ACCENT_CARD_STYLE, GHOST_BORDERED_BUTTON_CLASSES, PRIMARY_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatCurrency } from '../utils/format';
import { seasonToYear } from '../../shared/utils/date-utils';
import { IpcChannels } from '../../shared/ipc';
import {
  DriverRole,
  ManufacturerType,
  NegotiationPhase,
  StakeholderType,
  type Manufacturer,
  type ActiveManufacturerContract,
  type TeamEngineState,
  type CarEngineState,
  type EngineStats,
  type Driver,
  type ManufacturerSpecState,
  type Team,
  type TeamEngineAnalytics,
  type GameState,
  type ManufacturerNegotiation,
  type ContractTerms,
} from '../../shared/domain';
import {
  ENGINE_STAT_KEYS,
  getEffectiveEngineStats,
  getSpecBonusesAsEngineStats,
  calculateAverageEstimatedPower,
  calculateAnalyticsConfidence,
  ANALYTICS_CONFIDENCE_LOW_THRESHOLD,
  ANALYTICS_CONFIDENCE_HIGH_THRESHOLD,
  isContractExpiring,
} from '../../shared/domain/engine-utils';

// ===========================================
// TYPES
// ===========================================

type ContractsTab = 'current' | 'analytics' | 'negotiation';

// ===========================================
// CONSTANTS
// ===========================================

const TABS: Tab<ContractsTab>[] = [
  { id: 'current', label: 'Current Contract' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'negotiation', label: 'Negotiation' },
];

const STAT_LABELS: Record<keyof EngineStats, string> = {
  power: 'Power',
  fuelEfficiency: 'Fuel Efficiency',
  reliability: 'Reliability',
  heat: 'Heat Management',
  predictability: 'Predictability',
};

const STAT_DESCRIPTIONS: Record<keyof EngineStats, string> = {
  power: 'Raw speed and lap time',
  fuelEfficiency: 'Fuel usage per lap',
  reliability: 'Resistance to mechanical failures',
  heat: 'Performance in hot conditions',
  predictability: 'Consistency and driver error reduction',
};

interface EngineContractData {
  contract: ActiveManufacturerContract | null;
  manufacturer: Manufacturer | null;
  engineState: TeamEngineState | null;
  specState: ManufacturerSpecState | null;
  car1Driver: Driver | null;
  car2Driver: Driver | null;
}

const NULL_CONTRACT_DATA: EngineContractData = {
  contract: null,
  manufacturer: null,
  engineState: null,
  specState: null,
  car1Driver: null,
  car2Driver: null,
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function getContractYears(contract: ActiveManufacturerContract, currentSeason: number): string {
  const startYear = seasonToYear(contract.startSeason);
  const endYear = seasonToYear(contract.endSeason);
  if (contract.endSeason === currentSeason) {
    return `${startYear}-${endYear} (Final Year)`;
  }
  return `${startYear}-${endYear}`;
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

interface StatBarProps {
  label: string;
  description: string;
  value: number;
  customisation: number;
  maxValue?: number;
}

function StatBar({ label, description, value, customisation, maxValue = 100 }: StatBarProps) {
  const displayValue = Math.round(value);
  const percentFilled = (value / maxValue) * 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-secondary" title={description}>
          {label}
        </span>
        <span className="text-primary font-medium">
          {displayValue}
          {customisation !== 0 && (
            <span className={customisation > 0 ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
              ({customisation > 0 ? '+' : ''}{customisation})
            </span>
          )}
        </span>
      </div>
      <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full transition-all"
          style={{ width: `${Math.min(100, percentFilled)}%` }}
        />
      </div>
    </div>
  );
}

interface CarEngineCardProps {
  carNumber: 1 | 2;
  driver: Driver | null;
  carEngine: CarEngineState;
  baseStats: EngineStats;
  specBonuses: EngineStats[];
  onUpgrade?: () => void;
  onCustomise?: () => void;
  latestSpec: number;
}

function CarEngineCard({
  carNumber,
  driver,
  carEngine,
  baseStats,
  specBonuses,
  onUpgrade,
  onCustomise,
  latestSpec,
}: CarEngineCardProps) {
  const effectiveStats = getEffectiveEngineStats(
    baseStats,
    carEngine.specVersion,
    specBonuses,
    carEngine.customisation
  );

  const isLatestSpec = carEngine.specVersion >= latestSpec;
  const driverName = driver ? `${driver.firstName} ${driver.lastName}` : `Car ${carNumber}`;

  return (
    <div className="card p-4" style={ACCENT_CARD_STYLE}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">Car {carNumber}</h3>
          <p className="text-sm text-muted">{driverName}</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-secondary">Spec Version</div>
          <div className={`text-lg font-bold ${isLatestSpec ? 'text-emerald-400' : 'text-amber-400'}`}>
            {carEngine.specVersion}.0
          </div>
          {!isLatestSpec && (
            <div className="text-xs text-amber-400">
              Latest: {latestSpec}.0
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {ENGINE_STAT_KEYS.map((key) => (
          <StatBar
            key={key}
            label={STAT_LABELS[key]}
            description={STAT_DESCRIPTIONS[key]}
            value={effectiveStats[key]}
            customisation={carEngine.customisation[key]}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`${GHOST_BORDERED_BUTTON_CLASSES} flex-1 text-sm cursor-pointer`}
          onClick={onUpgrade}
          disabled={isLatestSpec}
          title={isLatestSpec ? 'Already on latest spec' : 'Purchase fresh engine with latest spec'}
        >
          {isLatestSpec ? 'Latest Spec' : 'Upgrade Engine'}
        </button>
        <button
          type="button"
          className={`${GHOST_BORDERED_BUTTON_CLASSES} flex-1 text-sm cursor-pointer`}
          onClick={onCustomise}
          title="Reallocate engine stats"
        >
          Customise
        </button>
      </div>
    </div>
  );
}

interface CurrentContractTabProps {
  manufacturer: Manufacturer;
  contract: ActiveManufacturerContract;
  engineState: TeamEngineState;
  specState: ManufacturerSpecState;
  currentSeason: number;
  car1Driver: Driver | null;
  car2Driver: Driver | null;
  onUpgradeCar: (carNumber: 1 | 2) => void;
  onBuyCustomisationPoints: () => void;
  onBuyOptimisation: () => void;
}

function CurrentContractTab({
  manufacturer,
  contract,
  engineState,
  specState,
  currentSeason,
  car1Driver,
  car2Driver,
  onUpgradeCar,
  onBuyCustomisationPoints,
  onBuyOptimisation,
}: CurrentContractTabProps) {
  // Get spec bonuses from manufacturer spec state
  const specBonuses = getSpecBonusesAsEngineStats(specState);
  const latestSpec = specState.latestSpecVersion;

  return (
    <div className="space-y-6">
      {/* Contract Overview */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-primary">{manufacturer.name}</h2>
            <p className="text-sm text-muted">Engine Supplier</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-secondary">Contract Period</div>
            <div className="text-lg font-semibold text-primary">
              {getContractYears(contract, currentSeason)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-neutral-700">
          <div>
            <div className="text-sm text-muted">Annual Cost</div>
            <div className="text-lg font-semibold text-primary">
              {formatCurrency(contract.annualCost)}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted">Pre-Paid Upgrades</div>
            <div className="text-lg font-semibold text-primary">
              {engineState.preNegotiatedUpgrades} remaining
            </div>
          </div>
          <div>
            <div className="text-sm text-muted">Customisation Points</div>
            <div className="text-lg font-semibold text-primary">
              {engineState.customisationPointsOwned} owned
            </div>
          </div>
        </div>
      </div>

      {/* Per-Car Engine Status */}
      <div className="grid grid-cols-2 gap-4">
        <CarEngineCard
          carNumber={1}
          driver={car1Driver}
          carEngine={engineState.car1Engine}
          baseStats={manufacturer.engineStats}
          specBonuses={specBonuses}
          latestSpec={latestSpec}
          onUpgrade={() => onUpgradeCar(1)}
          onCustomise={() => {/* Customisation modal - future PR */}}
        />
        <CarEngineCard
          carNumber={2}
          driver={car2Driver}
          carEngine={engineState.car2Engine}
          baseStats={manufacturer.engineStats}
          specBonuses={specBonuses}
          latestSpec={latestSpec}
          onUpgrade={() => onUpgradeCar(2)}
          onCustomise={() => {/* Customisation modal - future PR */}}
        />
      </div>

      {/* Actions Section */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <h3 className="text-lg font-semibold text-primary mb-4">Available Actions</h3>
        <div className="grid grid-cols-3 gap-4">
          <ActionCard
            title="Buy Customisation Points"
            description="Purchase flexibility points to reallocate engine stats (±10 max per stat)"
            cost={`${formatCurrency(manufacturer.costs.customisationPoint)} per point`}
            buttonLabel="Buy 1 Point"
            onClick={onBuyCustomisationPoints}
          />
          <ActionCard
            title="Pre-Season Optimisation"
            description="Tailor the engine to your car for a flat bonus to all stats next season"
            cost={formatCurrency(manufacturer.costs.optimisation)}
            buttonLabel={engineState.optimisationPurchasedForNextSeason ? 'Purchased' : 'Purchase'}
            disabled={engineState.optimisationPurchasedForNextSeason}
            onClick={onBuyOptimisation}
          />
          <ActionCard
            title="Ad-Hoc Engine Upgrade"
            description="Purchase a fresh engine with the latest spec for one car"
            cost={`${formatCurrency(manufacturer.costs.upgrade)} per engine`}
            buttonLabel="Purchase"
            disabled
          />
        </div>
      </div>
    </div>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  cost: string;
  buttonLabel: string;
  disabled?: boolean;
  onClick?: () => void;
}

function ActionCard({ title, description, cost, buttonLabel, disabled, onClick }: ActionCardProps) {
  return (
    <div className="p-4 bg-neutral-800/50 rounded-lg">
      <div className="text-sm font-medium text-primary mb-1">{title}</div>
      <div className="text-xs text-muted mb-2">{description}</div>
      <div className="text-sm text-secondary mb-2">{cost}</div>
      <button
        type="button"
        className={`${GHOST_BORDERED_BUTTON_CLASSES} w-full text-sm cursor-pointer`}
        disabled={disabled}
        onClick={onClick}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

// ===========================================
// ANALYTICS TAB
// ===========================================

interface AnalyticsTabProps {
  gameState: GameState;
  teams: Team[];
  playerTeamId: string;
}

/** Get team's engine manufacturer name */
function getTeamManufacturerName(
  teamId: string,
  gameState: GameState
): string {
  const contract = gameState.manufacturerContracts.find(
    (c) => c.teamId === teamId && c.type === ManufacturerType.Engine
  );
  if (!contract) return 'Unknown';

  const manufacturer = gameState.manufacturers.find(
    (m) => m.id === contract.manufacturerId
  );
  return manufacturer?.name ?? 'Unknown';
}

/** Confidence level display with color coding */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  let colorClass = 'text-red-400';
  let label = 'No Data';

  if (confidence === 0) {
    label = 'No Data';
    colorClass = 'text-neutral-500';
  } else if (confidence < ANALYTICS_CONFIDENCE_LOW_THRESHOLD) {
    label = 'Low';
    colorClass = 'text-red-400';
  } else if (confidence < ANALYTICS_CONFIDENCE_HIGH_THRESHOLD) {
    label = 'Medium';
    colorClass = 'text-amber-400';
  } else {
    label = 'High';
    colorClass = 'text-emerald-400';
  }

  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {label} ({confidence}%)
    </span>
  );
}

interface TeamAnalyticsRowProps {
  team: Team;
  analytics: TeamEngineAnalytics | undefined;
  manufacturerName: string;
  isPlayerTeam: boolean;
}

function TeamAnalyticsRow({
  team,
  analytics,
  manufacturerName,
  isPlayerTeam,
}: TeamAnalyticsRowProps) {
  const dataPoints = analytics?.dataPoints ?? [];
  const averagePower = calculateAverageEstimatedPower(dataPoints);
  const confidence = calculateAnalyticsConfidence(dataPoints.length);

  return (
    <tr className={`border-b border-neutral-700 ${isPlayerTeam ? 'bg-accent-900/20' : ''}`}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: team.primaryColor }}
          />
          <span className={`font-medium ${isPlayerTeam ? 'text-accent-400' : 'text-primary'}`}>
            {team.name}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-secondary">
        {manufacturerName}
      </td>
      <td className="py-3 px-4 text-center">
        {averagePower !== null ? (
          <span className="text-primary font-semibold">
            {averagePower.toFixed(1)}
          </span>
        ) : (
          <span className="text-neutral-500">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-center">
        {dataPoints.length}
      </td>
      <td className="py-3 px-4 text-center">
        <ConfidenceBadge confidence={confidence} />
      </td>
    </tr>
  );
}

function AnalyticsTab({ gameState, teams, playerTeamId }: AnalyticsTabProps) {
  const racesCompleted = gameState.currentSeason.calendar.filter((r) => r.completed).length;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="card p-4" style={ACCENT_CARD_STYLE}>
        <div className="flex items-start gap-3">
          <div className="text-amber-400 text-xl">ℹ️</div>
          <div>
            <h3 className="text-sm font-semibold text-primary mb-1">
              Engine Power Analytics
            </h3>
            <p className="text-xs text-muted">
              Estimated engine power for all teams. Data is collected after each race with ±8%
              measurement error. More races = more accurate estimates. Use this information to
              assess the competition and make strategic decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Data Status */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted">
          Data from {racesCompleted} race{racesCompleted !== 1 ? 's' : ''} this season
        </span>
        {racesCompleted === 0 && (
          <span className="text-amber-400">
            Complete races to collect engine performance data
          </span>
        )}
      </div>

      {/* Analytics Table */}
      <div className="card overflow-hidden" style={ACCENT_CARD_STYLE}>
        <table className="w-full">
          <thead className="bg-neutral-800/50">
            <tr className="text-left text-sm text-muted">
              <th className="py-3 px-4 font-medium">Team</th>
              <th className="py-3 px-4 font-medium">Engine</th>
              <th className="py-3 px-4 font-medium text-center">Est. Power</th>
              <th className="py-3 px-4 font-medium text-center">Data Points</th>
              <th className="py-3 px-4 font-medium text-center">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const analytics = gameState.engineAnalytics.find(
                (a) => a.teamId === team.id
              );
              const manufacturerName = getTeamManufacturerName(team.id, gameState);
              const isPlayerTeam = team.id === playerTeamId;

              return (
                <TeamAnalyticsRow
                  key={team.id}
                  team={team}
                  analytics={analytics}
                  manufacturerName={manufacturerName}
                  isPlayerTeam={isPlayerTeam}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="text-xs text-muted">
        <strong>Confidence Levels:</strong>{' '}
        <span className="text-neutral-500">No Data</span> (0 races) →{' '}
        <span className="text-red-400">Low</span> (1-2 races) →{' '}
        <span className="text-amber-400">Medium</span> (3-5 races) →{' '}
        <span className="text-emerald-400">High</span> (6+ races)
      </div>
    </div>
  );
}

// ===========================================
// NEGOTIATION TAB
// ===========================================

interface NegotiationTabProps {
  gameState: GameState;
  manufacturers: Manufacturer[];
  playerTeamId: string;
  currentSeason: number;
  onStartNegotiation: (manufacturerId: string) => void;
  onRespondToOffer: (negotiationId: string, response: 'accept' | 'reject') => void;
}

/** Get status label and color for negotiation phase */
function getNegotiationPhaseDisplay(phase: NegotiationPhase): { label: string; colorClass: string } {
  switch (phase) {
    case NegotiationPhase.AwaitingResponse:
      return { label: 'Awaiting Response', colorClass: 'text-amber-400' };
    case NegotiationPhase.ResponseReceived:
      return { label: 'Response Received', colorClass: 'text-emerald-400' };
    case NegotiationPhase.Completed:
      return { label: 'Completed', colorClass: 'text-emerald-400' };
    case NegotiationPhase.Failed:
      return { label: 'Failed', colorClass: 'text-red-400' };
    default:
      return { label: 'Unknown', colorClass: 'text-neutral-400' };
  }
}

interface ManufacturerRowProps {
  manufacturer: Manufacturer;
  hasActiveNegotiation: boolean;
  isCurrentSupplier: boolean;
  onStartNegotiation: () => void;
}

function ManufacturerRow({
  manufacturer,
  hasActiveNegotiation,
  isCurrentSupplier,
  onStartNegotiation,
}: ManufacturerRowProps) {
  return (
    <tr className="border-b border-neutral-700">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-primary">{manufacturer.name}</span>
          {isCurrentSupplier && (
            <span className="text-xs bg-accent-600/30 text-accent-400 px-2 py-0.5 rounded">
              Current
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-secondary">
        {manufacturer.reputation}
      </td>
      <td className="py-3 px-4 text-secondary">
        {formatCurrency(manufacturer.annualCost)}/year
      </td>
      <td className="py-3 px-4 text-center">
        <button
          type="button"
          className={`${GHOST_BORDERED_BUTTON_CLASSES} text-sm cursor-pointer`}
          onClick={onStartNegotiation}
          disabled={hasActiveNegotiation}
        >
          {hasActiveNegotiation ? 'Negotiating' : 'Start Negotiation'}
        </button>
      </td>
    </tr>
  );
}

interface ActiveNegotiationCardProps {
  negotiation: ManufacturerNegotiation;
  manufacturer: Manufacturer;
  onRespondToOffer: (negotiationId: string, response: 'accept' | 'reject') => void;
}

function ActiveNegotiationCard({
  negotiation,
  manufacturer,
  onRespondToOffer,
}: ActiveNegotiationCardProps) {
  const phaseDisplay = getNegotiationPhaseDisplay(negotiation.phase);
  const latestRound = negotiation.rounds[negotiation.rounds.length - 1];
  // Get terms from the latest round (either player's offer or counterparty's response)
  const latestTerms: ContractTerms | null = latestRound?.terms ?? null;
  // Check if the latest round was from counterparty (we can respond)
  const canRespond = latestRound?.offeredBy === 'counterparty' &&
    negotiation.phase !== NegotiationPhase.Completed &&
    negotiation.phase !== NegotiationPhase.Failed;

  return (
    <div className="card p-4" style={ACCENT_CARD_STYLE}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">{manufacturer.name}</h3>
          <p className="text-sm text-muted">
            Negotiating for {seasonToYear(negotiation.forSeason)} season
            {negotiation.rounds.length > 1 && ` (Round ${negotiation.currentRound})`}
          </p>
        </div>
        <span className={`text-sm font-medium ${phaseDisplay.colorClass}`}>
          {phaseDisplay.label}
        </span>
      </div>

      {negotiation.phase === NegotiationPhase.AwaitingResponse && (
        <div className="bg-neutral-800/50 rounded-lg p-4 text-center">
          <p className="text-muted text-sm">
            Waiting for {manufacturer.name} to respond to your offer...
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            The manufacturer will respond within a few days.
          </p>
          {latestTerms && (
            <div className="mt-3 text-left text-xs text-muted">
              <span className="font-medium">Your offer:</span> {formatCurrency(latestTerms.annualCost)}/year for {latestTerms.duration} year(s)
            </div>
          )}
        </div>
      )}

      {canRespond && latestTerms && (
        <div className="space-y-4">
          <div className="bg-neutral-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-primary mb-3">
              {latestRound.isUltimatum ? '⚠️ Final Offer' : 'Counter Offer'}
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted">Annual Cost:</span>
                <span className="text-primary ml-2 font-medium">
                  {formatCurrency(latestTerms.annualCost)}
                </span>
              </div>
              <div>
                <span className="text-muted">Duration:</span>
                <span className="text-primary ml-2 font-medium">
                  {latestTerms.duration} year{latestTerms.duration !== 1 ? 's' : ''}
                </span>
              </div>
              <div>
                <span className="text-muted">Upgrades Included:</span>
                <span className="text-primary ml-2 font-medium">
                  {latestTerms.upgradesIncluded}/year
                </span>
              </div>
              <div>
                <span className="text-muted">Customisation Points:</span>
                <span className="text-primary ml-2 font-medium">
                  {latestTerms.customisationPointsIncluded}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted">Optimisation:</span>
                <span className={`ml-2 font-medium ${latestTerms.optimisationIncluded ? 'text-emerald-400' : 'text-neutral-500'}`}>
                  {latestTerms.optimisationIncluded ? 'Included' : 'Not Included'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASSES} flex-1 cursor-pointer`}
              onClick={() => onRespondToOffer(negotiation.id, 'accept')}
            >
              Accept Offer
            </button>
            <button
              type="button"
              className={`${GHOST_BORDERED_BUTTON_CLASSES} flex-1 cursor-pointer`}
              onClick={() => onRespondToOffer(negotiation.id, 'reject')}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {negotiation.phase === NegotiationPhase.Completed && (
        <div className="bg-emerald-900/20 border border-emerald-600/30 rounded-lg p-4 text-center">
          <p className="text-emerald-400 font-medium">
            Contract signed! Your new engine supplier for {seasonToYear(negotiation.forSeason)}.
          </p>
        </div>
      )}

      {negotiation.phase === NegotiationPhase.Failed && (
        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 text-center">
          <p className="text-red-400 font-medium">
            Negotiation ended. You can start a new negotiation with another manufacturer.
          </p>
        </div>
      )}
    </div>
  );
}

function NegotiationTab({
  gameState,
  manufacturers,
  playerTeamId,
  currentSeason,
  onStartNegotiation,
  onRespondToOffer,
}: NegotiationTabProps) {
  const engineManufacturers = manufacturers.filter((m) => m.type === ManufacturerType.Engine);

  // Get player's active manufacturer negotiations
  const activeNegotiations = gameState.negotiations.filter(
    (n): n is ManufacturerNegotiation =>
      n.stakeholderType === StakeholderType.Manufacturer &&
      n.teamId === playerTeamId &&
      n.phase !== NegotiationPhase.Failed
  );

  // Check if contract is expiring
  const contractExpiring = isContractExpiring(
    playerTeamId,
    currentSeason,
    gameState.manufacturerContracts
  );

  // Get current manufacturer ID
  const currentContract = gameState.manufacturerContracts.find(
    (c) => c.teamId === playerTeamId && c.type === ManufacturerType.Engine
  );
  const currentManufacturerId = currentContract?.manufacturerId;

  return (
    <div className="space-y-6">
      {/* Contract Status Banner */}
      {contractExpiring ? (
        <div className="card p-4 bg-amber-900/20 border border-amber-600/30" style={ACCENT_CARD_STYLE}>
          <div className="flex items-start gap-3">
            <div className="text-amber-400 text-xl">⚠️</div>
            <div>
              <h3 className="text-sm font-semibold text-amber-400 mb-1">
                Contract Expiring
              </h3>
              <p className="text-xs text-muted">
                Your current engine contract expires at the end of this season.
                Negotiate a new deal before the season ends to secure your engine supply.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4" style={ACCENT_CARD_STYLE}>
          <div className="flex items-start gap-3">
            <div className="text-blue-400 text-xl">ℹ️</div>
            <div>
              <h3 className="text-sm font-semibold text-primary mb-1">
                Engine Contract Negotiation
              </h3>
              <p className="text-xs text-muted">
                Negotiate engine supply contracts for next season. Contact manufacturers to
                receive offers, then accept or negotiate terms.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Negotiations */}
      {activeNegotiations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">Active Negotiations</h3>
          {activeNegotiations.map((negotiation) => {
            const manufacturer = manufacturers.find(
              (m) => m.id === negotiation.manufacturerId
            );
            if (!manufacturer) return null;

            return (
              <ActiveNegotiationCard
                key={`${negotiation.teamId}-${negotiation.manufacturerId}`}
                negotiation={negotiation}
                manufacturer={manufacturer}
                onRespondToOffer={onRespondToOffer}
              />
            );
          })}
        </div>
      )}

      {/* Available Manufacturers */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">Engine Manufacturers</h3>
        <div className="card overflow-hidden" style={ACCENT_CARD_STYLE}>
          <table className="w-full">
            <thead className="bg-neutral-800/50">
              <tr className="text-left text-sm text-muted">
                <th className="py-3 px-4 font-medium">Manufacturer</th>
                <th className="py-3 px-4 font-medium">Reputation</th>
                <th className="py-3 px-4 font-medium">Base Price</th>
                <th className="py-3 px-4 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {engineManufacturers.map((manufacturer) => {
                const hasActiveNegotiation = activeNegotiations.some(
                  (n) => n.manufacturerId === manufacturer.id
                );
                const isCurrentSupplier = manufacturer.id === currentManufacturerId;

                return (
                  <ManufacturerRow
                    key={manufacturer.id}
                    manufacturer={manufacturer}
                    hasActiveNegotiation={hasActiveNegotiation}
                    isCurrentSupplier={isCurrentSupplier}
                    onStartNegotiation={() => onStartNegotiation(manufacturer.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Contracts() {
  const [activeTab, setActiveTab] = useState<ContractsTab>('current');
  const { gameState, playerTeam, isLoading, refreshGameState } = useDerivedGameState();

  // Get the player's engine contract and manufacturer
  const { contract, manufacturer, engineState, specState, car1Driver, car2Driver } = useMemo(() => {
    if (!gameState || !playerTeam) {
      return NULL_CONTRACT_DATA;
    }

    const playerTeamId = gameState.player.teamId;
    const engineContract = gameState.manufacturerContracts.find(
      (c) => c.teamId === playerTeamId && c.type === 'engine'
    );

    if (!engineContract) {
      return NULL_CONTRACT_DATA;
    }

    const engineManufacturer = gameState.manufacturers.find(
      (m) => m.id === engineContract.manufacturerId
    );

    const teamState = gameState.teamStates[playerTeamId];
    const teamEngineState = teamState?.engineState ?? null;

    // Get manufacturer spec state
    const manufacturerSpecState = gameState.manufacturerSpecs.find(
      (s) => s.manufacturerId === engineContract.manufacturerId
    ) ?? null;

    // Get drivers for the team
    const teamDrivers = gameState.drivers.filter((d) => d.teamId === playerTeamId);
    const driver1 = teamDrivers.find((d) => d.role === DriverRole.First) ?? teamDrivers[0] ?? null;
    const driver2 = teamDrivers.find((d) => d.role === DriverRole.Second) ?? teamDrivers[1] ?? null;

    return {
      contract: engineContract,
      manufacturer: engineManufacturer ?? null,
      engineState: teamEngineState,
      specState: manufacturerSpecState,
      car1Driver: driver1,
      car2Driver: driver2,
    };
  }, [gameState, playerTeam]);

  // Engine contract action handlers
  const handleUpgradeCar = useCallback(async (carNumber: 1 | 2) => {
    try {
      await window.electronAPI.invoke(IpcChannels.ENGINE_BUY_UPGRADE, { carNumber });
      refreshGameState();
    } catch (error) {
      console.error('Failed to upgrade engine:', error);
    }
  }, [refreshGameState]);

  const handleBuyCustomisationPoints = useCallback(async () => {
    try {
      await window.electronAPI.invoke(IpcChannels.ENGINE_BUY_CUSTOMISATION_POINTS, { quantity: 1 });
      refreshGameState();
    } catch (error) {
      console.error('Failed to buy customisation points:', error);
    }
  }, [refreshGameState]);

  const handleBuyOptimisation = useCallback(async () => {
    try {
      await window.electronAPI.invoke(IpcChannels.ENGINE_BUY_OPTIMISATION);
      refreshGameState();
    } catch (error) {
      console.error('Failed to buy optimisation:', error);
    }
  }, [refreshGameState]);

  const handleStartNegotiation = useCallback(async (manufacturerId: string) => {
    try {
      await window.electronAPI.invoke(IpcChannels.ENGINE_START_NEGOTIATION, { manufacturerId });
      refreshGameState();
    } catch (error) {
      console.error('Failed to start negotiation:', error);
    }
  }, [refreshGameState]);

  const handleRespondToOffer = useCallback(async (negotiationId: string, response: 'accept' | 'reject') => {
    try {
      await window.electronAPI.invoke(IpcChannels.ENGINE_RESPOND_TO_OFFER, { negotiationId, response });
      refreshGameState();
    } catch (error) {
      console.error('Failed to respond to offer:', error);
    }
  }, [refreshGameState]);

  if (isLoading) {
    return (
      <div className="p-4">
        <SectionHeading>Contracts</SectionHeading>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!gameState || !playerTeam || !contract || !manufacturer || !engineState || !specState) {
    return (
      <div className="p-4">
        <SectionHeading>Contracts</SectionHeading>
        <p className="text-muted">No engine contract found.</p>
      </div>
    );
  }

  const currentSeason = gameState.currentSeason.seasonNumber;

  return (
    <div className="p-4 space-y-4">
      <SectionHeading>Contracts</SectionHeading>

      <TabBar<ContractsTab>
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'current' && (
        <CurrentContractTab
          manufacturer={manufacturer}
          contract={contract}
          engineState={engineState}
          specState={specState}
          currentSeason={currentSeason}
          car1Driver={car1Driver}
          car2Driver={car2Driver}
          onUpgradeCar={handleUpgradeCar}
          onBuyCustomisationPoints={handleBuyCustomisationPoints}
          onBuyOptimisation={handleBuyOptimisation}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          gameState={gameState}
          teams={gameState.teams}
          playerTeamId={gameState.player.teamId}
        />
      )}

      {activeTab === 'negotiation' && (
        <NegotiationTab
          gameState={gameState}
          manufacturers={gameState.manufacturers}
          playerTeamId={gameState.player.teamId}
          currentSeason={currentSeason}
          onStartNegotiation={handleStartNegotiation}
          onRespondToOffer={handleRespondToOffer}
        />
      )}
    </div>
  );
}
