import { useState, useMemo, useCallback } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, TabBar } from '../components';
import type { Tab } from '../components';
import { ACCENT_CARD_STYLE, GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatMoney } from '../utils/format';
import { seasonToYear } from '../../shared/utils/date-utils';
import { IpcChannels } from '../../shared/ipc';
import type {
  Manufacturer,
  ActiveManufacturerContract,
  TeamEngineState,
  CarEngineState,
  EngineStats,
  Driver,
  ManufacturerSpecState,
  Team,
  TeamEngineAnalytics,
  GameState,
} from '../../shared/domain';
import {
  ENGINE_STAT_KEYS,
  getEffectiveEngineStats,
  getSpecBonusesAsEngineStats,
  calculateAverageEstimatedPower,
  calculateAnalyticsConfidence,
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

const NULL_CONTRACT_DATA = {
  contract: null,
  manufacturer: null,
  engineState: null,
  specState: null,
  car1Driver: null,
  car2Driver: null,
} as const;

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
              {formatMoney(contract.annualCost)}
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
            cost={`${formatMoney(manufacturer.costs.customisationPoint)} per point`}
            buttonLabel="Buy 1 Point"
            onClick={onBuyCustomisationPoints}
          />
          <ActionCard
            title="Pre-Season Optimisation"
            description="Tailor the engine to your car for a flat bonus to all stats next season"
            cost={formatMoney(manufacturer.costs.optimisation)}
            buttonLabel={engineState.optimisationPurchasedForNextSeason ? 'Purchased' : 'Purchase'}
            disabled={engineState.optimisationPurchasedForNextSeason}
            onClick={onBuyOptimisation}
          />
          <ActionCard
            title="Ad-Hoc Engine Upgrade"
            description="Purchase a fresh engine with the latest spec for one car"
            cost={`${formatMoney(manufacturer.costs.upgrade)} per engine`}
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
    (c) => c.teamId === teamId && c.type === 'engine'
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
  } else if (confidence < 50) {
    label = 'Low';
    colorClass = 'text-red-400';
  } else if (confidence < 80) {
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

function ComingSoonTab({ tabName }: { tabName: string }) {
  return (
    <div className="card p-8 text-center" style={ACCENT_CARD_STYLE}>
      <h3 className="text-xl font-semibold text-primary mb-2">{tabName}</h3>
      <p className="text-muted">This feature is coming in a future update.</p>
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
    const driver1 = teamDrivers.find((d) => d.role === 'driver1') ?? teamDrivers[0] ?? null;
    const driver2 = teamDrivers.find((d) => d.role === 'driver2') ?? teamDrivers[1] ?? null;

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

      {activeTab === 'negotiation' && <ComingSoonTab tabName="Negotiation" />}
    </div>
  );
}
