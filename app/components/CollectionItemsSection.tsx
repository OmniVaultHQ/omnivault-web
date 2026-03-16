"use client";

/*
CollectionItemsSection

Purpose:
- Renders the collection item list/grid
- Handles item card clicks
- Opens ItemDetailModal
- Keeps modal state on the client

Why this exists:
- page.tsx is a server component, so it cannot use useState
- modals need client-side state
*/

import { useMemo, useState } from "react";
import SubmitButton from "@/app/components/Submitbutton";
import PriceHistory from "@/app/components/PriceHistory";
import ItemDetailModal from "@/app/components/ItemDetailModal";

/*
One price history row for an item
*/
type PriceEntry = {
  id: string;
  marketPrice: number;
  createdAt: Date | string;
  source: string;
  lastUpdated?: Date | string;
};

/*
One owned collection row plus linked item data
IMPORTANT:
- condition belongs to the owned row, not the shared item
*/
type CollectionRow = {
  id: string;
  quantity: number;
  purchasePrice: number | null;
  marketPrice: number | null;

  // Condition saved on the owned collection row
  // Example: Near Mint, Painted, Sealed
  condition: string | null;
  notes: string | null;

   item: {
    id: string;
    name: string;
    game: string;
    set: string;
    category?: string | null;
    imageUrl?: string | null;
    isCustom?: boolean;
    prices: PriceEntry[];
  };
};

type Props = {
  sorted: CollectionRow[];
  currentView: "list" | "grid";

  savePurchasePrice: (formData: FormData) => Promise<void>;
  saveMarketPrice: (formData: FormData) => Promise<void>;
  updateQuantity: (formData: FormData) => Promise<void>;
  deleteItem: (formData: FormData) => Promise<void>;
  updateItemDetails: (formData: FormData) => Promise<void>;
};

export default function CollectionItemsSection({
  sorted,
  currentView,
  savePurchasePrice,
  saveMarketPrice,
  updateQuantity,
  deleteItem,
  updateItemDetails,
}: Props) {
  /*
  selectedItemId
  - Stores which collection row is currently open in the modal
  */
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  /*
  Format a date nicely for the UI
  */
  function formatPriceUpdatedAt(date: Date | string | null) {
    if (!date) return null;

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  }

  /*
  Manual market price saved on collection row
  */
  function getManualMarketPrice(row: CollectionRow) {
    return row.marketPrice ?? null;
  }

  /*
  Purchase price saved on collection row
  */
  function getPurchasePrice(row: CollectionRow) {
    return row.purchasePrice ?? null;
  }

  /*
  Latest shared/catalog market price
  */
  function getCatalogMarketPrice(row: CollectionRow) {
    return row.item.prices?.[0]?.marketPrice ?? null;
  }

  /*
  Latest shared/catalog price timestamp
  */
  function getCatalogPriceUpdatedAt(row: CollectionRow) {
    return (
      row.item.prices?.[0]?.lastUpdated ??
      row.item.prices?.[0]?.createdAt ??
      null
    );
  }

  /*
  Effective market price priority:
  1. manual market price on collection row
  2. latest catalog/shared price
  3. purchase price fallback
  4. zero
  */
  function getEffectiveMarketPrice(row: CollectionRow) {
    const manual = getManualMarketPrice(row);
    const catalog = getCatalogMarketPrice(row);
    const purchase = getPurchasePrice(row);

    return manual ?? catalog ?? purchase ?? 0;
  }

  /*
  Total market value for this row
  */
  function getRowMarketTotal(row: CollectionRow) {
    return getEffectiveMarketPrice(row) * row.quantity;
  }

  /*
  Total purchase value for this row
  */
  function getRowPurchaseTotal(row: CollectionRow) {
    return (getPurchasePrice(row) ?? 0) * row.quantity;
  }

  /*
  Profit/loss for this row
  */
  function getRowProfitLoss(row: CollectionRow) {
    const purchase = getPurchasePrice(row);
    if (purchase == null) return null;

    return getRowMarketTotal(row) - getRowPurchaseTotal(row);
  }

  /*
  Get most recent price change from the newest 2 history rows
  */
  function getPriceChange(row: CollectionRow) {
    const prices = row.item.prices ?? [];
    if (prices.length < 2) return null;

    const latest = prices[0].marketPrice;
    const previous = prices[1].marketPrice;

    return latest - previous;
  }

  /*
  Build the selected modal item from the clicked collection row
  */
  const modalItem = useMemo(() => {
    if (!selectedItemId) return null;

    const row = sorted.find((x) => x.id === selectedItemId);
    if (!row) return null;

    const purchasePrice = getPurchasePrice(row);
    const manualMarketPrice = getManualMarketPrice(row);
    const catalogMarketPrice = getCatalogMarketPrice(row);
    const effectiveMarketPrice = getEffectiveMarketPrice(row);
    const totalValue = getRowMarketTotal(row);
    const totalCost = getRowPurchaseTotal(row);
    const profitLoss = getRowProfitLoss(row);
    const updatedAtLabel = formatPriceUpdatedAt(getCatalogPriceUpdatedAt(row));

    return {
  id: row.id,
  name: row.item.name,
  game: row.item.game,
  set: row.item.set,
  category: row.item.category ?? null,
  imageUrl: row.item.imageUrl ?? null,
  isCustom: row.item.isCustom ?? false,

  condition: row.condition ?? null,

  // NEW: notes field for modal editing
  notes: (row as any).notes ?? null,

  quantity: row.quantity,
  purchasePrice,
  manualMarketPrice,
  catalogMarketPrice,
  effectiveMarketPrice,
  totalValue,
  totalCost,
  profitLoss,
  updatedAtLabel,
  history: row.item.prices.map((price) => ({
    id: price.id,
    marketPrice: price.marketPrice,
    createdAt: price.createdAt,
    source: price.source,
  })),
};
  }, [selectedItemId, sorted]);

  /*
  Open the detail modal for one row
  */
  function openItemModal(rowId: string) {
    setSelectedItemId(rowId);
  }

  /*
  Close the detail modal
  */
  function closeItemModal() {
    setSelectedItemId(null);
  }

  /*
  Keyboard support for opening item details
  */
  function handleCardKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>,
    rowId: string
  ) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openItemModal(rowId);
    }
  }

  return (
    <>
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-sm text-white/60">
          No items match your filters.
        </div>
      ) : currentView === "list" ? (
        <div className="space-y-4">
          {sorted.map((i) => {
            const item = i.item;
            const effectiveMarketPrice = getEffectiveMarketPrice(i);
            const latestPriceUpdatedAt = formatPriceUpdatedAt(
              getCatalogPriceUpdatedAt(i)
            );
            const marketTotal = getRowMarketTotal(i);
            const purchaseTotal = getRowPurchaseTotal(i);
            const rowProfitLoss = getRowProfitLoss(i);
            const priceChange = getPriceChange(i);

            return (
              <div
                key={i.id}
                className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.06] xl:grid-cols-[220px_minmax(260px,320px)_1fr]"
              >
                {/* LEFT: image + title (clickable area) */}
                <div
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer items-center gap-4 rounded-xl transition hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  onClick={() => openItemModal(i.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, i.id)}
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20 text-[10px] text-white/40">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "No Image"
                    )}
                  </div>

                  <div>
                    <div className="text-base font-semibold">
                      {item.name}
                      <span className="ml-2 text-white/60">x {i.quantity}</span>
                    </div>

                    <div className="mt-1 text-xs text-white/60">
                      {item.category ? `${item.category} • ` : ""}
                      {item.game} • {item.set}

                      {i.condition ? (
                        <span className="ml-2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                          {i.condition}
                        </span>
                      ) : null}

                      {item.isCustom && (
                        <span className="ml-2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* MIDDLE: price history */}
                <div className="w-full xl:ml-auto xl:max-w-[320px]">
                  <PriceHistory
                    entries={i.item.prices.map((priceRow) => ({
                      id: priceRow.id,
                      marketPrice: priceRow.marketPrice,
                      createdAt: priceRow.createdAt,
                      source: priceRow.source,
                    }))}
                  />
                </div>

                {/* RIGHT: values + inline editors */}
                <div className="flex w-full flex-col gap-3">
                  <div className="flex justify-end">
                    <div className="min-w-[180px] rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-xs leading-tight">
                      <div className="text-white/55">
                        Cost: ${purchaseTotal.toFixed(2)}
                      </div>

                      <div className="font-medium text-white/85">
                        Value: ${marketTotal.toFixed(2)}
                      </div>

                      <div
                        className={
                          rowProfitLoss == null
                            ? "text-white/35"
                            : rowProfitLoss > 0
                              ? "text-green-400"
                              : rowProfitLoss < 0
                                ? "text-red-400"
                                : "text-white/55"
                        }
                      >
                        Profit/Loss:{" "}
                        {rowProfitLoss == null
                          ? "—"
                          : `${rowProfitLoss >= 0 ? "+" : ""}$${rowProfitLoss.toFixed(2)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="mb-1 text-xs text-white/60">
                          Purchase
                        </div>
                        <form
                          action={savePurchasePrice}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="id" value={i.id} />
                          <input
                            name="purchasePrice"
                            defaultValue={getPurchasePrice(i) ?? ""}
                            className="w-[90px] rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-sm outline-none"
                          />
                          <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                            Save
                          </SubmitButton>
                        </form>
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-white/60">Market</div>
                        <form
                          action={saveMarketPrice}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="id" value={i.id} />
                          <input
                            name="marketPrice"
                            defaultValue={getManualMarketPrice(i) ?? ""}
                            className="w-[90px] rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-sm outline-none"
                          />
                          <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                            Save
                          </SubmitButton>
                        </form>
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-white/60">Qty</div>
                        <form
                          action={updateQuantity}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="id" value={i.id} />
                          <input
                            name="quantity"
                            type="number"
                            min="1"
                            defaultValue={i.quantity}
                            className="w-[70px] rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-sm outline-none"
                          />
                          <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                            Save
                          </SubmitButton>
                        </form>
                      </div>
                    </div>

                    <form action={deleteItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <SubmitButton className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs hover:bg-red-500/20">
                        Delete
                      </SubmitButton>
                    </form>
                  </div>

                  <div className="ml-auto text-right text-[11px] text-white/40">
                    <div>
                      Market used: ${effectiveMarketPrice.toFixed(2)} each
                    </div>

                    {priceChange !== null && (
                      <div
                        className={
                          priceChange > 0
                            ? "text-green-400"
                            : priceChange < 0
                              ? "text-red-400"
                              : "text-white/40"
                        }
                      >
                        Change: {priceChange >= 0 ? "+" : ""}
                        ${priceChange.toFixed(2)}
                      </div>
                    )}

                    <div>
                      Updated: {latestPriceUpdatedAt ?? "No market update yet"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {sorted.map((i) => {
            const item = i.item;
            const effectiveMarketPrice = getEffectiveMarketPrice(i);
            const latestPriceUpdatedAt = formatPriceUpdatedAt(
              getCatalogPriceUpdatedAt(i)
            );
            const marketTotal = getRowMarketTotal(i);
            const purchaseTotal = getRowPurchaseTotal(i);
            const rowProfitLoss = getRowProfitLoss(i);

            return (
              <div
                key={i.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:border-blue-400/20 hover:bg-white/[0.06]"
              >
                {/* CLICKABLE DISPLAY AREA */}
                <div
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => openItemModal(i.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, i.id)}
                >
                  <div className="aspect-[3/4] w-full overflow-hidden border-b border-white/10 bg-black/30">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">
                          {item.name}
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          {item.category ? `${item.category} • ` : ""}
                          {item.game} • {item.set}
                        </div>
                      </div>

                      <span className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-xs">
                        Qty {i.quantity}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {i.condition ? (
                        <div className="inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                          {i.condition}
                        </div>
                      ) : null}

                      {item.isCustom ? (
                        <div className="inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                          Custom
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-white/45">Cost</div>
                        <div className="mt-1 font-medium">
                          ${purchaseTotal.toFixed(2)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-white/45">Market Price</div>
                        <div className="mt-1 font-medium">
                          ${effectiveMarketPrice.toFixed(2)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-3">
                        <div className="text-white/45">Total Value</div>
                        <div className="mt-1 font-semibold">
                          ${marketTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div
                      className={
                        rowProfitLoss == null
                          ? "mt-3 text-xs text-white/35"
                          : rowProfitLoss > 0
                            ? "mt-3 text-xs text-green-400"
                            : rowProfitLoss < 0
                              ? "mt-3 text-xs text-red-400"
                              : "mt-3 text-xs text-white/55"
                      }
                    >
                      Profit/Loss:{" "}
                      {rowProfitLoss == null
                        ? "—"
                        : `${rowProfitLoss >= 0 ? "+" : ""}$${rowProfitLoss.toFixed(2)}`}
                    </div>

                    <div className="mt-1 text-[11px] text-white/40">
                      <div>
                        Market used: ${effectiveMarketPrice.toFixed(2)} each
                      </div>
                      <div>
                        Updated: {latestPriceUpdatedAt ?? "No market update yet"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* NON-CLICKABLE TOOLS AREA */}
                <div className="px-4 pb-4">
                  <div className="mt-3">
                    <PriceHistory
                      entries={item.prices.map((price) => ({
                        id: price.id,
                        marketPrice: price.marketPrice,
                        createdAt: price.createdAt,
                        source: price.source,
                      }))}
                    />
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="mb-1 text-xs text-white/60">
                        Purchase
                      </div>
                      <form
                        action={savePurchasePrice}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="id" value={i.id} />
                        <input
                          name="purchasePrice"
                          defaultValue={getPurchasePrice(i) ?? ""}
                          placeholder="Purchase"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                        />
                        <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                          Save
                        </SubmitButton>
                      </form>
                    </div>

                    <div>
                      <div className="mb-1 text-xs text-white/60">Market</div>
                      <form
                        action={saveMarketPrice}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="id" value={i.id} />
                        <input
                          name="marketPrice"
                          defaultValue={getManualMarketPrice(i) ?? ""}
                          placeholder="Market"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                        />
                        <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                          Save
                        </SubmitButton>
                      </form>
                    </div>

                    <div>
                      <div className="mb-1 text-xs text-white/60">Qty</div>
                      <form
                        action={updateQuantity}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="id" value={i.id} />
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          defaultValue={i.quantity}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                        />
                        <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                          Save
                        </SubmitButton>
                      </form>
                    </div>

                    <form action={deleteItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <SubmitButton className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm hover:bg-red-500/20">
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ItemDetailModal
        open={Boolean(modalItem)}
        onClose={closeItemModal}
        item={modalItem}
        updateItemDetails={updateItemDetails}
        deleteItem={deleteItem}
        />
    </>
  );
}