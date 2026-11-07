
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
- Missing item list
- Search button for each missing item
- Missing value
- Missing item sort dropdown
============================================================
*/

type MissingItem = {
  id: string;
  name: string;
  rarity?: string | null;
  itemNumber?: string | null;
  // null = no provider price saved yet (never a guess)
  price?: number | null;
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
  missingValue: number;
  missingSort: string;
  activeCollectionId: string;
};

/*
Rarity badge color helper

Purpose:
- makes rare and holo cards stand out
- helps users quickly spot important missing cards
*/
function getRarityClasses(rarity?: string | null) {
  const value = rarity?.toLowerCase() ?? "";

  if (value.includes("holo")) {
    return "border-yellow-400/30 bg-yellow-500/10 text-yellow-300";
  }

  if (value.includes("rare")) {
    return "border-blue-400/30 bg-blue-500/10 text-blue-300";
  }

  if (value.includes("uncommon")) {
    return "border-green-400/30 bg-green-500/10 text-green-300";
  }

  return "border-white/10 bg-white/5 text-white/60";
}

/*
Friendly label for active missing sort mode
*/
function getMissingSortLabel(missingSort: string) {
  switch (missingSort) {
    case "price_asc":
      return "Lowest price first";
    case "number_asc":
      return "Card number";
    case "name_asc":
      return "Alphabetical";
    case "rarity_desc":
      return "Rarity";
    case "price_desc":
    default:
      return "Highest value first";
  }
}

export default function SetCompletionCard({
  canShowSetCompletion,
  isMainCollection,
  trackedSetName,
  trackedGameName,
  ownedUniqueSetItems,
  totalItemsInTrackedSet,
  setCompletionPercent,
  missingItems,
  missingValue,
  missingSort,
  activeCollectionId,
}: Props) {
  /*
  Ensure missingValue is always a real number.
  Prevents runtime crashes if undefined sneaks through.
  */
  const safeMissingValue = Number(missingValue ?? 0);

  // Missing items that have no real price yet (excluded from the total)
  const unpricedMissingCount = missingItems.filter((item) => item.price == null).length;

  /*
  Calculate how many unique items are still missing
  */
  const missingCount = Math.max(
    totalItemsInTrackedSet - ownedUniqueSetItems,
    0
  );

  /*
  =========================================
  LIMIT MISSING ITEMS SHOWN (TOP 15)
  -----------------------------------------
  Purpose:
  - Prevent UI overload when sets are large
  - Focus user on most important missing items
  - Keeps rendering fast and clean
  =========================================
  */
  const visibleMissingItems = missingItems.slice(0, 15);
  /*
    =========================================
    COMPLETION MILESTONE MESSAGE HELPER
    -----------------------------------------
    Purpose:
    - Gives feedback based on completion progress
    - Makes UI feel more interactive and rewarding
    =========================================
    */
    function getCompletionMessage(percent: number) {
      if (percent === 100) return "Set fully completed!";
      if (percent >= 75) return "Almost complete!";
      if (percent >= 50) return "Halfway there!";
      if (percent >= 25) return "Good progress!";
      return "Just getting started";
    }
  /*
  CASE 1:
  User is on the main collection.
  Main collection acts like "all collections", so it is not
  a single-set collection for completion tracking.
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
  CASE 2:
  Active collection contains multiple sets or multiple games,
  so meaningful set completion cannot be calculated.
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
  CASE 3:
  Valid set-tracking collection
  Show progress details and full missing item list
  */
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      {/* Header */}
      <div className="text-base font-semibold">Set Completion</div>

      <div className="mt-2 text-sm text-white/60">
        Track progress for this set and quickly search missing items.
      </div>

      {/* Top summary row */}
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm text-white/50">Set</div>
          <div className="text-lg font-semibold">
            {trackedSetName ?? "Unknown Set"}
          </div>
          <div className="text-sm text-white/60">
            {trackedGameName ?? "Unknown Game"}
          </div>
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
            {/*
              =========================================
              COMPLETION STATUS MESSAGE
              -----------------------------------------
              Purpose:
              - Gives user quick emotional feedback
              - Encourages continued collecting
              =========================================
              */}
              <div className="text-xs text-white/50">
                {getCompletionMessage(setCompletionPercent)}
              </div>

            {setCompletionPercent === 100 ? (
              <span className="rounded-full border border-green-400/30 bg-green-400/10 px-2 py-0.5 text-xs text-green-400">
                Complete
              </span>
            ) : (
              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-xs text-blue-300">
                In Progress
              </span>
            )}
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
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
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

        {/*
          =========================================
          ESTIMATED SET COST CARD
          -----------------------------------------
          Purpose:
          - Shows the estimated total value of all missing items
          - Only sums missing items that have a real saved price
          - Clearer than calling it "Missing Value"
          =========================================
          */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">
              Est. Set Cost
            </div>

            <div className="mt-2 text-xl font-semibold text-red-400">
              ${safeMissingValue.toFixed(2)}
            </div>

            <div className="mt-1 text-xs text-white/40">
              {unpricedMissingCount > 0
                ? `Priced cards only (${unpricedMissingCount} without a price yet)`
                : "Estimated total value of missing items"}
            </div>
          </div>
      </div>

      {/* Missing items header + sort control */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium">Missing Items</div>
        {/*
          =========================================
          COLLECTION STRATEGY TIP
          -----------------------------------------
          Purpose:
          - Guides user on what to prioritize
          - Makes app feel intelligent, not just data display
          =========================================
          */}
          <div className="mt-2 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-200">
            Focus on high-value or rare items first to increase your collection value faster.
          </div>

        {/* Missing sort form
            Submits through dashboard query params so sorting stays server-side
        */}
        <form className="flex items-center gap-2" method="GET">
          <input type="hidden" name="missingSort" value="" />
          <label className="text-xs text-white/50" htmlFor="missingSort">
            Sort by
          </label>

          <select
            id="missingSort"
            name="missingSort"
            defaultValue={missingSort}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
          >
            <option value="price_desc">Highest Price</option>
            <option value="price_asc">Lowest Price</option>
            <option value="number_asc">Card Number</option>
            <option value="name_asc">Alphabetical</option>
            <option value="rarity_desc">Rarity</option>
          </select>

          {/* Preserve dashboard state */}
          <button
            type="submit"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
          >
            Apply
          </button>
        </form>
      </div>

      <div className="mt-2 text-xs text-white/45">
        Sorted by importance ({getMissingSortLabel(missingSort)})
      </div>
      
  

            {/* Missing items list */}
      <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
        {missingItems.length === 0 ? (
          <div className="rounded-lg border border-green-400/20 bg-green-400/10 px-3 py-3 text-sm text-green-300">
            No missing items found — this set may be complete.
          </div>
        ) : (
          visibleMissingItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm"
            >
              {/* Left side: name + metadata */}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.name}</div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-white/50">
                    #{item.itemNumber ?? "?"}
                  </span>

                  <span
                    className={`rounded-full border px-2 py-0.5 ${getRarityClasses(
                      item.rarity
                    )}`}
                  >
                    {item.rarity ?? "Unknown"}
                  </span>
                </div>
              </div>

              {/* Right side: price + search */}
              <div className="flex shrink-0 items-center gap-3">
                {item.price != null ? (
                  <span className="text-sm font-semibold text-yellow-300">
                    ${item.price.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-xs text-white/40">No price yet</span>
                )}

                {/*
                  =========================================
                  MISSING ITEM CATALOG SHORTCUT
                  -----------------------------------------
                  Purpose:
                  - Sends the user back to the dashboard catalog tools
                  - Pre-fills the catalog search with this missing item's name
                  - Keeps the current collection selected using cid
                  - Makes the action clearer than a generic "Search" label
                  =========================================
                  */}
                  <a
                    href={`/dashboard?cid=${encodeURIComponent(
                      activeCollectionId
                    )}&catalog=${encodeURIComponent(item.name)}#collection-tools`}
                    className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300 transition hover:bg-blue-500/20"
                  >
                    Find in Catalog
                  </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/*
      =========================================
      SHOW MESSAGE IF LIST IS TRUNCATED
      -----------------------------------------
      Purpose:
      - Let user know only top items are shown
      - Reinforces importance-based sorting
      =========================================
      */}
      {missingItems.length > 15 && (
        <div className="mt-2 text-center text-xs text-white/50">
          Showing top 15 most important missing items
        </div>
      )}
          </div>
  );
}