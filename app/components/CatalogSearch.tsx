"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CatalogCard = {
  id: string;
  name: string;
  game: string;
  set: string;
  imageUrl: string | null;
  price: number | null;
  rarity: string | null;
  setCode: string | null;
  cardNumber: string | null;
};

type Status = "idle" | "adding" | "added" | "error";

export default function CatalogSearch() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CatalogCard[]>([]);
  const [loading, setLoading] = useState(false);

  // per-card button status
  const [statusById, setStatusById] = useState<Record<string, Status>>({});

  // debounce
  const timer = useRef<any>(null);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

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
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250); // fast debounce
  }, [q, canSearch]);

  async function addToCollection(card: CatalogCard) {
    const ok = window.confirm(`Add "${card.name}" to your collection?`);
    if (!ok) return;

    setStatusById((prev) => ({ ...prev, [card.id]: "adding" }));

    try {
      const res = await fetch("/api/collection/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, quantity: 1 }),
      });

      if (!res.ok) throw new Error("Failed");

      setStatusById((prev) => ({ ...prev, [card.id]: "added" }));

      // ✅ make it turn back faster
      setTimeout(() => {
        setStatusById((prev) => ({ ...prev, [card.id]: "idle" }));
      }, 650);
    } catch {
      setStatusById((prev) => ({ ...prev, [card.id]: "error" }));
      setTimeout(() => {
        setStatusById((prev) => ({ ...prev, [card.id]: "idle" }));
      }, 900);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="text-xl font-semibold mb-1">Catalog</div>
      <div className="text-sm opacity-70 mb-3">
        Search the card catalog and add cards to your collection.
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search (min 2 chars)..."
        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
      />

      <div className="mt-3 space-y-2">
        {loading && (
          <div className="text-sm opacity-70 px-1">Searching…</div>
        )}

        {!loading && canSearch && items.length === 0 && (
          <div className="text-sm opacity-70 px-1">No results.</div>
        )}

        {items.map((card) => {
          const status = statusById[card.id] ?? "idle";
          const disabled = status === "adding" || status === "added";

          return (
            <div
              key={card.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded bg-black/30 border border-white/10 overflow-hidden flex items-center justify-center">
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-[10px] opacity-50">No Img</div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-medium truncate">{card.name}</div>
                  <div className="text-xs opacity-70 truncate">
                    {card.game} • {card.set}
                    {card.price != null ? ` • $${card.price.toFixed(2)}` : ""}
                  </div>
                </div>
              </div>

              <button
                onClick={() => addToCollection(card)}
                disabled={disabled}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10 disabled:opacity-60"
                title="Add to collection"
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
          );
        })}
      </div>
    </div>
  );
}