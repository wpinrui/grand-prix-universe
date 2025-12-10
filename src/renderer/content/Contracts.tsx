import { useState, useMemo } from 'react';
import { useDerivedGameState } from '../hooks';
import { SectionHeading, TabBar } from '../components';
import type { Tab } from '../components';
import { ACCENT_CARD_STYLE, GHOST_BORDERED_BUTTON_CLASSES } from '../utils/theme-styles';
import { formatMoney } from '../utils/format';
import { seasonToYear } from '../../shared/utils/date-utils';
import type {
  Manufacturer,
  ActiveManufacturerContract,
  TeamEngineState,
  CarEngineState,
  EngineStats,
  Driver,
} from '../../shared/domain';
import { ENGINE_STAT_KEYS, getEffectiveEngineStats } from '../../shared/domain/engine-utils';

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
  currentSeason: number;
  car1Driver: Driver | null;
  car2Driver: Driver | null;
}

function CurrentContractTab({
  manufacturer,
  contract,
  engineState,
  currentSeason,
  car1Driver,
  car2Driver,
}: CurrentContractTabProps) {
  // For now, we don't have spec bonuses implemented - use empty array
  // This will be populated when manufacturer spec releases are implemented
  const specBonuses: EngineStats[] = [];
  const latestSpec = 1; // Will come from game state when spec releases are implemented

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
          onUpgrade={() => {/* Will be implemented in PR 3 */}}
          onCustomise={() => {/* Will be implemented in PR 3 */}}
        />
        <CarEngineCard
          carNumber={2}
          driver={car2Driver}
          carEngine={engineState.car2Engine}
          baseStats={manufacturer.engineStats}
          specBonuses={specBonuses}
          latestSpec={latestSpec}
          onUpgrade={() => {/* Will be implemented in PR 3 */}}
          onCustomise={() => {/* Will be implemented in PR 3 */}}
        />
      </div>

      {/* Actions Section */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <h3 className="text-lg font-semibold text-primary mb-4">Available Actions</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-neutral-800/50 rounded-lg">
            <div className="text-sm font-medium text-primary mb-1">Buy Customisation Points</div>
            <div className="text-xs text-muted mb-2">
              Purchase flexibility points to reallocate engine stats (±10 max per stat)
            </div>
            <div className="text-sm text-secondary mb-2">
              {formatMoney(manufacturer.costs.customisationPoint)} per point
            </div>
            <button
              type="button"
              className={`${GHOST_BORDERED_BUTTON_CLASSES} w-full text-sm cursor-pointer`}
              disabled // Will be enabled in PR 3
            >
              Purchase
            </button>
          </div>

          <div className="p-4 bg-neutral-800/50 rounded-lg">
            <div className="text-sm font-medium text-primary mb-1">Pre-Season Optimisation</div>
            <div className="text-xs text-muted mb-2">
              Tailor the engine to your car for a flat bonus to all stats next season
            </div>
            <div className="text-sm text-secondary mb-2">
              {formatMoney(manufacturer.costs.optimisation)}
            </div>
            <button
              type="button"
              className={`${GHOST_BORDERED_BUTTON_CLASSES} w-full text-sm cursor-pointer`}
              disabled // Will be enabled in PR 3
            >
              {engineState.optimisationPurchasedForNextSeason ? 'Purchased' : 'Purchase'}
            </button>
          </div>

          <div className="p-4 bg-neutral-800/50 rounded-lg">
            <div className="text-sm font-medium text-primary mb-1">Ad-Hoc Engine Upgrade</div>
            <div className="text-xs text-muted mb-2">
              Purchase a fresh engine with the latest spec for one car
            </div>
            <div className="text-sm text-secondary mb-2">
              {formatMoney(manufacturer.costs.upgrade)} per engine
            </div>
            <button
              type="button"
              className={`${GHOST_BORDERED_BUTTON_CLASSES} w-full text-sm cursor-pointer`}
              disabled // Will be enabled in PR 3
            >
              Purchase
            </button>
          </div>
        </div>
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
  const { gameState, playerTeam, isLoading } = useDerivedGameState();

  // Get the player's engine contract and manufacturer
  const { contract, manufacturer, engineState, car1Driver, car2Driver } = useMemo(() => {
    if (!gameState || !playerTeam) {
      return { contract: null, manufacturer: null, engineState: null, car1Driver: null, car2Driver: null };
    }

    const playerTeamId = gameState.player.teamId;
    const engineContract = gameState.manufacturerContracts.find(
      (c) => c.teamId === playerTeamId && c.type === 'engine'
    );

    if (!engineContract) {
      return { contract: null, manufacturer: null, engineState: null, car1Driver: null, car2Driver: null };
    }

    const engineManufacturer = gameState.manufacturers.find(
      (m) => m.id === engineContract.manufacturerId
    );

    const teamState = gameState.teamStates[playerTeamId];
    const teamEngineState = teamState?.engineState ?? null;

    // Get drivers for the team
    const teamDrivers = gameState.drivers.filter((d) => d.teamId === playerTeamId);
    const driver1 = teamDrivers.find((d) => d.role === 'driver1') ?? teamDrivers[0] ?? null;
    const driver2 = teamDrivers.find((d) => d.role === 'driver2') ?? teamDrivers[1] ?? null;

    return {
      contract: engineContract,
      manufacturer: engineManufacturer ?? null,
      engineState: teamEngineState,
      car1Driver: driver1,
      car2Driver: driver2,
    };
  }, [gameState, playerTeam]);

  if (isLoading) {
    return (
      <div className="p-4">
        <SectionHeading>Contracts</SectionHeading>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!gameState || !playerTeam || !contract || !manufacturer || !engineState) {
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
          currentSeason={currentSeason}
          car1Driver={car1Driver}
          car2Driver={car2Driver}
        />
      )}

      {activeTab === 'analytics' && <ComingSoonTab tabName="Analytics" />}

      {activeTab === 'negotiation' && <ComingSoonTab tabName="Negotiation" />}
    </div>
  );
}
