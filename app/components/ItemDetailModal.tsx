"use client";

import SubmitButton from "@/app/components/Submitbutton";

/*
============================================================
ITEM DETAIL MODAL ITEM TYPE
------------------------------------------------------------
This is the shape of the item data passed into the modal
from CollectionItemsSection.
============================================================
*/
type ItemDetailModalItem = {
  id: string;
  name: string;
  game: string;
  set: string;
  category?: string | null;
  imageUrl?: string | null;
  isCustom?: boolean;
  condition: string | null;
  notes?: string | null;
  quantity: number;
  purchasePrice: number | null;
  manualMarketPrice: number | null;
  catalogMarketPrice: number | null;
  effectiveMarketPrice: number;
  totalValue: number;
  totalCost: number;
  profitLoss: number | null;
  updatedAtLabel: string | null;
  history: {
    id: string;
    marketPrice: number;
    createdAt: Date | string;
    source: string;
  }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  item: ItemDetailModalItem | null;
  updateItemDetails: (formData: FormData) => Promise<void>;
  deleteItem: (formData: FormData) => Promise<void>;
};

export default function ItemDetailModal({
  open,
  onClose,
  item,
  updateItemDetails,
  deleteItem,
}: Props) {
  // Do not render anything if the modal is closed or no item is selected
  if (!open || !item) return null;

  /*
  ============================================================
  PROFIT / LOSS COLOR
  ------------------------------------------------------------
  Used to color the top summary card based on item performance.
  ============================================================
  */
  const profitLossClass =
    item.profitLoss == null
      ? "text-white/40"
      : item.profitLoss > 0
        ? "text-green-400"
        : item.profitLoss < 0
          ? "text-red-400"
          : "text-white/70";

  /*
  ============================================================
  PRICE CHANGE CALCULATION
  ------------------------------------------------------------
  Uses the item's history already passed into the modal.
  Compares newest price vs previous price.

  This is NOT a true "24h" check yet.
  It is "latest saved price vs previous saved price."
  ============================================================
  */
  const priceChange =
    item.history.length >= 2
      ? (() => {
          const latest = item.history[0]?.marketPrice ?? 0;
          const previous = item.history[1]?.marketPrice ?? 0;

          const change = latest - previous;
          const percent = previous === 0 ? 0 : (change / previous) * 100;

          return {
            change,
            percent,
          };
        })()
      : null;

  /*
  ============================================================
  PRICE CHANGE COLOR
  ------------------------------------------------------------
  Used for the recent change display.
  ============================================================
  */
  const priceChangeClass =
    !priceChange
      ? "text-white/50"
      : priceChange.change > 0
        ? "text-green-400"
        : priceChange.change < 0
          ? "text-red-400"
          : "text-white/50";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/10 bg-[#081225] shadow-2xl">
        {/* =====================================================
            CLOSE BUTTON
           ===================================================== */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          Close
        </button>

        <div className="grid gap-6 p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* =====================================================
              LEFT COLUMN
             ===================================================== */}
          <div className="space-y-4">
            {/* Item title row */}
            <div className="text-sm text-white/70">
              <span className="font-semibold text-white">{item.name}</span>
              <span className="mx-2 text-white/35">•</span>
              {item.set}
              <span className="mx-2 text-white/35">•</span>
              {item.game}

              {item.isCustom ? (
                <span className="ml-2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                  Custom
                </span>
              ) : null}
            </div>

            {/* Item image */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <div className="aspect-[3/4] w-full">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
                    No Image
                  </div>
                )}
              </div>
            </div>

            {/* Quantity + total value cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-wide text-white/45">
                  Quantity
                </div>
                <div className="mt-2 text-3xl font-semibold">
                  {item.quantity}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-wide text-white/45">
                  Total Value
                </div>
                <div className="mt-2 text-3xl font-semibold">
                  ${item.totalValue.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Item summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 text-lg font-semibold">Item Summary</div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/55">Game / Brand</span>
                  <span>{item.game || "—"}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/55">Set / Line</span>
                  <span>{item.set || "—"}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/55">Category</span>
                  <span>{item.category || "—"}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/55">Condition</span>
                  <span>{item.condition || "—"}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/55">Type</span>
                  <span>{item.isCustom ? "Custom Item" : "Catalog Item"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              RIGHT COLUMN
             ===================================================== */}
          <div className="space-y-6">
            {/* Top stat cards */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-wide text-white/45">
                  Purchase Price
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  ${Number(item.purchasePrice ?? 0).toFixed(2)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-wide text-white/45">
                  Market Price
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  ${Number(item.effectiveMarketPrice ?? 0).toFixed(2)}
                </div>

                {/* Recent price movement */}
                {priceChange && (
                  <div className={`mt-2 text-sm font-medium ${priceChangeClass}`}>
                    <div className="text-xs text-white/50">Recent Change</div>
                    <div>
                      {priceChange.change > 0 ? "+" : ""}
                      ${priceChange.change.toFixed(2)} (
                      {priceChange.percent.toFixed(2)}%)
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-wide text-white/45">
                  Total Cost
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  ${Number(item.totalCost ?? 0).toFixed(2)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-wide text-white/45">
                  Profit / Loss
                </div>
                <div className={`mt-2 text-2xl font-semibold ${profitLossClass}`}>
                  {item.profitLoss == null
                    ? "—"
                    : `${item.profitLoss >= 0 ? "+" : ""}$${item.profitLoss.toFixed(2)}`}
                </div>
              </div>
            </div>

            {/* Pricing details */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 text-lg font-semibold">Pricing Details</div>
              <div className="text-sm text-white/60">
                OmniVault uses the best available value for this item.
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    Manual Market Price
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {item.manualMarketPrice == null
                      ? "—"
                      : `$${item.manualMarketPrice.toFixed(2)}`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    Catalog Market Price
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {item.catalogMarketPrice == null
                      ? "—"
                      : `$${item.catalogMarketPrice.toFixed(2)}`}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-white/45">
                  Effective Market Price Used
                </div>
                <div className="mt-2 text-3xl font-semibold">
                  ${item.effectiveMarketPrice.toFixed(2)}
                </div>
                <div className="mt-2 text-sm text-white/55">
                  Last market update:{" "}
                  {item.updatedAtLabel ?? "No market update yet"}
                </div>
              </div>
            </div>

            {/* Edit form */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 text-lg font-semibold">Edit Item Details</div>

              <form action={updateItemDetails} className="space-y-4">
                <input type="hidden" name="id" value={item.id} />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-white/60">Condition</div>
                    <input
                      name="condition"
                      defaultValue={item.condition ?? ""}
                      placeholder="Near Mint, Sealed, Painted..."
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-white/60">Quantity</div>
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      defaultValue={item.quantity}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-white/60">
                      Purchase Price
                    </div>
                    <input
                      name="purchasePrice"
                      defaultValue={item.purchasePrice ?? ""}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-white/60">
                      Manual Market Price
                    </div>
                    <input
                      name="marketPrice"
                      defaultValue={item.manualMarketPrice ?? ""}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs text-white/60">Notes</div>
                  <textarea
                    name="notes"
                    defaultValue={item.notes ?? ""}
                    rows={5}
                    placeholder="Add notes about condition, pull source, grading plans, paint details, storage location..."
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <SubmitButton className="rounded-xl border border-blue-400/30 bg-blue-500/15 px-4 py-2 text-sm hover:bg-blue-500/20">
                    Save Item Details
                  </SubmitButton>
                </div>
              </form>
            </div>

            {/* Price history */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 text-lg font-semibold">
                Recent Price History
              </div>
              <div className="mb-4 text-sm text-white/60">
                Latest tracked price points for this item
              </div>

              {item.history.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
                  No price history yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {item.history.slice(0, 8).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
                    >
                      <div className="text-white/70">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(entry.createdAt))}
                      </div>

                      <div className="text-white/50">{entry.source}</div>

                      <div className="font-medium">
                        ${entry.marketPrice.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delete section */}
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="mb-3 text-lg font-semibold text-red-300">
                Danger Zone
              </div>

              <form action={deleteItem}>
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm hover:bg-red-500/20">
                  Delete Item
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}