/*
============================================================
SET COMPLETION CARD
------------------------------------------------------------
Purpose:
- Shows how close the current collection is to completing a set
- Only works when the collection contains one game + one set
- Helps collectors track progress and missing items
- Adds quick search shortcuts for missing items

What this component displays:
- Set name
- Game name
- Owned count
- Total items in set
- Missing count
- Completion percent
- Missing item preview
- Search button for each missing item
============================================================
*/

type MissingItem = {
  id: string;
  name: string;
};

type Props = {
  canShowSetCompletion: boolean;
  isMainCollection: boolean;
  trackedSetName: string | null;
  trackedGameName: string | null;
  ownedUniqueSetItems: number;
  totalItemsInTrackedSet: number;
  setCompletionPercent: number;
  missingItems: MissingItem[];
};

export default function SetCompletionCard({
  canShowSetCompletion,
  isMainCollection,
  trackedSetName,
  trackedGameName,
  ownedUniqueSetItems,
  totalItemsInTrackedSet,
  setCompletionPercent,
  missingItems,
}: Props) {
  /*
  ------------------------------------------------------------
  Calculate how many unique items are still missing
  ------------------------------------------------------------
  */
  const missingCount = Math.max(
    totalItemsInTrackedSet - ownedUniqueSetItems,
    0
  );

  /*
  ------------------------------------------------------------
  CASE 1:
  User is on the main collection.
  Main collection acts like "all collections", so it is not
  a single-set collection for completion tracking.
  ------------------------------------------------------------
  */
  if (isMainCollection) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="text-base font-semibold">Set Completion</div>
        <div className="mt-2 text-sm text-white/60">
          Select a specific collection to track completion for one set.
        </div>
      </div>
    );
  }

  /*
  ------------------------------------------------------------
  CASE 2:
  Active collection contains multiple sets or multiple games,
  so meaningful set completion cannot be calculated.
  ------------------------------------------------------------
  */
  if (!canShowSetCompletion) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="text-base font-semibold">Set Completion</div>
        <div className="mt-2 text-sm text-white/60">
          Completion tracking works best when a collection contains items from
          one set and one game.
        </div>
      </div>
    );
  }

  /*
  ------------------------------------------------------------
  CASE 3:
  Valid set-tracking collection
  Show progress details and missing item preview
  ------------------------------------------------------------
  */
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      {/* Header */}
      <div className="text-base font-semibold">Set Completion</div>

      <div className="mt-1 text-sm text-white/60">
        Track progress for this set
      </div>

      {/* Top summary row */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm text-white/50">Set</div>
          <div className="text-lg font-semibold">{trackedSetName}</div>
          <div className="text-sm text-white/60">{trackedGameName}</div>
        </div>

        <div className="text-left lg:text-right">
          <div className="text-sm text-white/50">Progress</div>
          <div className="text-3xl font-bold">
            {ownedUniqueSetItems} / {totalItemsInTrackedSet}
          </div>

          <div className="mt-1 flex items-center justify-start gap-2 lg:justify-end">
            <span className="text-sm text-white/60">
              {setCompletionPercent}% complete
            </span>

            {setCompletionPercent === 100 ? (
              <span className="rounded-full border border-green-400/30 bg-green-400/10 px-2 py-0.5 text-xs text-green-400">
                Complete
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5">
        <div className="h-4 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={
              setCompletionPercent === 100
                ? "h-full rounded-full bg-green-400 transition-all"
                : "h-full rounded-full bg-blue-400 transition-all"
            }
            style={{ width: `${setCompletionPercent}%` }}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-white/45">
            Owned
          </div>
          <div className="mt-2 text-xl font-semibold">
            {ownedUniqueSetItems}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-white/45">
            Total In Set
          </div>
          <div className="mt-2 text-xl font-semibold">
            {totalItemsInTrackedSet}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-white/45">
            Missing
          </div>
          <div className="mt-2 text-xl font-semibold">{missingCount}</div>
        </div>
      </div>

      {/* Missing items preview */}
      <div className="mt-5">
        <div className="text-sm font-medium">Missing Items</div>

        <div className="mt-3 space-y-2">
          {missingItems.length === 0 ? (
            <div className="rounded-lg border border-green-400/20 bg-green-400/10 px-3 py-3 text-sm text-green-300">
              No missing items found — this set may be complete.
            </div>
          ) : (
            missingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              >
                {/* Missing item name */}
                <span className="truncate">{item.name}</span>

                {/* Quick search shortcut
                    Sends the user back to the dashboard with
                    the search query already filled in */}
                <a
                  href={`/dashboard?catalog=${encodeURIComponent(item.name)}#collection-tools`}
                  className="shrink-0 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/20"
                >
                  Search
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}