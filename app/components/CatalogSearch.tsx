"use client";

import { useEffect, useRef, useState } from "react";

/*
This type MUST match what the API returns from:

app/api/catalog/search/route.ts

If this gets out of sync, UI bugs happen.
*/
/*
This type MUST match what the API returns from:

app/api/catalog/search/route.ts
*/
type Item = {
  id: string;
  name: string;
  game: string | null;
  set: string | null;
  imageUrl?: string | null;
  rarity?: string | null;
  itemNumber?: string | null;

  /*
  NEW: latest market price (flattened in API)
  */
  marketPrice?: number | null;
};

type CollectionOption = {
  id: string;
  name: string;
};

type Props = {
  onAdd: (itemId: string, collectionId: string) => Promise<void>;
  collections: CollectionOption[];
  activeCollectionId: string;
  defaultQuery?: string;
};

export default function CatalogSearch({
  onAdd,
  collections,
  activeCollectionId,
  defaultQuery = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedCollectionId, setSelectedCollectionId] = useState(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("lastCollectionId") || activeCollectionId;
  }
  return activeCollectionId;
});

  const [addedItemId, setAddedItemId] = useState<string | null>(null);

  /*
  Keep collection selector synced with dashboard
  */
  useEffect(() => {
    setSelectedCollectionId(activeCollectionId);
  }, [activeCollectionId]);

  /*
  When arriving from "missing item search"
  - preload query
  - auto search
  - focus input
  */
  useEffect(() => {
    setQuery(defaultQuery);

    if (defaultQuery.trim()) {
      void handleSearch(defaultQuery);
    }

    // Focus search input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [defaultQuery]);

  async function handleSearch(value: string) {
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
  `/api/catalog/search?q=${encodeURIComponent(value)}`
);

if (!res.ok) {
  const text = await res.text();
  console.error("Catalog search request failed:", text);
  setResults([]);
  return;
}

const data = await res.json();
setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Catalog search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(itemId: string) {
    try {
      await onAdd(itemId, selectedCollectionId);

      setAddedItemId(itemId);

      // Reset "Added" state after short delay
      setTimeout(() => {
        setAddedItemId((current) =>
          current === itemId ? null : current
        );
      }, 1200);
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  }

  return (
    <div className="space-y-4">
      {/* =========================
          SEARCH INPUT
         ========================= */}
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const value = e.target.value;

            /*
            Keep the input text updated
            */
            setQuery(value);

            /*
            Run catalog search immediately as the user types

            Why this matters:
            - before, typing only changed local state
            - results never updated unless Enter was pressed
            */
            void handleSearch(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              /*
              Allow Enter to manually re-run search too
              */
              void handleSearch(query);
            }
          }}
          placeholder="Search cards, models, or collectibles..."
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {loading
              ? "Searching catalog..."
              : query.trim()
              ? `${results.length} result${results.length === 1 ? "" : "s"}`
              : "Search your catalog"}
          </p>

          {/* COLLECTION PICKER */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Add to</label>
            <select
              value={selectedCollectionId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedCollectionId(value);
                localStorage.setItem("lastCollectionId", value);
              }}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none"
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =========================
          RESULTS
         ========================= */}
      <div className="space-y-3">
        {results.map((item) => {
          const wasAdded = addedItemId === item.id;

          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              {/* LEFT SIDE */}
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-zinc-500">No Img</span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {item.name}
                  </p>

                  <p className="mt-1 truncate text-xs text-zinc-400">
                    {item.game || "Unknown Game"} •{" "}
                    {item.set || "Unknown Set"}
                  </p>

                  {/* Show card number (VERY important for collectors) */}
                  {item.itemNumber && (
                    <p className="text-xs text-zinc-500">
                      #{item.itemNumber}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    {item.rarity && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        {item.rarity}
                      </span>
                    )}

                    {/* Show market price if available */}
                    {item.marketPrice != null && (
                      <span className="text-xs text-yellow-300">
                        ${item.marketPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE */}
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => handleAdd(item.id)}
                  disabled={wasAdded}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    wasAdded
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-500 text-white hover:bg-blue-400"
                  }`}
                >
                  {wasAdded ? "Added ✓" : "Add"}
                </button>

                {wasAdded && (
                  <span className="text-xs text-emerald-400">
                    Added to{" "}
                    {
                      collections.find(
                        (c) => c.id === selectedCollectionId
                      )?.name
                    }
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================
          EMPTY STATE
         ========================= */}
      {!loading && query.trim() && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-zinc-400">
          No matching catalog items found.
        </div>
      )}
    </div>
  );
}