"use client";

/*
This component runs on the CLIENT because it uses:
- React state
- browser fetch requests
- router.refresh()
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/*
Represents one catalog item returned from /api/catalog
*/
type CatalogItem = {
  id: string;
  name: string;
  game: string;
  set: string;
  imageUrl: string | null;
  price: number | null;
  rarity: string | null;
  setCode: string | null;
  itemNumber: string | null;
};

/*
Button state for each result row.

idle    = normal Add button
adding  = request in progress
added   = success feedback
error   = temporary failure feedback
*/
type Status = "idle" | "adding" | "added" | "error";

/*
Props passed from dashboard/page.tsx

collections:
All collections the user owns

activeCollectionId:
The collection selected by default
*/
type Props = {
  collections: { id: string; name: string }[];
  activeCollectionId: string;
};

export default function CatalogSearch({
  collections,
  activeCollectionId,
}: Props) {
  /*
  q
  Search text typed by the user
  */
  const [q, setQ] = useState("");

  /*
  items
  Search results returned from the catalog API
  */
  const [items, setItems] = useState<CatalogItem[]>([]);

  /*
  loading
  True while search request is running
  */
  const [loading, setLoading] = useState(false);

  /*
  collectionId
  Which collection to add items into
  */
  const [collectionId, setCollectionId] = useState(activeCollectionId);

  /*
  router
  Used to refresh dashboard data after adding an item
  */
  const router = useRouter();

  /*
  statusById
  Stores button status per item ID

  Example:
  {
    "abc123": "adding",
    "xyz999": "added"
  }
  */
  const [statusById, setStatusById] = useState<Record<string, Status>>({});

  /*
  timer
  Used for debounce so we do not call the API on every keystroke
  */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
  canSearch
  Only search when user typed at least 2 characters
  */
  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  /*
  Keep local collection selector synced if active collection changes
  */
  useEffect(() => {
    setCollectionId(activeCollectionId);
  }, [activeCollectionId]);

  /*
  SEARCH EFFECT

  Flow:
  1. Clear previous debounce timer
  2. If text too short, stop
  3. Wait 250ms
  4. Fetch /api/catalog
  5. Store results
  */
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (!canSearch) {
      setItems([]);
      setLoading(false);
      return;
    }

    timer.current = setTimeout(async () => {
      setLoading(true);

      try {
        const res = await fetch(`/api/catalog?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();

        // Only keep results if API gave us an array
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        // If API fails, clear results
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    // Cleanup if component rerenders/unmounts
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, canSearch]);

  /*
  ADD ITEM TO COLLECTION

  Flow:
  1. Mark button as "Adding..."
  2. Send POST request
  3. If success, show "Added!"
  4. Refresh dashboard data
  5. Reset button after short delay
  */
  async function addToCollection(item: CatalogItem) {
    setStatusById((prev) => ({ ...prev, [item.id]: "adding" }));

    try {
      const res = await fetch("/api/collection/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          quantity: 1,
          collectionId,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      // Success state
      setStatusById((prev) => ({ ...prev, [item.id]: "added" }));

      // Refresh dashboard so the added item appears immediately
      router.refresh();

      // Reset button back to idle
      setTimeout(() => {
        setStatusById((prev) => ({ ...prev, [item.id]: "idle" }));
      }, 650);
    } catch {
      // Error state
      setStatusById((prev) => ({ ...prev, [item.id]: "error" }));

      setTimeout(() => {
        setStatusById((prev) => ({ ...prev, [item.id]: "idle" }));
      }, 900);
    }
  }

  /*
  UI
  */
  return (
    <div className="w-full max-w-2xl">
      {/* Section title */}
      <div className="mb-1 text-xl font-semibold">Catalog</div>

      {/* Section helper text */}
      <div className="mb-3 text-sm text-white/70">
        Search the item catalog and add items to your collection.
      </div>

      {/* SEARCH INPUT */}
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search (min 2 chars)..."
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-white/30"
      />

      {/* Hint shown before user starts typing */}
      {!q && (
        <div className="mt-3 text-sm text-white/55">
          Start typing to search the catalog.
        </div>
      )}

      {/* RESULTS SECTION */}
      <div className="mt-3 space-y-3">
        {loading && <div className="px-1 text-sm text-white/70">Searching…</div>}

        {canSearch && !loading && items.length > 0 && (
          <div className="px-1 text-xs text-white/40">{items.length} results</div>
        )}

        {canSearch && !loading && items.length === 0 && (
          <div className="px-1 text-sm text-white/55">No items found.</div>
        )}

        {items.map((item) => {
          const status = statusById[item.id] ?? "idle";
          const disabled = status === "adding" || status === "added";

          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.06]"
            >
              {/* LEFT SIDE
                  Item image + item info
              */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-[10px] text-white/40">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "No Image"
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate font-medium">{item.name}</div>

                  <div className="truncate text-xs text-white/60">
                    {item.game} • {item.set}
                    {item.price != null ? ` • $${item.price.toFixed(2)}` : ""}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE
                  Collection selector + Add button
              */}
              <div className="ml-4 flex shrink-0 items-center gap-2">
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => addToCollection(item)}
                  disabled={disabled}
                  className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {status === "adding"
                    ? "Adding…"
                    : status === "added"
                    ? "Added!"
                    : status === "error"
                    ? "Error"
                    : "Add"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}