/*
============================================================
COLLECTION VALUE BREAKDOWN
------------------------------------------------------------
Displays the performance of each collection.

Example UI:
Yu-Gi-Oh          $350   +$120
Warhammer         $40    -$15
Pokemon           $5     +$1
============================================================
*/

type CollectionTotal = {
  id: string;
  name: string;
  value?: number;
  cost?: number;
  profit?: number;
};

type Props = {
  collections: CollectionTotal[];
};

/*
============================================================
FORMAT MONEY
------------------------------------------------------------
Safely formats numbers as currency.
Prevents crashes if a value is undefined or null.
============================================================
*/
function formatMoney(value?: number) {
  const safeValue = typeof value === "number" ? value : 0;
  return `$${safeValue.toFixed(2)}`;
}

export default function CollectionValueBreakdown({ collections }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <div className="text-sm font-semibold text-white/80">
        Collection Performance
      </div>

      <div className="mt-4 space-y-3">
        {collections.map((c) => {
          /*
          Determine color for collection profit/loss
          */
          const profitClass =
            (c.profit ?? 0) > 0
              ? "text-green-400"
              : (c.profit ?? 0) < 0
                ? "text-red-400"
                : "text-white/50";

          return (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
            >
              {/* Collection name */}
              <div className="text-sm text-white/80">{c.name}</div>

              {/* Value + Profit */}
              <div className="flex items-center gap-6">
                <div className="text-sm font-semibold text-emerald-400">
                  {formatMoney(c.value)}
                </div>

                <div className={`text-sm font-medium ${profitClass}`}>
                  {(c.profit ?? 0) >= 0 ? "+" : ""}
                  {formatMoney(c.profit)}
                </div>
              </div>
            </div>
          );
        })}

        {collections.length === 0 && (
          <div className="text-sm text-white/40">
            No collections yet
          </div>
        )}
      </div>
    </div>
  );
}