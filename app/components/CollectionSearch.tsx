"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function CollectionSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // What user is typing
  const [value, setValue] = useState("");

  // Keep input synced with URL (so back/forward works)
  useEffect(() => {
    setValue(sp.get("q") ?? "");
  }, [sp]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  function applySearch(nextValue?: string) {
    const raw = nextValue ?? value;

    // ✅ Allow spaces while typing; only normalize when applying:
    // - collapse multiple spaces
    // - trim edges
    const normalized = raw.replace(/\s+/g, " ").trim();

    const params = new URLSearchParams(sp.toString());

    if (!normalized) params.delete("q");
    else params.set("q", normalized);

    const qs = params.toString();

    // Update URL without scrolling
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    // Keep focus after navigation
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)} // ✅ spaces OK
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applySearch();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setValue("");
              applySearch("");
            }
          }}
          placeholder="Type search… then press Enter"
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
        />

        <button
          type="button"
          onClick={() => applySearch()}
          className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm"
        >
          Search
        </button>
      </div>

      <div className="mt-1 text-xs opacity-60">
        Press <b>Enter</b> to apply. Press <b>Esc</b> to clear.
      </div>
    </div>
  );
}