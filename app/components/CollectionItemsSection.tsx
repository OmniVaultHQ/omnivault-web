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

import { useEffect, useMemo, useState } from "react";
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

  /*
  If true, this row is manually controlled and auto refresh
  should not overwrite it.
  */
  manualPriceLocked?: boolean | null;

  /*
  Where the current owned-row market price came from
  Examples:
  - manual
  - simulated
  - tcgplayer
  */
  priceSource?: string | null;

  /*
  When the owned-row market price was last updated
  */
  lastPriceUpdated?: Date | string | null;

  /*
  Condition saved on the owned collection row
  Example: Near Mint, Painted, Sealed
  */
  condition: string | null;
  notes: string | null;

  item: {
    id: string;
    name: string;
    game: string;
    set: string;
    rarity?: string | null;
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
  useAutoPriceAgain: (formData: FormData) => Promise<void>;
};

export default function CollectionItemsSection({
  sorted,
  currentView,
  savePurchasePrice,
  saveMarketPrice,
  updateQuantity,
  deleteItem,
  updateItemDetails,
  useAutoPriceAgain,
}: Props) {
  /*
  LOCAL STATE COPY OF ITEMS

  Why:
  - allows this client component to keep a live copy of the rows
  - when the server sends updated rows later, we sync back to them
  - this is the first step toward smoother UI behavior
  */
  const [localItems, setLocalItems] = useState(sorted);

  /*
  selectedItemId
  - Stores which collection row is currently open in the modal
  */
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  /*
  Keep localItems synced with fresh server data.

  Why:
  - when filters/sorts/search/collection changes happen,
    the server gives us a new sorted array
  - this effect makes sure local client state updates too
  */
  useEffect(() => {
    setLocalItems(sorted);
  }, [sorted]);

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
  True if this row is manually locked
  */
  function isManualPriceLocked(row: CollectionRow) {
    return Boolean(row.manualPriceLocked);
  }

  /*
  Where the current owned-row market price came from
  */
  function getRowPriceSource(row: CollectionRow) {
    return row.priceSource ?? null;
  }

  /*
  Latest owned-row market price timestamp
  */
  function getRowPriceUpdatedAt(row: CollectionRow) {
    return row.lastPriceUpdated ?? null;
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
  Fallback market price for catalog items.

  Why this exists:
  - newly added catalog items may not have a saved ItemPrice row yet
  - we still want owned cards to show value immediately
  - this keeps the row display consistent with set completion fallback logic
  */
  function getFallbackMarketPrice(row: CollectionRow) {
    const rarity = row.item.rarity?.toLowerCase() ?? "";

    if (rarity.includes("holo")) return 50;
    if (rarity.includes("rare")) return 25;
    if (rarity.includes("uncommon")) return 5;

    return 1;
  }

  /*
  Active displayed market price source.

  Priority:
  1. Manual locked price
  2. Row-level synced price source
  3. Catalog/shared history source
  4. Purchase fallback
  5. Rarity fallback
  */
  function getActivePriceSource(row: CollectionRow) {
    if (isManualPriceLocked(row) && getManualMarketPrice(row) !== null) {
      return "manual";
    }

    if (getManualMarketPrice(row) !== null && getRowPriceSource(row)) {
      return getRowPriceSource(row);
    }

    if (row.item.prices?.[0]?.source) {
      return row.item.prices[0].source;
    }

    if (getPurchasePrice(row) !== null) {
      return "purchase fallback";
    }

    return "rarity fallback";
  }

  /*
  Active displayed market price updated time.

  Priority:
  1. Row-level updated time
  2. Catalog/shared updated time
  */
  function getActivePriceUpdatedAt(row: CollectionRow) {
    return getRowPriceUpdatedAt(row) ?? getCatalogPriceUpdatedAt(row);
  }

  /*
  Effective market price priority:
  1. manual market price on collection row
  2. latest catalog/shared price
  3. purchase price fallback
  4. rarity-based fallback
  */
  function getEffectiveMarketPrice(row: CollectionRow) {
    const manual = getManualMarketPrice(row);
    const catalog = getCatalogMarketPrice(row);
    const purchase = getPurchasePrice(row);
    const fallback = getFallbackMarketPrice(row);

    return manual ?? catalog ?? purchase ?? fallback;
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
  Friendly label for price source
  */
  function getPriceSourceLabel(row: CollectionRow) {
    const source = getActivePriceSource(row);

    switch (source) {
      case "manual":
        return isManualPriceLocked(row) ? "Manual (Locked)" : "Manual";
      case "simulated":
        return "Simulated";
      case "tcgplayer":
        return "TCGPlayer";
      case "ebay":
        return "eBay";
      case "pricecharting":
        return "PriceCharting";
      case "purchase fallback":
        return "Purchase Fallback";
      case "rarity fallback":
        return "Rarity Fallback";
      case "none":
        return "No Source";
      default:
        return source;
    }
  }

  /*
  Visual style for price source badges.
  */
  function getPriceSourceBadgeClass(row: CollectionRow) {
    const source = getActivePriceSource(row);

    switch (source) {
      case "manual":
        return "border-amber-400/30 bg-amber-500/10 text-amber-300";
      case "simulated":
        return "border-blue-400/30 bg-blue-500/10 text-blue-300";
      case "tcgplayer":
        return "border-purple-400/30 bg-purple-500/10 text-purple-300";
      case "ebay":
        return "border-cyan-400/30 bg-cyan-500/10 text-cyan-300";
      case "pricecharting":
        return "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300";
      case "purchase fallback":
        return "border-orange-400/30 bg-orange-500/10 text-orange-300";
      case "rarity fallback":
        return "border-yellow-400/30 bg-yellow-500/10 text-yellow-300";
      default:
        return "border-white/10 bg-white/5 text-white/60";
    }
  }

  /*
  Color helper for row profit/loss text.
  */
  function getProfitLossTextClass(value: number | null) {
    if (value == null) return "text-white/35";
    if (value > 0) return "text-green-400";
    if (value < 0) return "text-red-400";
    return "text-white/55";
  }

  /*
  Format profit/loss for display.
  */
  function formatProfitLoss(value: number | null) {
    if (value == null) return "—";
    return `${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
  }

  /*
  Build the selected modal item from the clicked collection row

  IMPORTANT:
  Use localItems here, not sorted.

  Why:
  - the modal should always reflect the same data the screen is rendering
  */
  const modalItem = useMemo(() => {
    if (!selectedItemId) return null;

    const row = localItems.find((x) => x.id === selectedItemId);
    if (!row) return null;

    const purchasePrice = getPurchasePrice(row);
    const manualMarketPrice = getManualMarketPrice(row);
    const catalogMarketPrice = getCatalogMarketPrice(row);
    const effectiveMarketPrice = getEffectiveMarketPrice(row);
    const totalValue = getRowMarketTotal(row);
    const totalCost = getRowPurchaseTotal(row);
    const profitLoss = getRowProfitLoss(row);
    const updatedAtLabel = formatPriceUpdatedAt(getActivePriceUpdatedAt(row));

    return {
      id: row.id,
      name: row.item.name,
      game: row.item.game,
      set: row.item.set,
      category: row.item.category ?? null,
      imageUrl: row.item.imageUrl ?? null,
      isCustom: row.item.isCustom ?? false,
      condition: row.condition ?? null,
      notes: row.notes ?? null,
      quantity: row.quantity,
      purchasePrice,
      manualMarketPrice,
      catalogMarketPrice,
      effectiveMarketPrice,
      totalValue,
      totalCost,
      profitLoss,
      updatedAtLabel,
      manualPriceLocked: isManualPriceLocked(row),
      activePriceSource: getPriceSourceLabel(row),
      history: row.item.prices.map((price) => ({
        id: price.id,
        marketPrice: price.marketPrice,
        createdAt: price.createdAt,
        source: price.source,
      })),
    };
  }, [selectedItemId, localItems]);

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
      {localItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-sm text-white/60">
          No items match your filters.
        </div>
      ) : currentView === "list" ? (
        <div className="space-y-4">
          {localItems.map((i) => {
            const item = i.item;
            const effectiveMarketPrice = getEffectiveMarketPrice(i);
            const activeUpdatedAt = formatPriceUpdatedAt(
              getActivePriceUpdatedAt(i)
            );
            const marketTotal = getRowMarketTotal(i);
            const purchaseTotal = getRowPurchaseTotal(i);
            const rowProfitLoss = getRowProfitLoss(i);
            const priceChange = getPriceChange(i);
            const sourceLabel = getPriceSourceLabel(i);
            const locked = isManualPriceLocked(i);

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

                      {locked ? (
                        <span className="ml-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                          Manual Locked
                        </span>
                      ) : null}
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
                    <div className="min-w-[210px] rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-right text-xs leading-tight">
                      <div className="text-white/45">Cost Basis</div>
                      <div className="font-medium text-white/80">
                        ${purchaseTotal.toFixed(2)}
                      </div>

                      <div className="mt-2 text-white/45">Market Value</div>
                      <div className="font-semibold text-white">
                        ${marketTotal.toFixed(2)}
                      </div>

                      <div className="mt-2 text-white/45">Profit / Loss</div>
                      {/*
                        =========================================
                        PROFIT / LOSS DISPLAY (ENHANCED)
                        -----------------------------------------
                        Purpose:
                        - Make gains/losses visually obvious
                        - Add background + color feedback
                        - Feels like investing dashboard
                        =========================================
                        */}
                        <div
                          className={`mt-1 rounded-md px-2 py-1 text-xs font-semibold inline-block
                            ${
                              rowProfitLoss == null
                                ? "bg-white/5 text-white/40"
                                : rowProfitLoss > 0
                                ? "bg-green-500/15 text-green-400 border border-green-400/20"
                                : rowProfitLoss < 0
                                ? "bg-red-500/15 text-red-400 border border-red-400/20"
                                : "bg-white/10 text-white/60"
                            }
                          `}
                        >
                          {rowProfitLoss == null
                            ? "No cost basis"
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

                  <div className="ml-auto flex flex-col items-end gap-1 text-right text-[11px]">
                    <div className="text-white/40">
                      Market used: ${effectiveMarketPrice.toFixed(2)} each
                    </div>

                    <div
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] ${getPriceSourceBadgeClass(i)}`}
                    >
                      {sourceLabel}
                    </div>

                    {priceChange !== null && (
                      <div className={getProfitLossTextClass(priceChange)}>
                        Change: {priceChange >= 0 ? "+" : ""}
                        ${priceChange.toFixed(2)}
                      </div>
                    )}

                    <div className="text-white/35">
                      Updated: {activeUpdatedAt ?? "No market update yet"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {localItems.map((i) => {
            const item = i.item;
            const effectiveMarketPrice = getEffectiveMarketPrice(i);
            const activeUpdatedAt = formatPriceUpdatedAt(
              getActivePriceUpdatedAt(i)
            );
            const marketTotal = getRowMarketTotal(i);
            const purchaseTotal = getRowPurchaseTotal(i);
            const rowProfitLoss = getRowProfitLoss(i);
            const sourceLabel = getPriceSourceLabel(i);
            const locked = isManualPriceLocked(i);

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

                      {locked ? (
                        <div className="inline-flex rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                          Manual Locked
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
                      className={`mt-3 text-xs font-medium ${getProfitLossTextClass(rowProfitLoss)}`}
                    >
                      Profit/Loss: {formatProfitLoss(rowProfitLoss)}
                    </div>

                    <div className="mt-2 space-y-1 text-[11px]">
                      <div className="text-white/40">
                        Market used: ${effectiveMarketPrice.toFixed(2)} each
                      </div>

                      <div
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] ${getPriceSourceBadgeClass(i)}`}
                      >
                        {sourceLabel}
                      </div>

                      <div className="text-white/35">
                        Updated: {activeUpdatedAt ?? "No market update yet"}
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
        useAutoPriceAgain={useAutoPriceAgain}
      />
    </>
  );
}