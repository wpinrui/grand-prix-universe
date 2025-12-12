import { useDerivedGameState } from '../hooks';
import { SectionHeading } from '../components';
import { formatCurrency, getFullName, SPONSOR_TIER_LABELS } from '../utils/format';
import { ACCENT_CARD_STYLE, ACCENT_TEXT_STYLE } from '../utils/theme-styles';
import type {
  ActiveSponsorDeal,
  ActiveManufacturerContract,
  Driver,
  Chief,
  Sponsor,
  Manufacturer,
  ManufacturerType,
} from '../../shared/domain';

// ===========================================
// CONSTANTS
// ===========================================

const MANUFACTURER_TYPE_LABELS: Record<ManufacturerType, string> = {
  engine: 'Engine',
  tyre: 'Tyre',
  fuel: 'Fuel',
};

/** Returns green for positive/zero amounts, red for negative */
function getAmountColorClass(amount: number): string {
  return amount >= 0 ? 'text-emerald-400' : 'text-red-400';
}

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

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-primary">{label}</span>
        {sublabel && <span className="text-muted text-sm ml-2">({sublabel})</span>}
      </div>
      <span className={`font-mono tabular-nums ${getAmountColorClass(displayAmount)}`}>
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
  return (
    <div className="flex items-center justify-between pt-3 border-t border-[var(--neutral-600)]">
      <span className="font-semibold text-secondary">{label}</span>
      <span
        className={`font-mono tabular-nums font-bold text-lg ${accent ? '' : getAmountColorClass(amount)}`}
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

interface ExpenseGroupProps {
  label: string;
  children: React.ReactNode;
}

function ExpenseGroup({ label, children }: ExpenseGroupProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

// ===========================================
// SECTION COMPONENTS
// ===========================================

interface IncomeSectionProps {
  deals: ActiveSponsorDeal[];
  sponsors: Sponsor[];
  totalIncome: number;
}

function IncomeSection({ deals, sponsors, totalIncome }: IncomeSectionProps) {
  const sponsorMap = new Map(sponsors.map((s) => [s.id, s]));

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
                  amount={deal.monthlyPayment * 12}
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
  /** Contracts with annualCost > 0 (pre-filtered) */
  paidContracts: ActiveManufacturerContract[];
  manufacturers: Manufacturer[];
  totalExpenses: number;
}

function ExpensesSection({
  drivers,
  chiefs,
  paidContracts,
  manufacturers,
  totalExpenses,
}: ExpensesSectionProps) {
  const manufacturerMap = new Map(manufacturers.map((m) => [m.id, m]));

  return (
    <section>
      <SectionHeading>Annual Expenses</SectionHeading>
      <div className="card p-5">
        {drivers.length > 0 && (
          <ExpenseGroup label="Drivers">
            {drivers.map((driver) => (
              <LineItem
                key={driver.id}
                label={getFullName(driver)}
                amount={driver.salary}
                isExpense
              />
            ))}
          </ExpenseGroup>
        )}

        {chiefs.length > 0 && (
          <ExpenseGroup label="Department Chiefs">
            {chiefs.map((chief) => (
              <LineItem
                key={chief.id}
                label={getFullName(chief)}
                sublabel={chief.role}
                amount={chief.salary}
                isExpense
              />
            ))}
          </ExpenseGroup>
        )}

        {paidContracts.length > 0 && (
          <ExpenseGroup label="Supplier Contracts">
            {paidContracts.map((contract) => {
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
          </ExpenseGroup>
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

  // Filter data for player's team
  const teamDrivers = gameState.drivers.filter((d) => d.teamId === playerTeam.id);
  const teamChiefs = gameState.chiefs.filter((c) => c.teamId === playerTeam.id);
  const teamSponsorDeals = gameState.sponsorDeals.filter((d) => d.teamId === playerTeam.id);
  const teamPaidContracts = gameState.manufacturerContracts.filter(
    (c) => c.teamId === playerTeam.id && c.annualCost > 0
  );

  // Calculate totals (single source of truth)
  const totalIncome = teamSponsorDeals.reduce((sum, d) => sum + d.monthlyPayment * 12, 0);
  const totalExpenses =
    teamDrivers.reduce((sum, d) => sum + d.salary, 0) +
    teamChiefs.reduce((sum, c) => sum + c.salary, 0) +
    teamPaidContracts.reduce((sum, c) => sum + c.annualCost, 0);
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
      <IncomeSection
        deals={teamSponsorDeals}
        sponsors={gameState.sponsors}
        totalIncome={totalIncome}
      />

      {/* Expenses Section */}
      <ExpensesSection
        drivers={teamDrivers}
        chiefs={teamChiefs}
        paidContracts={teamPaidContracts}
        manufacturers={gameState.manufacturers}
        totalExpenses={totalExpenses}
      />

      {/* Summary */}
      <section>
        <SectionHeading>Season Projection</SectionHeading>
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-secondary">Net Annual Cash Flow</span>
            <span
              className={`font-mono tabular-nums font-semibold ${getAmountColorClass(netAnnual)}`}
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
