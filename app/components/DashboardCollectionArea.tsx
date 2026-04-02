"use client";

import { useEffect, useState } from "react";
import CollectionItemsSection from "@/app/components/CollectionItemsSection";
import CollectionTools from "@/app/components/CollectionTools";

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
One collection row plus linked item data

This must match what dashboard/page.tsx passes down.
*/
type CollectionRow = {
  id: string;
  collectionId: string;
  quantity: number;
  purchasePrice: number | null;
  marketPrice: number | null;
  manualPriceLocked?: boolean | null;
  priceSource?: string | null;
  lastPriceUpdated?: Date | string | null;
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
  /*
  Collection list data currently shown on dashboard
  */
  sorted: CollectionRow[];

  /*
  Current view mode
  */
  currentView: "list" | "grid";

  /*
  Collection tools props
  */
  isMainCollection: boolean;
  activeCollectionId: string;
  collections: { id: string; name: string }[];
  addItem: (formData: FormData) => Promise<void>;
  onAdd: (itemId: string, collectionId: string) => Promise<void>;
  defaultCatalogQuery?: string;

  /*
  Existing row action handlers
  */
  savePurchasePrice: (formData: FormData) => Promise<void>;
  saveMarketPrice: (formData: FormData) => Promise<void>;
  updateQuantity: (formData: FormData) => Promise<void>;
  deleteItem: (formData: FormData) => Promise<void>;
  updateItemDetails: (formData: FormData) => Promise<void>;
  useAutoPriceAgain: (formData: FormData) => Promise<void>;
};

export default function DashboardCollectionArea({
  sorted,
  currentView,
  isMainCollection,
  activeCollectionId,
  collections,
  addItem,
  onAdd,
  defaultCatalogQuery = "",
  savePurchasePrice,
  saveMarketPrice,
  updateQuantity,
  deleteItem,
  updateItemDetails,
  useAutoPriceAgain,
}: Props) {
  /*
  Shared live rows for this whole dashboard area.

  Why this exists:
  - CatalogSearch and CollectionItemsSection are siblings
  - they need one shared client-side source of truth
  - when Add is clicked, we update this list immediately
  */
  const [liveItems, setLiveItems] = useState(sorted);

  /*
  Keep live items synced when server data changes
  (collection switch, search, sort, refresh, etc.)
  */
  useEffect(() => {
    setLiveItems(sorted);
  }, [sorted]);

  /*
  Wrapped add handler

  What it does:
  1. calls the real server add action
  2. instantly updates the visible collection list

  Current instant behavior:
  - if item already exists in current visible rows, increase quantity by 1
  - if item is not already visible, server will still save it correctly,
    but it will appear on next server refresh/filter change

  This still gives a much smoother feel right now.
  */
  async function handleInstantAdd(itemId: string, collectionId: string) {
    await onAdd(itemId, collectionId);

    /*
    Only try instant UI update if the add was to the currently active collection
    or Main collection view.
    */
    setLiveItems((prev) => {
      const existingIndex = prev.findIndex(
        (row) =>
          row.item.id === itemId &&
          (isMainCollection || row.collectionId === collectionId)
      );

      /*
      If item is already visible in the current list,
      update quantity instantly.
      */
      if (existingIndex !== -1) {
        return prev.map((row, index) =>
          index === existingIndex
            ? {
                ...row,
                quantity: row.quantity + 1,
              }
            : row
        );
      }

      /*
      If item is not already in the current visible list,
      leave list unchanged for now.

      Why:
      - we do not yet have full row data here to build a new card safely
      - server already saved it
      - next refresh/search/sort/collection load will show it
      */
      return prev;
    });
  }

  return (
    <>
      <div className="mt-5">
        <CollectionItemsSection
          sorted={liveItems}
          currentView={currentView}
          savePurchasePrice={savePurchasePrice}
          saveMarketPrice={saveMarketPrice}
          updateQuantity={updateQuantity}
          deleteItem={deleteItem}
          updateItemDetails={updateItemDetails}
          useAutoPriceAgain={useAutoPriceAgain}
        />
      </div>

      <CollectionTools
        isMainCollection={isMainCollection}
        activeCollectionId={activeCollectionId}
        collections={collections}
        addItem={addItem}
        onAdd={handleInstantAdd}
        defaultCatalogQuery={defaultCatalogQuery}
      />
    </>
  );
}