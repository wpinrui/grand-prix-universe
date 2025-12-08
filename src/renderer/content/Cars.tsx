import { useDerivedGameState } from '../hooks';
import { SummaryStat, DetailRow, ProgressBar, CarViewer3D } from '../components';
import {
  ManufacturerType,
  ManufacturerDealType,
  type Car,
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
// OVERLAY PANEL COMPONENTS
// ===========================================

interface CarStatCardProps {
  car: Car;
  engineName: string;
}

function CarStatCard({ car, engineName }: CarStatCardProps) {
  return (
    <div className="card p-3 backdrop-blur-sm bg-surface/80">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-primary">Car {getCarNumber(car.id)}</span>
        <ProgressBar value={car.condition} />
      </div>
      <div className="space-y-1 text-xs">
        <DetailRow label="Status" value={getConditionLabel(car.condition)} />
        <DetailRow label="Mileage" value={<span className="font-mono">{formatMileage(car.mileage)}</span>} />
        <DetailRow label="Engine" value={engineName} />
      </div>
    </div>
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
  const dealType = engineContract ? DEAL_TYPE_LABELS[engineContract.dealType] : 'None';

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* 3D Car Viewer - fills entire content area */}
      <CarViewer3D
        primaryColor={playerTeam.primaryColor}
        className="absolute inset-0"
      />

      {/* Top-left: Summary stats overlay */}
      <div className="absolute top-4 left-4 card p-4 backdrop-blur-sm bg-surface/80 min-w-[200px]">
        <div className="space-y-3">
          <SummaryStat label="Race Cars" value={teamCars.length} />
          <SummaryStat label="Avg Condition" value={`${avgCondition}%`} />
          <SummaryStat label="Total Mileage" value={formatMileage(totalMileage)} />
        </div>
      </div>

      {/* Bottom-left: Engine supplier overlay */}
      <div className="absolute bottom-4 left-4 card p-3 backdrop-blur-sm bg-surface/80 min-w-[200px]">
        <div className="text-xs text-muted uppercase tracking-wider mb-1">Engine</div>
        <div className="text-sm font-semibold text-primary">{engineName}</div>
        <div className="text-xs text-accent">{dealType}</div>
      </div>

      {/* Right side: Car cards stacked */}
      <div className="absolute top-4 right-4 space-y-3 max-w-[220px]">
        {teamCars.map((car) => (
          <CarStatCard key={car.id} car={car} engineName={engineName} />
        ))}
      </div>

      {/* Drag hint */}
      <div className="absolute bottom-4 right-4 text-xs text-muted/60">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
