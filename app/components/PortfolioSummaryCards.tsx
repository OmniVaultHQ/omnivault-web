type MostValuableItem = {
  name: string;
  totalValue: number;
} | null;

type Props = {
  totalUnique: number;
  totalOwned: number;
  collectionValue: number;
  costBasis: number;
  totalProfitLoss: number;
  mostValuableItem: MostValuableItem;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function PortfolioSummaryCards({
  totalUnique,
  totalOwned,
  collectionValue,
  costBasis,
  totalProfitLoss,
  mostValuableItem,
}: Props) {
  const profitLossClass =
    totalProfitLoss > 0
      ? "text-green-400"
      : totalProfitLoss < 0
        ? "text-red-400"
        : "text-white";

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {/* Unique Items */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">
          Unique Items
        </div>
        <div className="mt-2 text-2xl font-semibold">{totalUnique}</div>
      </div>

      {/* Total Quantity */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">
          Total Quantity
        </div>
        <div className="mt-2 text-2xl font-semibold">{totalOwned}</div>
      </div>

      {/* Portfolio Value */}
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">
          Portfolio Value
        </div>
        <div className="mt-2 text-2xl font-semibold">
          {formatMoney(collectionValue)}
        </div>
      </div>

      {/* Total Cost */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">
          Total Cost
        </div>
        <div className="mt-2 text-2xl font-semibold">
          {formatMoney(costBasis)}
        </div>
      </div>

      {/* Total Profit / Loss */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">
          Total Profit / Loss
        </div>
        <div className={`mt-2 text-2xl font-semibold ${profitLossClass}`}>
          {totalProfitLoss >= 0 ? "+" : ""}
          {formatMoney(totalProfitLoss)}
        </div>
      </div>

      {/* Most Valuable Item */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">
          Most Valuable Item
        </div>

        {mostValuableItem ? (
          <>
            <div className="mt-2 truncate text-sm font-medium text-white/85">
              {mostValuableItem.name}
            </div>
            <div className="mt-1 text-lg font-semibold">
              {formatMoney(mostValuableItem.totalValue)}
            </div>
          </>
        ) : (
          <div className="mt-2 text-sm text-white/45">No items yet</div>
        )}
      </div>
    </div>
  );
}