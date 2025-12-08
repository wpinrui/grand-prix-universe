import { useDerivedGameState } from '../hooks';
import { SectionHeading, SummaryStat, DetailRow, ProgressBar } from '../components';
import { ACCENT_CARD_STYLE } from '../utils/theme-styles';
import {
  ManufacturerType,
  ManufacturerDealType,
  type Car,
  type Manufacturer,
  type ActiveManufacturerContract,
} from '../../shared/domain';

// ===========================================
// CONSTANTS
// ===========================================

const DEAL_TYPE_LABELS: Record<ManufacturerDealType, string> = {
  [ManufacturerDealType.Customer]: 'Customer',
  [ManufacturerDealType.Partner]: 'Partner',
  [ManufacturerDealType.Works]: 'Works Team',
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/** Returns condition text label based on 0-100 value */
function getConditionLabel(condition: number): string {
  if (condition >= 90) return 'Excellent';
  if (condition >= 70) return 'Good';
  if (condition >= 50) return 'Fair';
  if (condition >= 30) return 'Poor';
  return 'Critical';
}

/** Format mileage with commas (e.g., 1,234 km) */
function formatMileage(mileage: number): string {
  return `${mileage.toLocaleString()} km`;
}

/** Get car display number from ID (e.g., "ferrari-car-1" -> "#1") */
function getCarNumber(carId: string): string {
  const match = carId.match(/-car-(\d+)$/);
  return match ? `#${match[1]}` : carId;
}

// ===========================================
// CAR CARD COMPONENT
// ===========================================

interface CarCardProps {
  car: Car;
  engineName: string;
}

function CarCard({ car, engineName }: CarCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
            Race Car
          </div>
          <div className="text-lg font-semibold text-primary">
            Car {getCarNumber(car.id)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Condition</div>
          <ProgressBar value={car.condition} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <DetailRow label="Status" value={getConditionLabel(car.condition)} />
        <DetailRow label="Mileage" value={<span className="font-mono">{formatMileage(car.mileage)}</span>} />
        <DetailRow label="Engine" value={engineName} />
      </div>
    </div>
  );
}

// ===========================================
// CARS LIST SECTION
// ===========================================

interface CarsListProps {
  cars: Car[];
  engineName: string;
}

function CarsList({ cars, engineName }: CarsListProps) {
  return (
    <section>
      <SectionHeading>Team Cars</SectionHeading>
      {cars.length === 0 ? (
        <p className="text-muted">No cars available</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} engineName={engineName} />
          ))}
        </div>
      )}
    </section>
  );
}

// ===========================================
// ENGINE INFO SECTION
// ===========================================

interface EngineInfoProps {
  manufacturer: Manufacturer;
  contract: ActiveManufacturerContract;
}

function EngineInfo({ manufacturer, contract }: EngineInfoProps) {
  return (
    <section>
      <SectionHeading>Engine Supplier</SectionHeading>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold text-primary">{manufacturer.name}</div>
          <div className="text-sm font-medium text-accent">
            {DEAL_TYPE_LABELS[contract.dealType]}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <DetailRow label="Quality Rating" value={`${manufacturer.quality}/100`} />
          <DetailRow label="Contract Until" value={`Season ${contract.endSeason}`} />
        </div>
      </div>
    </section>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Cars() {
  const { gameState, playerTeam } = useDerivedGameState();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading car data...</p>
      </div>
    );
  }

  // Get player's team cars
  const teamCars = gameState.cars.filter((c) => c.teamId === playerTeam.id);

  // Get engine contract and manufacturer
  const engineContract = gameState.manufacturerContracts.find(
    (c) => c.teamId === playerTeam.id && c.type === ManufacturerType.Engine
  );
  const engineManufacturer = engineContract
    ? gameState.manufacturers.find((m) => m.id === engineContract.manufacturerId)
    : undefined;

  // Calculate average condition
  const avgCondition = teamCars.length > 0
    ? Math.round(teamCars.reduce((sum, c) => sum + c.condition, 0) / teamCars.length)
    : 0;

  // Calculate total mileage
  const totalMileage = teamCars.reduce((sum, c) => sum + c.mileage, 0);

  const engineName = engineManufacturer?.name ?? 'Unknown';

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Summary Card */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="grid grid-cols-3 gap-8">
          <SummaryStat label="Race Cars" value={teamCars.length} />
          <SummaryStat label="Avg Condition" value={`${avgCondition}%`} />
          <SummaryStat label="Total Mileage" value={formatMileage(totalMileage)} />
        </div>
      </div>

      {/* Cars List */}
      <CarsList cars={teamCars} engineName={engineName} />

      {/* Engine Info */}
      {engineManufacturer && engineContract && (
        <EngineInfo manufacturer={engineManufacturer} contract={engineContract} />
      )}
    </div>
  );
}
