import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { formatCurrency } from '../utils/format';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../utils/theme-styles';
import type {
  ActiveSponsorDeal,
  ActiveManufacturerContract,
  Driver,
  Chief,
  Sponsor,
  Manufacturer,
  SponsorTier,
  ManufacturerType,
} from '../../shared/domain';

// ===========================================
// CONSTANTS
// ===========================================

const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  title: 'Title',
  major: 'Major',
  minor: 'Minor',
};

const MANUFACTURER_TYPE_LABELS: Record<ManufacturerType, string> = {
  engine: 'Engine',
  tyre: 'Tyre',
  fuel: 'Fuel',
};

// ===========================================
// SHARED COMPONENTS
// ===========================================

interface LineItemProps {
  label: string;
  sublabel?: string;
  amount: number;
  isExpense?: boolean;
}

function LineItem({ label, sublabel, amount, isExpense = false }: LineItemProps) {
  const displayAmount = isExpense && amount > 0 ? -amount : amount;
  const colorClass = displayAmount >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-primary">{label}</span>
        {sublabel && <span className="text-muted text-sm ml-2">({sublabel})</span>}
      </div>
      <span className={`font-mono tabular-nums ${colorClass}`}>
        {formatCurrency(displayAmount)}
      </span>
    </div>
  );
}

interface TotalRowProps {
  label: string;
  amount: number;
  accent?: boolean;
}

function TotalRow({ label, amount, accent = false }: TotalRowProps) {
  const colorClass = amount >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex items-center justify-between pt-3 border-t border-[var(--neutral-600)]">
      <span className="font-semibold text-secondary">{label}</span>
      <span
        className={`font-mono tabular-nums font-bold text-lg ${accent ? '' : colorClass}`}
        style={accent ? ACCENT_TEXT_STYLE : undefined}
      >
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-muted py-2">{message}</p>;
}

// ===========================================
// SECTION COMPONENTS
// ===========================================

interface IncomeSectionProps {
  deals: ActiveSponsorDeal[];
  sponsors: Sponsor[];
}

function IncomeSection({ deals, sponsors }: IncomeSectionProps) {
  const sponsorMap = new Map(sponsors.map((s) => [s.id, s]));
  const totalIncome = deals.reduce((sum, deal) => sum + deal.annualPayment, 0);

  return (
    <section>
      <SectionHeading>Annual Income</SectionHeading>
      <div className="card p-5">
        {deals.length === 0 ? (
          <EmptyState message="No sponsor deals" />
        ) : (
          <div className="space-y-1">
            {deals.map((deal) => {
              const sponsor = sponsorMap.get(deal.sponsorId);
              return (
                <LineItem
                  key={deal.sponsorId}
                  label={sponsor?.name ?? deal.sponsorId}
                  sublabel={SPONSOR_TIER_LABELS[deal.tier]}
                  amount={deal.annualPayment}
                />
              );
            })}
          </div>
        )}
        <TotalRow label="Total Income" amount={totalIncome} />
      </div>
    </section>
  );
}

interface ExpensesSectionProps {
  drivers: Driver[];
  chiefs: Chief[];
  contracts: ActiveManufacturerContract[];
  manufacturers: Manufacturer[];
}

function ExpensesSection({ drivers, chiefs, contracts, manufacturers }: ExpensesSectionProps) {
  const manufacturerMap = new Map(manufacturers.map((m) => [m.id, m]));

  const driverCosts = drivers.reduce((sum, d) => sum + d.salary, 0);
  const chiefCosts = chiefs.reduce((sum, c) => sum + c.salary, 0);
  const contractCosts = contracts
    .filter((c) => c.annualCost > 0)
    .reduce((sum, c) => sum + c.annualCost, 0);

  const totalExpenses = driverCosts + chiefCosts + contractCosts;

  return (
    <section>
      <SectionHeading>Annual Expenses</SectionHeading>
      <div className="card p-5">
        {/* Drivers */}
        {drivers.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              Drivers
            </div>
            {drivers.map((driver) => (
              <LineItem
                key={driver.id}
                label={`${driver.firstName} ${driver.lastName}`}
                amount={driver.salary}
                isExpense
              />
            ))}
          </div>
        )}

        {/* Chiefs */}
        {chiefs.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              Department Chiefs
            </div>
            {chiefs.map((chief) => (
              <LineItem
                key={chief.id}
                label={`${chief.firstName} ${chief.lastName}`}
                sublabel={chief.role}
                amount={chief.salary}
                isExpense
              />
            ))}
          </div>
        )}

        {/* Manufacturer Contracts */}
        {contracts.filter((c) => c.annualCost > 0).length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              Supplier Contracts
            </div>
            {contracts
              .filter((c) => c.annualCost > 0)
              .map((contract) => {
                const manufacturer = manufacturerMap.get(contract.manufacturerId);
                return (
                  <LineItem
                    key={contract.manufacturerId}
                    label={manufacturer?.name ?? contract.manufacturerId}
                    sublabel={MANUFACTURER_TYPE_LABELS[contract.type]}
                    amount={contract.annualCost}
                    isExpense
                  />
                );
              })}
          </div>
        )}

        {totalExpenses === 0 && <EmptyState message="No recorded expenses" />}

        <TotalRow label="Total Expenses" amount={-totalExpenses} />
      </div>
    </section>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function Finance() {
  const { gameState, playerTeam } = useDerivedGameState();

  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading finance data...</p>
      </div>
    );
  }

  const teamDrivers = gameState.drivers.filter((d) => d.teamId === playerTeam.id);
  const teamChiefs = gameState.chiefs.filter((c) => c.teamId === playerTeam.id);
  const teamSponsorDeals = gameState.sponsorDeals.filter((d) => d.teamId === playerTeam.id);
  const teamContracts = gameState.manufacturerContracts.filter((c) => c.teamId === playerTeam.id);

  // Calculate totals
  const totalIncome = teamSponsorDeals.reduce((sum, d) => sum + d.annualPayment, 0);
  const driverCosts = teamDrivers.reduce((sum, d) => sum + d.salary, 0);
  const chiefCosts = teamChiefs.reduce((sum, c) => sum + c.salary, 0);
  const contractCosts = teamContracts
    .filter((c) => c.annualCost > 0)
    .reduce((sum, c) => sum + c.annualCost, 0);
  const totalExpenses = driverCosts + chiefCosts + contractCosts;
  const netAnnual = totalIncome - totalExpenses;
  const projectedBalance = playerTeam.budget + netAnnual;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Current Budget */}
      <div className="card p-6" style={ACCENT_CARD_STYLE}>
        <div className="text-sm font-medium text-muted uppercase tracking-wider mb-1">
          Current Budget
        </div>
        <div className="text-3xl font-bold" style={ACCENT_TEXT_STYLE}>
          {formatCurrency(playerTeam.budget)}
        </div>
      </div>

      {/* Income Section */}
      <IncomeSection deals={teamSponsorDeals} sponsors={gameState.sponsors} />

      {/* Expenses Section */}
      <ExpensesSection
        drivers={teamDrivers}
        chiefs={teamChiefs}
        contracts={teamContracts}
        manufacturers={gameState.manufacturers}
      />

      {/* Summary */}
      <section>
        <SectionHeading>Season Projection</SectionHeading>
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-secondary">Net Annual Cash Flow</span>
            <span
              className={`font-mono tabular-nums font-semibold ${netAnnual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {formatCurrency(netAnnual)}
            </span>
          </div>
          <TotalRow label="Projected Year-End Balance" amount={projectedBalance} accent />
        </div>
      </section>
    </div>
  );
}
