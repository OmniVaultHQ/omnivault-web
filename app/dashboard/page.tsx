import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getOrCreateDefaultCollection } from "@/lib/collections";

import AddItemForm from "@/app/components/AddItemForm";
import CatalogSearch from "@/app/components/CatalogSearch";
import SubmitButton from "@/app/components/Submitbutton";
import PortfolioChart from "@/app/components/Portfoliochart";

import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Always run this page on the server so the dashboard stays fresh
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * searchParams can come in different shapes depending on Next.js version.
 * This keeps TypeScript happy and avoids weird runtime issues.
 */
type SearchParamsMaybePromise =
  | {
      q?: string | string[];
      cat?: string | string[];
      cid?: string | string[];
      sort?: string | string[];
      view?: string | string[]; // NEW: lets us switch between list and grid using the URL
    }
  | Promise<
      | {
          q?: string | string[];
          cat?: string | string[];
          cid?: string | string[];
          sort?: string | string[];
          view?: string | string[];
        }
      | undefined
    >
  | undefined;

/**
 * Convert query params into a plain string.
 * Handles:
 * - undefined
 * - string
 * - string[]
 */
function normalizeStr(v: unknown) {
  if (!v) return "";
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v);
}

/**
 * Prisma helper type:
 * A collection item plus:
 * - its linked item
 * - newest price record for that item
 */
type CollectionItemWithItem = Prisma.CollectionItemGetPayload<{
  include: {
    item: {
      include: {
        prices: true;
      };
    };
  };
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParamsMaybePromise;
}) {
  // ==================================================
  // AUTH
  // ==================================================
  // User must be logged in to view the dashboard
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // ==================================================
  // QUERY PARAMS
  // ==================================================
  // Some Next.js versions hand searchParams in as a Promise
  const sp: any =
    searchParams && typeof (searchParams as any).then === "function"
      ? await (searchParams as any)
      : searchParams ?? {};

  const q = normalizeStr(sp?.q).trim();
  const cat = normalizeStr(sp?.cat).trim();
  const cid = normalizeStr(sp?.cid).trim();
  const sort = normalizeStr(sp?.sort).trim();

  /**
   * NEW:
   * We store the current collection display mode in the URL.
   * That means no client component/useState is needed.
   *
   * /dashboard?view=list
   * /dashboard?view=grid
   */
  const view = normalizeStr(sp?.view).trim().toLowerCase();
  const currentView = view === "grid" ? "grid" : "list";

  // ==================================================
  // COLLECTIONS
  // ==================================================
  // Make sure the user always has at least one collection
  const defaultCollection = await getOrCreateDefaultCollection(userId);

  // Load all user collections for the dropdown and forms
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  // Use the collection from the URL if it belongs to the user
  // Otherwise fall back to the default collection
  const activeCollectionId =
    collections.some((c) => c.id === cid) ? cid : defaultCollection.id;

  /**
   * If the active collection is the default collection,
   * treat it as the special "Main / All Collections" view.
   */
  const isMainCollection = activeCollectionId === defaultCollection.id;

  // ==================================================
  // SERVER ACTIONS
  // ==================================================

  /**
   * Logout action
   */
  async function logout() {
    "use server";
    redirect("/api/auth/signout");
  }

  /**
   * Create a new collection and redirect to it
   */
  async function createCollection(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;

    const created = await prisma.collection.create({
      data: {
        userId,
        name,
      },
    });

    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${created.id}&view=${currentView}`);
  }

  /**
   * Switch active collection by updating the URL
   */
  async function switchCollection(formData: FormData) {
    "use server";

    const next = String(formData.get("cid") ?? "").trim();
    if (!next) redirect(`/dashboard?view=${currentView}`);

    redirect(`/dashboard?cid=${next}&view=${currentView}`);
  }

  /**
   * Add a custom item to a collection
   *
   * Flow:
   * 1. Read form fields
   * 2. Save uploaded image if provided
   * 3. Reuse or create the custom item
   * 4. Add/increment the collection item
   */
  async function addItem(formData: FormData) {
    "use server";

    const selectedCollectionId = String(
      formData.get("collectionId") ?? ""
    ).trim();
    const gameRaw = String(formData.get("game") ?? "").trim();
    const setRaw = String(formData.get("set") ?? "").trim();
    const nameRaw = String(formData.get("name") ?? "").trim();
    const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();
    const imageFile = formData.get("imageFile") as File | null;
    const qtyRaw = Number(formData.get("quantity") ?? 1);

    const game = gameRaw.toLowerCase();
    const set = setRaw.toLowerCase();
    const name = nameRaw;

    const quantity = Number.isFinite(qtyRaw) ? Math.max(1, qtyRaw) : 1;

    if (!game || !set || !name || !selectedCollectionId) return;

    /**
     * finalImageUrl will hold either:
     * - uploaded image path
     * - manually entered image URL
     */
    let finalImageUrl: string | null = imageUrlRaw || null;

    // Save uploaded image to /public/uploads
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });

      const safeFileName = `${Date.now()}-${imageFile.name.replace(
        /\s+/g,
        "-"
      )}`;

      const filePath = path.join(uploadsDir, safeFileName);
      await writeFile(filePath, buffer);

      finalImageUrl = `/uploads/${safeFileName}`;
    }

    // Reuse existing custom item if possible
    let item = await prisma.item.findFirst({
      where: {
        name,
        set,
        game,
        createdByUserId: userId,
        isCustom: true,
      },
    });

    // If item exists but had no image, update it
    if (item) {
      if (finalImageUrl && !item.imageUrl) {
        item = await prisma.item.update({
          where: { id: item.id },
          data: {
            imageUrl: finalImageUrl,
          },
        });
      }
    } else {
      // Otherwise create a brand-new custom item
      item = await prisma.item.create({
        data: {
          name,
          set,
          game,
          imageUrl: finalImageUrl,
          isCustom: true,
          createdByUserId: userId,
        },
      });
    }

    // Add item to collection, or increment quantity if already there
    await prisma.collectionItem.upsert({
      where: {
        collectionId_itemId: {
          collectionId: selectedCollectionId,
          itemId: item.id,
        },
      },
      create: {
        userId,
        collectionId: selectedCollectionId,
        itemId: item.id,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    });

    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${selectedCollectionId}&view=${currentView}`);
  }

  /**
   * Increase quantity by 1
   */
  async function incQty(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    await prisma.collectionItem.update({
      where: { id },
      data: { quantity: { increment: 1 } },
    });

    revalidatePath("/dashboard");
  }

  /**
   * Decrease quantity by 1
   * If quantity would go below 1, delete the item instead
   */
  async function decQty(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const item = await prisma.collectionItem.findUnique({
      where: { id },
      select: { quantity: true },
    });

    if (!item) return;

    if (item.quantity <= 1) {
      await prisma.collectionItem.delete({
        where: { id },
      });
    } else {
      await prisma.collectionItem.update({
        where: { id },
        data: { quantity: { decrement: 1 } },
      });
    }

    revalidatePath("/dashboard");
  }

  /**
   * Delete a collection item completely
   */
  async function deleteItem(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    await prisma.collectionItem.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
  }
  /**
 * Update quantity directly
 * Allows user to type a number instead of clicking +1/-1
 */
async function updateQuantity(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  const raw = Number(formData.get("quantity") ?? 1);

  if (!id) return;

  const quantity = Number.isFinite(raw) ? Math.max(1, raw) : 1;

  await prisma.collectionItem.update({
    where: { id },
    data: { quantity },
  });

  revalidatePath("/dashboard");
}

  /**
   * Save or clear purchase price
   * This is the user's personal cost basis
   */
  async function savePurchasePrice(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const raw = String(formData.get("purchasePrice") ?? "").trim();

    if (!id) return;

    const purchasePrice = raw === "" ? null : Number(raw);

    await prisma.collectionItem.update({
      where: { id },
      data: {
        purchasePrice: Number.isFinite(purchasePrice as number)
          ? purchasePrice
          : null,
      },
    });

    revalidatePath("/dashboard");
  }

  /**
   * Save or clear manual market price
   * Useful for:
   * - custom items
   * - manual overrides
   * - cards not in shared pricing yet
   */
  async function saveMarketPrice(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    const raw = String(formData.get("marketPrice") ?? "").trim();

    if (!id) return;

    const marketPrice = raw === "" ? null : Number(raw);

    await prisma.collectionItem.update({
      where: { id },
      data: {
        marketPrice: Number.isFinite(marketPrice as number)
          ? marketPrice
          : null,
      },
    });

    revalidatePath("/dashboard");
  }

  // ==================================================
  // LOAD DASHBOARD DATA
  // ==================================================

  /**
   * Load collection items
   *
   * If Main is active:
   * - show all user items across all collections
   *
   * Otherwise:
   * - only show items from the selected collection
   */
  const items: CollectionItemWithItem[] = await prisma.collectionItem.findMany({
    where: isMainCollection ? { userId } : { collectionId: activeCollectionId },
    orderBy: { id: "desc" },
    include: {
      item: {
        include: {
          prices: {
            orderBy: { lastUpdated: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  // ==================================================
  // PRICE HELPERS
  // ==================================================

  /**
   * Helper: latest shared catalog market price for the item
   */
  function getCatalogMarketPrice(item: CollectionItemWithItem) {
    return item.item.prices?.[0]?.marketPrice ?? null;
  }

  /**
   * Helper: manual market price stored on the user's collection item
   * This is the per-user override.
   */
  function getManualMarketPrice(item: CollectionItemWithItem) {
    return (item as any).marketPrice ?? null;
  }

  /**
   * Helper: what the user originally paid
   */
  function getPurchasePrice(item: CollectionItemWithItem) {
    return (item as any).purchasePrice ?? null;
  }

  /**
   * Helper:
   * Decide which value OmniVault should use as the "current market value".
   *
   * Priority:
   * 1. manual market price override on the collection item
   * 2. shared catalog market price on the item
   * 3. purchase price fallback
   * 4. zero
   *
   * This makes ALL calculations match the row display.
   */
  function getEffectiveMarketPrice(item: CollectionItemWithItem) {
    const manual = getManualMarketPrice(item);
    const catalog = getCatalogMarketPrice(item);
    const purchase = getPurchasePrice(item);

    return manual ?? catalog ?? purchase ?? 0;
  }

  /**
   * Helper:
   * Total current value for one collection row
   */
  function getRowMarketTotal(item: CollectionItemWithItem) {
    return getEffectiveMarketPrice(item) * item.quantity;
  }

  /**
   * Helper:
   * Total amount the user paid for one collection row
   */
  function getRowPurchaseTotal(item: CollectionItemWithItem) {
    return (getPurchasePrice(item) ?? 0) * item.quantity;
  }

  /**
   * Helper:
   * Profit/loss for one collection row
   */
  function getRowProfitLoss(item: CollectionItemWithItem) {
    const purchase = getPurchasePrice(item);
    if (purchase == null) return null;

    return getRowMarketTotal(item) - getRowPurchaseTotal(item);
  }

  /**
   * Build category filter options from the current item list
   */
  const categories = Array.from(
    new Set(items.map((i) => i.item?.game).filter(Boolean))
  ).sort();

  /**
   * Apply category + search filtering
   */
  const filtered = items.filter((i) => {
    if (cat && i.item.game !== cat) return false;
    if (!q) return true;

    const hay = `${i.item.name} ${i.item.set} ${i.item.game}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  /**
   * Sort collection items
   *
   * FIX:
   * This now uses the same effective market price logic as the row UI.
   * That keeps sorting consistent with what the user sees.
   */
  const sorted = [...filtered].sort((a, b) => {
    const aTotalValue = getRowMarketTotal(a);
    const bTotalValue = getRowMarketTotal(b);

    switch (sort) {
      case "value_desc":
        return bTotalValue - aTotalValue;
      case "value_asc":
        return aTotalValue - bTotalValue;
      case "name_asc":
        return a.item.name.localeCompare(b.item.name);
      case "name_desc":
        return b.item.name.localeCompare(a.item.name);
      case "qty_desc":
        return b.quantity - a.quantity;
      case "qty_asc":
        return a.quantity - b.quantity;
      case "oldest":
        return a.id.localeCompare(b.id);
      case "newest":
      default:
        return b.id.localeCompare(a.id);
    }
  });

  // ==================================================
  // DASHBOARD STATS
  // ==================================================

  // Number of unique rows/items
  const totalUnique = items.length;

  // Total quantity owned across all rows
  const totalOwned = items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);

  /**
   * Collection value:
   * Uses the same effective market logic as row items
   */
  const collectionValue = items.reduce((sum, i) => {
    return sum + getRowMarketTotal(i);
  }, 0);

  /**
   * Cost basis:
   * What the user actually paid
   */
  const costBasis = items.reduce((sum, i) => {
    return sum + getRowPurchaseTotal(i);
  }, 0);

  /**
   * Portfolio profit/loss:
   * Current value - cost basis
   */
  const totalProfitLoss = collectionValue - costBasis;

  /**
   * Most valuable single item in this view
   */
  const mostValuableItem =
    items.length === 0
      ? null
      : items.reduce((best, item) => {
          const totalValue = getRowMarketTotal(item);

          if (!best) {
            return {
              name: item.item.name,
              totalValue,
            };
          }

          return totalValue > best.totalValue
            ? {
                name: item.item.name,
                totalValue,
              }
            : best;
        }, null as { name: string; totalValue: number } | null);

  /**
   * Top 5 most valuable items
   */
  const topValuableItems = [...items]
    .map((item) => {
      const displayPrice = getEffectiveMarketPrice(item);
      const totalValue = getRowMarketTotal(item);

      return {
        id: item.id,
        name: item.item.name,
        quantity: item.quantity,
        displayPrice,
        totalValue,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  // ==================================================
  // PORTFOLIO CHART DATA
  // ==================================================
  // Temporary demo data for now
  const chartLabels = ["Jan", "Feb", "Mar", "Apr", "May"];
  const chartValues = [120, 340, 500, 620, collectionValue];

  // ==================================================
  // PRICE CHANGE LEADERBOARD
  // ==================================================
  // Demo logic for now using fake previous price
  const priceChanges = items.map((item) => {
    const currentPrice = getEffectiveMarketPrice(item);

    // Fake previous price for now
    const previousPrice = currentPrice * 0.9;

    const change = currentPrice - previousPrice;

    return {
      id: item.id,
      name: item.item.name,
      change,
    };
  });

  const topGainers = [...priceChanges]
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);

  const topLosers = [...priceChanges]
    .sort((a, b) => a.change - b.change)
    .slice(0, 5);

  // ==================================================
  // SET COMPLETION TRACKING
  // ==================================================
  //
  // This first version only works when:
  // 1. The user is NOT viewing Main (All Collections)
  // 2. The active collection contains cards from exactly ONE set
  // 3. The active collection contains cards from exactly ONE game
  //
  // If the collection mixes multiple sets, we do not try to guess.

  // Get all unique set names in the current collection
  const uniqueSetsInCollection = Array.from(
    new Set(items.map((item) => item.item.set).filter(Boolean))
  );

  // Get all unique game names in the current collection
  const uniqueGamesInCollection = Array.from(
    new Set(items.map((item) => item.item.game).filter(Boolean))
  );

  // Only track completion when:
  // - not Main collection
  // - exactly one set
  // - exactly one game
  const canShowSetCompletion =
    !isMainCollection &&
    uniqueSetsInCollection.length === 1 &&
    uniqueGamesInCollection.length === 1;

  // The set/game we are tracking
  const trackedSetName = canShowSetCompletion ? uniqueSetsInCollection[0] : null;
  const trackedGameName = canShowSetCompletion
    ? uniqueGamesInCollection[0]
    : null;

  // Count how many UNIQUE items the user owns in this set
  const ownedUniqueSetItems = canShowSetCompletion
    ? new Set(
        items
          .filter(
            (item) =>
              item.item.set === trackedSetName &&
              item.item.game === trackedGameName
          )
          .map((item) => item.item.id)
      ).size
    : 0;

  // Build list of owned card IDs so we can find missing ones
  const ownedTrackedItemIds =
    canShowSetCompletion && trackedSetName && trackedGameName
      ? Array.from(
          new Set(
            items
              .filter(
                (item) =>
                  item.item.set === trackedSetName &&
                  item.item.game === trackedGameName
              )
              .map((item) => item.item.id)
          )
        )
      : [];

  // Count how many total cards exist in this set in the catalog
  const totalItemsInTrackedSet =
    canShowSetCompletion && trackedSetName && trackedGameName
      ? await prisma.item.count({
          where: {
            set: trackedSetName,
            game: trackedGameName,
          },
        })
      : 0;

  // Completion percentage
  const setCompletionPercent =
    totalItemsInTrackedSet > 0
      ? Math.round((ownedUniqueSetItems / totalItemsInTrackedSet) * 100)
      : 0;

  // Find a few missing items from the catalog
  const missingItems =
    canShowSetCompletion && trackedSetName && trackedGameName
      ? await prisma.item.findMany({
          where: {
            set: trackedSetName,
            game: trackedGameName,
            id: {
              notIn:
                ownedTrackedItemIds.length > 0
                  ? ownedTrackedItemIds
                  : ["__none__"],
            },
          },
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
          take: 5,
        })
      : [];

  // ==================================================
  // UI
  // ==================================================
  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-6 xl:px-8">
      {/* Main dashboard card/container */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-xl sm:p-8">
        {/* =========================================
            HEADER
           ========================================= */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <div className="mt-1 text-sm text-white/60">
              {session?.user?.email ?? ""}
            </div>
          </div>

          {/* Main logout button inside dashboard card */}
          <form action={logout}>
            <SubmitButton className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
              Logout
            </SubmitButton>
          </form>
        </div>

        {/* =========================================
            COLLECTION CONTROLS
           ========================================= */}
        <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            {/* Switch active collection */}
            <form
              action={switchCollection}
              className="flex flex-wrap items-center gap-2"
            >
              <div className="text-sm text-white/60">Collection:</div>

              <select
                name="cid"
                defaultValue={activeCollectionId}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <SubmitButton className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">
                Open
              </SubmitButton>
            </form>

            {/* Create new collection */}
            <form
              action={createCollection}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input
                name="name"
                placeholder="New collection name"
                className="w-[220px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
              />
              <SubmitButton className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">
                Create
              </SubmitButton>
            </form>
          </div>

          {/* Active collection label */}
          <div className="text-sm text-white/60">
            Active:{" "}
            {isMainCollection
              ? "Main (All Collections)"
              : collections.find((c) => c.id === activeCollectionId)?.name ??
                "Main"}
          </div>
        </div>

        {/* =========================================
            CATALOG SEARCH
           ========================================= */}
        <div className="mt-8">
          <CatalogSearch
            collections={collections}
            activeCollectionId={activeCollectionId}
          />
        </div>

        {/* =========================================
            MANUAL ADD CARD FORM
           ========================================= */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Add Item</h2>
          <div className="mt-3">
            <AddItemForm
              action={addItem}
              collections={collections}
              activeCollectionId={activeCollectionId}
            />
          </div>
        </div>

        {/* =========================================
            SUMMARY / VAULT STATS
           ========================================= */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-white/60">
              Total Unique Items
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              {totalUnique}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-white/60">
              Total Items Owned
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              {totalOwned}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-white/60">
              Collection Value
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              ${collectionValue.toFixed(2)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-white/60">
              Cost Basis
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              ${costBasis.toFixed(2)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-white/60">
              Profit / Loss
            </div>
            <div
              className={
                totalProfitLoss > 0
                  ? "mt-2 text-3xl font-bold tracking-tight text-green-400"
                  : totalProfitLoss < 0
                  ? "mt-2 text-3xl font-bold tracking-tight text-red-400"
                  : "mt-2 text-3xl font-bold tracking-tight"
              }
            >
              {totalProfitLoss >= 0 ? "+" : ""}
              ${totalProfitLoss.toFixed(2)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-white/60">
              Most Valuable Item
            </div>
            <div className="mt-2 line-clamp-2 text-sm font-semibold">
              {mostValuableItem?.name ?? "—"}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              ${mostValuableItem?.totalValue.toFixed(2) ?? "0.00"}
            </div>
          </div>
        </div>

        {/* =========================================
            PORTFOLIO VALUE CHART
           ========================================= */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="text-base font-semibold">Portfolio Value</div>

          <div className="mt-1 text-sm text-white/60">
            Track how your collection value grows over time
          </div>

          <div className="mt-6">
            <PortfolioChart labels={chartLabels} values={chartValues} />
          </div>
        </div>

        {/* =========================================
            SET COMPLETION TRACKER
           ========================================= */}
        {canShowSetCompletion ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-base font-semibold">Set Completion</div>

            <div className="mt-1 text-sm text-white/60">
              Track progress for this set
            </div>

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

            <div className="mt-5">
              <div className="text-sm font-medium">Missing Items</div>

              <div className="mt-3 space-y-2">
                {missingItems.length === 0 ? (
                  <div className="text-sm text-white/60">
                    No missing items found — this set may be complete.
                  </div>
                ) : (
                  missingItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                    >
                      {item.name}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : !isMainCollection ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-base font-semibold">Set Completion</div>
            <div className="mt-2 text-sm text-white/60">
              Completion tracking works best when a collection contains cards
              from one set and one game.
            </div>
          </div>
        ) : null}

        {/* =========================================
            CARD PRICE MOVERS
           ========================================= */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-base font-semibold">Top Gainers</div>

            <div className="mt-4 space-y-2">
              {topGainers.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2"
                >
                  <div>
                    #{i + 1} {c.name}
                  </div>

                  <div className="font-medium text-green-400">
                    +${c.change.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-base font-semibold">Top Losers</div>

            <div className="mt-4 space-y-2">
              {topLosers.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2"
                >
                  <div>
                    #{i + 1} {c.name}
                  </div>

                  <div className="font-medium text-red-400">
                    ${c.change.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =========================================
            TOP 5 MOST VALUABLE CARDS
           ========================================= */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-base font-semibold">Top 5 Most Valuable Items</div>
          <div className="mt-1 text-sm text-white/55">
            Highest-value items in this collection
          </div>

          <div className="mt-4 space-y-3">
            {topValuableItems.length === 0 ? (
              <div className="text-sm text-white/60">No items to rank yet.</div>
            ) : (
              topValuableItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      #{index + 1} {item.name}
                    </div>
                    <div className="text-xs text-white/55">
                      Qty: {item.quantity} • ${item.displayPrice.toFixed(2)} each
                    </div>
                  </div>

                  <div className="text-sm font-semibold">
                    ${item.totalValue.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* =========================================
            FILTERS / SORT / SEARCH
           ========================================= */}
        <div className="mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold">Your Collection</h2>

            {/* =========================================
                  VIEW TOGGLE (LIST / GRID)
                  This switches between list view and grid view
                  by updating the URL query parameter: ?view=list or ?view=grid
                ========================================= */}

              <div className="flex items-center gap-2">
                
                {/* LIST VIEW BUTTON */}
                {/* When clicked it reloads dashboard with view=list */}
                <form method="GET">
                  {/* keep the current collection */}
                  <input type="hidden" name="cid" value={activeCollectionId} />

                  {/* keep category filter if active */}
                  {cat ? <input type="hidden" name="cat" value={cat} /> : null}

                  {/* keep sorting if active */}
                  {sort ? <input type="hidden" name="sort" value={sort} /> : null}

                  {/* keep search query if active */}
                  {q ? <input type="hidden" name="q" value={q} /> : null}

                  {/* change view to list */}
                  <input type="hidden" name="view" value="list" />

                  <SubmitButton
                    className={
                      currentView === "list"
                        ? "rounded-xl border border-blue-400/40 bg-blue-400/15 px-4 py-2 text-sm text-blue-300"
                        : "rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                    }
                  >
                    List View
                  </SubmitButton>
                </form>

                {/* GRID VIEW BUTTON */}
                {/* When clicked it reloads dashboard with view=grid */}
                <form method="GET">
                  {/* keep the current collection */}
                  <input type="hidden" name="cid" value={activeCollectionId} />

                  {/* keep category filter if active */}
                  {cat ? <input type="hidden" name="cat" value={cat} /> : null}

                  {/* keep sorting if active */}
                  {sort ? <input type="hidden" name="sort" value={sort} /> : null}

                  {/* keep search query if active */}
                  {q ? <input type="hidden" name="q" value={q} /> : null}

                  {/* change view to grid */}
                  <input type="hidden" name="view" value="grid" />

                  <SubmitButton
                    className={
                      currentView === "grid"
                        ? "rounded-xl border border-blue-400/40 bg-blue-400/15 px-4 py-2 text-sm text-blue-300"
                        : "rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                    }
                  >
                    Grid View
                  </SubmitButton>
                </form>

              </div>
          </div>

          {/* FILTER / SORT / SEARCH / VIEW CONTROLS */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {/* Left side: category filter */}
            <form className="flex flex-wrap items-center gap-3" method="GET">
              <input type="hidden" name="cid" value={activeCollectionId} />
              <input type="hidden" name="view" value={currentView} />
              {sort ? <input type="hidden" name="sort" value={sort} /> : null}
              {q ? <input type="hidden" name="q" value={q} /> : null}

              <select
                name="cat"
                defaultValue={cat || ""}
                className="min-w-[220px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <SubmitButton className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
                Filter
              </SubmitButton>
            </form>

            {/* Right side: sort + search */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Sort form */}
              <form className="flex flex-wrap gap-2" method="GET">
                <input type="hidden" name="cid" value={activeCollectionId} />
                <input type="hidden" name="view" value={currentView} />
                {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                {q ? <input type="hidden" name="q" value={q} /> : null}

                <select
                  name="sort"
                  defaultValue={sort || "newest"}
                  className="min-w-[220px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                >
                  <option value="newest">Sort: Recently Added</option>
                  <option value="oldest">Sort: Oldest Added</option>
                  <option value="value_desc">Sort: Value High to Low</option>
                  <option value="value_asc">Sort: Value Low to High</option>
                  <option value="name_asc">Sort: Name A–Z</option>
                  <option value="name_desc">Sort: Name Z–A</option>
                  <option value="qty_desc">Sort: Quantity High to Low</option>
                  <option value="qty_asc">Sort: Quantity Low to High</option>
                </select>

                <SubmitButton className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
                  Sort
                </SubmitButton>
              </form>

              {/* Search form */}
              <form className="flex items-center gap-2" method="GET">
                <input type="hidden" name="cid" value={activeCollectionId} />
                <input type="hidden" name="view" value={currentView} />
                {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                {sort ? <input type="hidden" name="sort" value={sort} /> : null}

                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Type search... then press Enter"
                  className="min-w-[280px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                />

                <SubmitButton className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
                  Search
                </SubmitButton>
              </form>
            </div>
          </div>

          <div className="mt-2 text-xs text-white/45">
            Press Enter to apply. Use clear to reset.
          </div>

          {/* =========================================
              COLLECTION ITEM DISPLAY
              - List view keeps the current row layout
              - Grid view adds a more visual collector layout
             ========================================= */}
          <div className="mt-5">
            {sorted.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-sm text-white/60">
                No items match your filters.
              </div>
            ) : currentView === "list" ? (
              <div className="space-y-4">
                {sorted.map((i) => {
                  const item = i.item;

                  // Prices used in the row UI
                  const effectiveMarketPrice = getEffectiveMarketPrice(i);
                  const marketTotal = getRowMarketTotal(i);
                  const purchaseTotal = getRowPurchaseTotal(i);
                  const rowProfitLoss = getRowProfitLoss(i);

                  return (
                    <div
                      key={i.id}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.06] lg:flex-row lg:items-start lg:justify-between"
                    >
                      {/* LEFT SIDE
                          Item image + name + set information */}
                      <div className="flex items-center gap-4">
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
                            <span className="ml-2 text-white/60">
                              x {i.quantity}
                            </span>
                          </div>

                          <div className="mt-1 text-xs text-white/60">
                            {item.game} • {item.set}

                            {item.isCustom && (
                              <span className="ml-2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                                Custom
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT SIDE
                          value summary + editing tools */}
                      <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[540px]">
                        {/* Value summary panel */}
                        <div className="flex justify-end">
                          <div className="min-w-[180px] rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-xs leading-tight">
                            <div className="text-white/55">
                              Cost: ${purchaseTotal.toFixed(2)}
                            </div>

                            <div className="font-medium text-white/85">
                              Value: ${marketTotal.toFixed(2)}
                            </div>

                            <div
                              className={
                                rowProfitLoss == null
                                  ? "text-white/35"
                                  : rowProfitLoss > 0
                                  ? "text-green-400"
                                  : rowProfitLoss < 0
                                  ? "text-red-400"
                                  : "text-white/55"
                              }
                            >
                              Profit/Loss:{" "}
                              {rowProfitLoss == null
                                ? "—"
                                : `${rowProfitLoss >= 0 ? "+" : ""}$${rowProfitLoss.toFixed(2)}`}
                            </div>
                          </div>
                        </div>

                        {/* Editor controls */}
                          <div className="flex flex-col gap-3">

                            

                            {/* Editable fields for this row */}
                            <div className="grid grid-cols-3 gap-3">

                              {/* Purchase price input */}
                              <div>
                                <div className="mb-1 text-xs text-white/60">Purchase</div>
                                <form action={savePurchasePrice} className="flex items-center gap-2">
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

                              {/* Market price input */}
                              <div>
                                <div className="mb-1 text-xs text-white/60">Market</div>
                                <form action={saveMarketPrice} className="flex items-center gap-2">
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

                              {/* Quantity input */}
                              <div>
                                <div className="mb-1 text-xs text-white/60">Qty</div>
                                <form action={updateQuantity} className="flex items-center gap-2">
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

                            {/* Delete button */}
                            <form action={deleteItem}>
                              <input type="hidden" name="id" value={i.id} />
                              <SubmitButton className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs hover:bg-red-500/20">
                                Delete
                              </SubmitButton>
                            </form>

                          </div>

                        {/* Small helper note so the user knows what value is being used */}
                        <div className="ml-auto text-right text-[11px] text-white/40">
                          Market used: ${effectiveMarketPrice.toFixed(2)} each
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /**
               * GRID VIEW
               *
               * This is the new visual "collector" view.
               * It shows items like a gallery/binder instead of data rows.
               */
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {sorted.map((i) => {
                  const item = i.item;

                  const effectiveMarketPrice = getEffectiveMarketPrice(i);
                  const marketTotal = getRowMarketTotal(i);
                  const purchaseTotal = getRowPurchaseTotal(i);
                  const rowProfitLoss = getRowProfitLoss(i);

                  return (
                    <div
                      key={i.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.06]"
                    >
                      {/* Item image area */}
                      <div className="aspect-[3/4] w-full overflow-hidden border-b border-white/10 bg-black/30">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
                            No Image
                          </div>
                        )}
                      </div>

                      {/* Item details */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold">
                              {item.name}
                            </div>
                            <div className="mt-1 text-xs text-white/60">
                              {item.game} • {item.set}
                            </div>
                          </div>

                          <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/70">
                            x{i.quantity}
                          </div>
                        </div>

                        {item.isCustom && (
                          <div className="mt-2 inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                            Custom
                          </div>
                        )}

                        {/* Value summary */}
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="text-white/45">Cost</div>
                            <div className="mt-1 font-medium">
                              ${purchaseTotal.toFixed(2)}
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="text-white/45">Value</div>
                            <div className="mt-1 font-medium">
                              ${marketTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div
                          className={
                            rowProfitLoss == null
                              ? "mt-3 text-xs text-white/35"
                              : rowProfitLoss > 0
                              ? "mt-3 text-xs text-green-400"
                              : rowProfitLoss < 0
                              ? "mt-3 text-xs text-red-400"
                              : "mt-3 text-xs text-white/55"
                          }
                        >
                          Profit/Loss:{" "}
                          {rowProfitLoss == null
                            ? "—"
                            : `${rowProfitLoss >= 0 ? "+" : ""}$${rowProfitLoss.toFixed(2)}`}
                        </div>

                        <div className="mt-1 text-[11px] text-white/40">
                          Market used: ${effectiveMarketPrice.toFixed(2)} each
                        </div>

                        
                        {/* Editor controls */}
                        <div className="mt-4 space-y-3">

                          {/* PURCHASE */}
                          <div>
                            <div className="mb-1 text-xs text-white/60">Purchase</div>
                            <form action={savePurchasePrice} className="flex items-center gap-2">
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

                          {/* MARKET */}
                          <div>
                            <div className="mb-1 text-xs text-white/60">Market</div>
                            <form action={saveMarketPrice} className="flex items-center gap-2">
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

                          {/* QUANTITY */}
                          <div>
                            <div className="mb-1 text-xs text-white/60">Qty</div>
                            <form action={updateQuantity} className="flex items-center gap-2">
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

                          {/* DELETE */}
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
          </div>
        </div>
      </div>
    </div>
  );
}