import PortfolioChart from "@/app/components/Portfoliochart";

type AllocationItem = {
  label: string;
  value: number;
};

type PriceMover = {
  id: string;
  name: string;
  change: number;
  pct: number | null;
};

type TopValuableItem = {
  id: string;
  name: string;
  quantity: number;
  displayPrice: number | null;
  totalValue: number;
};

type ProfitItem = {
  id: string;
  name: string;
  profit: number;
};

type Props = {
  chartLabels: string[];
  chartValues: number[];
  allocationDisplay: AllocationItem[];
  allocationTotal: number;
  topGainers: PriceMover[];
  topLosers: PriceMover[];
  topValuableItems: TopValuableItem[];
  topProfitItems: ProfitItem[];
  worstProfitItems: ProfitItem[];
};

export default function PortfolioAnalytics({
  chartLabels,
  chartValues,
  allocationDisplay,
  allocationTotal,
  topGainers,
  topLosers,
  topValuableItems,
  topProfitItems,
  worstProfitItems,
}: Props) {
  return (
    <>
      {/* =========================================
          PORTFOLIO CHART
         ========================================= */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="text-base font-semibold">Portfolio Value</div>
        <div className="mt-1 text-sm text-white/60">
          Track how your collection value grows over time
        </div>

        <div className="mt-6">
          <PortfolioChart labels={chartLabels} values={chartValues} />
        </div>
      </div>

      {/* =========================================
          COLLECTION ALLOCATION (BY GAME)
         ========================================= */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="text-base font-semibold">Collection Allocation</div>
        <div className="mt-1 text-sm text-white/60">
          Breakdown of your collection value by game
        </div>

        {allocationDisplay.length === 0 || allocationTotal === 0 ? (
          <div className="mt-4 text-sm text-white/50">
            Add items with prices to see allocation.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {allocationDisplay.map((g) => {
              const pct =
                allocationTotal > 0 ? (g.value / allocationTotal) * 100 : 0;

              return (
                <div
                  key={g.label}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {g.label}
                      </div>
                      <div className="text-xs text-white/55">
                        ${g.value.toFixed(2)} • {pct.toFixed(1)}%
                      </div>
                    </div>

                    <div className="text-sm font-semibold">
                      ${g.value.toFixed(2)}
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-blue-400/70"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================
          PRICE MOVERS
         ========================================= */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Gainers */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-base font-semibold">Top Gainers</div>

          <div className="mt-4 space-y-2">
            {topGainers.length === 0 ? (
              <div className="text-sm text-white/50">
                No gainers yet — no positive price changes saved yet.
              </div>
            ) : (
              topGainers.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2"
                >
                  <div>
                    #{i + 1} {c.name}
                  </div>

                  <div className="font-medium text-green-400">
                    +${Math.abs(c.change).toFixed(2)}
                    {c.pct == null ? "" : ` (+${Math.abs(c.pct).toFixed(1)}%)`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Losers */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-base font-semibold">Top Losers</div>

          <div className="mt-4 space-y-2">
            {topLosers.length === 0 ? (
              <div className="text-sm text-white/50">
                No losers yet — everything is holding or rising.
              </div>
            ) : (
              topLosers.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2"
                >
                  <div>
                    #{i + 1} {c.name}
                  </div>

                  <div className="font-medium text-red-400">
                    -${Math.abs(c.change).toFixed(2)}
                    {c.pct == null ? "" : ` (-${Math.abs(c.pct).toFixed(1)}%)`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* =========================================
          PROFIT LEADERBOARD
         ========================================= */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Top Profit */}
        <div className="rounded-2xl border border-green-400/20 bg-green-400/5 p-4">
          <div className="mb-2 text-sm font-semibold">Top Profit</div>

          {topProfitItems.length === 0 ? (
            <div className="text-sm text-white/50">
              Add purchase prices to track profit
            </div>
          ) : (
            topProfitItems.map((item, i) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  #{i + 1} {item.name}
                </span>
                <span className="font-medium text-green-400">
                  +${item.profit.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Worst Investment */}
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4">
          <div className="mb-2 text-sm font-semibold">Worst Investment</div>

          {worstProfitItems.length === 0 ? (
            <div className="text-sm text-white/50">No losses yet 👍</div>
          ) : (
            worstProfitItems.map((item, i) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  #{i + 1} {item.name}
                </span>
                <span className="font-medium text-red-400">
                  ${item.profit.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* =========================================
          TOP 5 MOST VALUABLE ITEMS
         ========================================= */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="text-base font-semibold">Top 5 Most Valuable Items</div>
        <div className="mt-1 text-sm text-white/55">
          Highest-value items in this collection
        </div>

        <div className="mt-4 space-y-3">
          {topValuableItems.length === 0 ? (
            <div className="text-sm text-white/60">No items to rank yet.</div>
          ) : (
            topValuableItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/[0.05]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    #{index + 1} {item.name}
                  </div>
                  <div className="text-xs text-white/55">
                    Qty: {item.quantity} •{" "}
                    {item.displayPrice != null
                      ? `$${item.displayPrice.toFixed(2)} each`
                      : "No price yet"}
                  </div>
                </div>

                <div className="text-sm font-semibold">
                  ${item.totalValue.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}