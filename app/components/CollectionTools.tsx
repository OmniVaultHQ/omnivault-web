"use client";

import { useEffect } from "react";
import AddItemForm from "@/app/components/AddItemForm";
import CatalogSearch from "@/app/components/CatalogSearch";

type Collection = {
  id: string;
  name: string;
};

type Props = {
  isMainCollection: boolean;
  activeCollectionId: string;
  collections: { id: string; name: string }[];
  addItem: (formData: FormData) => Promise<void>;
  defaultCatalogQuery?: string;
};

export default function CollectionTools({
  isMainCollection,
  activeCollectionId,
  collections,
  addItem,
  defaultCatalogQuery = "",
}: Props) {
  /*
  ============================================================
  AUTO SCROLL TO COLLECTION TOOLS
  ------------------------------------------------------------
  If the dashboard was opened from a missing-item search
  shortcut, scroll this section into view automatically.

  Example:
  /dashboard?catalog=Dark%20Magician#collection-tools

  This is more reliable than only depending on the URL hash.
  ============================================================
  */
  useEffect(() => {
    if (!defaultCatalogQuery) return;

    const el = document.getElementById("collection-tools");
    if (!el) return;

    const timer = window.setTimeout(() => {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [defaultCatalogQuery]);

  return (
    <div id="collection-tools" className="mt-10 scroll-mt-24">
      {/* =========================================
          SECTION HEADER
          Explains what this area is for
         ========================================= */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Collection Tools</h2>
        <p className="mt-1 text-sm text-white/55">
          Search your catalog, add custom items, and export your collection.
        </p>
      </div>

      {/* =========================================
          EXPORT ACTION
          Quick action row for exporting collection data
         ========================================= */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <a
          href={
            isMainCollection
              ? "/api/export-csv"
              : `/api/export-csv?cid=${encodeURIComponent(activeCollectionId)}`
          }
          className="inline-flex rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-medium transition hover:bg-blue-400/20"
        >
          Export Collection CSV
        </a>

        <div className="text-xs text-white/45">
          Download your current collection as a spreadsheet-friendly CSV file.
        </div>
      </div>

      {/* =========================================
          TOOL CARDS
          Split catalog search and manual add into
          two separate cards for a cleaner UI
         ========================================= */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* =========================================
            CATALOG SEARCH CARD
            Use this for items already in your database
           ========================================= */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Catalog Search</h3>
              <p className="mt-1 text-sm text-white/55">
                Find items already in your OmniVault catalog and add them
                directly to this collection.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              Fast Add
            </div>
          </div>

          <div className="mt-4">
            <CatalogSearch
              collections={collections}
              activeCollectionId={activeCollectionId}
              defaultQuery={defaultCatalogQuery}
            />
          </div>
        </section>

        {/* =========================================
            CUSTOM ITEM CARD
            Use this when the item does not exist
            in the catalog yet
           ========================================= */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Add Custom Item</h3>
              <p className="mt-1 text-sm text-white/55">
                Manually create an item with your own image, purchase price,
                quantity, and details.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              Manual Entry
            </div>
          </div>

          <div className="mt-4">
            <AddItemForm
              action={addItem}
              collections={collections}
              activeCollectionId={activeCollectionId}
            />
          </div>
        </section>
      </div>
    </div>
  );
}