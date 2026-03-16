"use client";

import { useState } from "react";

/**
 * One price history row
 */
type PriceHistoryEntry = {
  id: string;
  marketPrice: number;
  createdAt: Date | string;
  source?: string | null;
};

type PriceHistoryProps = {
  entries: PriceHistoryEntry[];
};

/**
 * PriceHistory
 *
 * What this does:
 * - Starts collapsed
 * - Lets user click to expand/collapse history
 * - Shows newest prices first
 * - Keeps dashboard cards cleaner
 */
export default function PriceHistory({ entries }: PriceHistoryProps) {
  // Controls whether the history panel is open or closed
  const [open, setOpen] = useState(false);

  // If there is no history, show a simple message
  if (!entries || entries.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/45">
        No price history yet.
      </div>
    );
  }

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-white/70 transition hover:bg-white/5"
      >
        <span className="font-medium">
          {open ? "▲ Hide Price History" : "▼ Show Price History"}
        </span>

        <span className="text-white/40">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </button>

      {/* Expandable history list */}
      {open && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="space-y-2">
            {entries.map((entry) => {
              const formattedDate = new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(entry.createdAt));

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border-b border-white/5 pb-2 text-xs last:border-b-0 last:pb-0"
                >
                  <div className="font-medium text-white/85">
                    ${entry.marketPrice.toFixed(2)}
                  </div>

                  <div className="text-right text-white/45">
                    <div>{formattedDate}</div>
                    {entry.source ? (
                      <div className="text-[10px] uppercase tracking-wide">
                        {entry.source}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}