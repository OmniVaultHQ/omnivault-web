import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getOrCreateDefaultCollection } from "@/lib/collections";

import SubmitButton from "@/app/components/Submitbutton";
import { updatePricesForItems } from "@/lib/prices";
import PortfolioSummaryCards from "@/app/components/PortfolioSummaryCards";
import DashboardHeader from "@/app/components/DashboardHeader";
import CollectionControls from "@/app/components/CollectionControls";
import PortfolioAnalytics from "@/app/components/PortfolioAnalytics";
import SetCompletionCard from "@/app/components/SetCompletionCard";
import CollectionTools from "@/app/components/CollectionTools";
import CollectionItemsSection from "@/app/components/CollectionItemsSection";
import CollectionValueBreakdown from "@/app/components/CollectionValueBreakdown";
import DashboardCollectionArea from "@/app/components/DashboardCollectionArea";

import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Always run this page on the server so the dashboard stays fresh
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Next.js can hand searchParams in as:
 * - undefined
 * - object
 * - Promise<object>
 *
 * This type keeps TypeScript happy.
 */
type SearchParamsMaybePromise =
  | {
      q?: string | string[];
      cat?: string | string[];
      cid?: string | string[];
      sort?: string | string[];
      view?: string | string[];
      missingSort?: string | string[];
    }
  | Promise<
      | {
          q?: string | string[];
          cat?: string | string[];
          cid?: string | string[];
          sort?: string | string[];
          view?: string | string[];
          missingSort?: string | string[];
        }
      | undefined
    >
  | undefined;

/**
 * Convert a search param into a plain string.
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
 * Create a safe file name for uploads.
 * This helps avoid bad characters causing file write issues.
 */
function makeSafeFileName(originalName: string) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const safeExt = ext.toLowerCase().replace(/[^.a-z0-9]/g, "");

  return `${Date.now()}-${safeBase || "upload"}${safeExt || ""}`;
}

/**
 * Type for one collection row plus:
 * - linked item
 * - linked item price history
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
  // Require a logged-in user to see the dashboard
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // ==================================================
  // QUERY PARAMS
  // ==================================================
  // Next.js may send searchParams as a Promise in some versions,
  // so we safely resolve it here.
  const sp: any =
    searchParams && typeof (searchParams as any).then === "function"
      ? await (searchParams as any)
      : searchParams ?? {};

  const q = normalizeStr(sp?.q).trim();
  const cat = normalizeStr(sp?.cat).trim();
  const cid = normalizeStr(sp?.cid).trim();
  const sort = normalizeStr(sp?.sort).trim();
  const catalog = normalizeStr(sp?.catalog).trim();
  /*
How to sort the missing items list in Set Completion
*/
const missingSort = normalizeStr(sp?.missingSort).trim().toLowerCase() || "price_desc";

  // Read current view mode from the URL
  const view = normalizeStr(sp?.view).trim().toLowerCase();
  const currentView = view === "grid" ? "grid" : "list";

  // ==================================================
  // COLLECTIONS
  // ==================================================
  // Make sure this user always has a default collection
  const defaultCollection = await getOrCreateDefaultCollection(userId);

  // Load all collections owned by this user
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  // Use URL collection if valid, otherwise fall back to default collection
  const activeCollectionId =
    collections.some((c) => c.id === cid) ? cid : defaultCollection.id;

  // Your default collection acts like "All Collections"
  const isMainCollection = activeCollectionId === defaultCollection.id;

  // ==================================================
  // SERVER ACTIONS
  // ==================================================

  /**
   * Refresh market prices for items currently visible
   */
  async function refreshPrices(): Promise<void> {
    "use server";

    const currentRows = await prisma.collectionItem.findMany({
      where: isMainCollection ? { userId } : { collectionId: activeCollectionId },
      select: {
        itemId: true,
      },
    });

    const itemIds = currentRows.map((row) => row.itemId);

    // Remove duplicate item ids before price refresh
    const uniqueIds = [...new Set(itemIds)];

    // If there is nothing to update, just refresh the page
    if (uniqueIds.length === 0) {
      revalidatePath("/dashboard");
      return;
    }

    // Run your pricing logic
    await updatePricesForItems(uniqueIds);

    // Re-render dashboard
    revalidatePath("/dashboard");
  }
  
  async function addItemToCollection(
  itemId: string,
  collectionId: string
): Promise<void> {
  "use server";

  const session = await auth();
  if (!session?.user?.id) return;

  // Only allow adding to a collection this user owns
  const ownedCollection = await prisma.collection.findFirst({
    where: { id: collectionId, userId: session.user.id },
    select: { id: true },
  });
  if (!ownedCollection) return;

  await prisma.collectionItem.upsert({
    where: {
      userId_itemId_collectionId: {
        userId: session.user.id,
        itemId,
        collectionId,
      },
    },
    update: {
      quantity: {
        increment: 1,
      },
    },
    create: {
      userId: session.user.id,
      itemId,
      collectionId,
      quantity: 1,
    },
  });

  revalidatePath("/dashboard");
}

  /**
   * Logout action
   */
  async function logout(): Promise<void> {
    "use server";
    redirect("/api/auth/signout");
  }

  /**
   * Create a new collection
   */
  async function createCollection(formData: FormData): Promise<void> {
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
   * Switch the active collection
   */
  async function switchCollection(formData: FormData): Promise<void> {
    "use server";

    const next = String(formData.get("cid") ?? "").trim();
    if (!next) {
      redirect(`/dashboard?view=${currentView}`);
    }

    redirect(`/dashboard?cid=${next}&view=${currentView}`);
  }

  /**
   * Add a custom item to a collection
   *
   * Supports:
   * - manual image URL
   * - uploaded image file
   */
  async function addItem(formData: FormData): Promise<void> {
    "use server";

    const selectedCollectionId = String(
      formData.get("collectionId") ?? ""
    ).trim();

    const gameRaw = String(formData.get("game") ?? "").trim();
    const setRaw = String(formData.get("set") ?? "").trim();
    const nameRaw = String(formData.get("name") ?? "").trim();
    const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();
    const categoryRaw = String(formData.get("category") ?? "").trim();

    // Read optional condition from the form
    const conditionRaw = String(formData.get("condition") ?? "").trim();

    // Store empty condition as null
    const condition = conditionRaw || null;

    // Read uploaded image file from the form
    const imageFile = formData.get("imageFile");

    // Read quantity from the form
    const qtyRaw = Number(formData.get("quantity") ?? 1);

    // Read optional purchase price from the form
    const purchasePriceRaw = String(formData.get("purchasePrice") ?? "").trim();

    // Normalize text fields for consistent saving/searching
    const game = gameRaw.toLowerCase();
    const set = setRaw.toLowerCase();
    const name = nameRaw;
    const category = categoryRaw || null;

    // Keep quantity valid
    const quantity = Number.isFinite(qtyRaw) ? Math.max(1, qtyRaw) : 1;

    // Convert purchase price safely
    const purchasePrice =
      purchasePriceRaw === "" ? null : Number(purchasePriceRaw);

    const safePurchasePrice =
      purchasePrice !== null && Number.isFinite(purchasePrice)
        ? purchasePrice
        : null;

    // Basic validation
    if (!game || !set || !name || !selectedCollectionId) return;

    // Only allow adding to a collection this user owns
    const ownedCollection = await prisma.collection.findFirst({
      where: { id: selectedCollectionId, userId },
      select: { id: true },
    });
    if (!ownedCollection) return;

    // Final image URL can come from:
    // 1. manually pasted URL
    // 2. uploaded image file saved to /public/uploads
    let finalImageUrl: string | null = imageUrlRaw || null;

    // Handle uploaded file if one exists
    if (imageFile instanceof File && imageFile.size > 0) {
      // Only allow image uploads
      if (!imageFile.type.startsWith("image/")) {
        throw new Error("Uploaded file must be an image.");
      }

      // Convert browser File -> Node Buffer
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Make sure uploads folder exists
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });

      // Build a safer file name
      const safeFileName = makeSafeFileName(imageFile.name);

      // Absolute server path
      const filePath = path.join(uploadsDir, safeFileName);

      // Save the file
      await writeFile(filePath, buffer);

      // Public URL used by the browser
      finalImageUrl = `/uploads/${safeFileName}`;
    }

    // Try to reuse an existing custom item first
    let item = await prisma.item.findFirst({
      where: {
        name,
        set,
        game,
        category,
        createdByUserId: userId,
        isCustom: true,
      },
    });

    // If item exists but has no image, update the image
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
      // Create the custom catalog item
      item = await prisma.item.create({
        data: {
          name,
          set,
          game,
          category,
          imageUrl: finalImageUrl,
          isCustom: true,
          createdByUserId: userId,
        },
      });
    }

    // Add item to collection or increase quantity if already there
    // purchasePrice belongs on CollectionItem, not Item,
    // because each user can pay a different amount
    await prisma.collectionItem.upsert({
  where: {
    userId_itemId_collectionId: {
      userId,
      itemId: item.id,
      collectionId: selectedCollectionId,
    },
  },
  create: {
    userId,
    collectionId: selectedCollectionId,
    itemId: item.id,
    quantity,
    purchasePrice: safePurchasePrice,
    condition,
  },
  update: {
    quantity: { increment: quantity },
  },
});

    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${selectedCollectionId}&view=${currentView}`);
  }
  

  /**
   * Delete a collection item row
   */
  async function deleteItem(formData: FormData): Promise<void> {
    "use server";

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    // deleteMany scoped by userId so users can only delete their own rows
    await prisma.collectionItem.deleteMany({
      where: { id, userId },
    });

    revalidatePath("/dashboard");
  }

  /**
   * Update quantity directly
   */
  async function updateQuantity(formData: FormData): Promise<void> {
    "use server";

    const id = String(formData.get("id") ?? "").trim();
    const raw = Number(formData.get("quantity") ?? 1);

    if (!id) return;

    const quantity = Number.isFinite(raw) ? Math.max(1, raw) : 1;

    await prisma.collectionItem.updateMany({
      where: { id, userId },
      data: { quantity },
    });

    revalidatePath("/dashboard");
  }

  /**
   * Save purchase price for a collection row
   */
  async function savePurchasePrice(formData: FormData): Promise<void> {
    "use server";

    const id = String(formData.get("id") ?? "").trim();
    const raw = String(formData.get("purchasePrice") ?? "").trim();

    if (!id) return;

    const parsed = raw === "" ? null : Number(raw);

    await prisma.collectionItem.updateMany({
      where: { id, userId },
      data: {
        purchasePrice:
          parsed !== null && Number.isFinite(parsed) ? parsed : null,
      },
    });

    revalidatePath("/dashboard");
  }

  /**
 * Save manual market price (on this user's row only)
 *
 * We also save:
 * - priceSource = "manual"
 * - lastPriceUpdated = now
 * on the CollectionItem row so the dashboard can show
 * where the price came from and when it was last changed.
 */
async function saveMarketPrice(formData: FormData): Promise<void> {
  "use server";

  const id = String(formData.get("id") ?? "").trim();
  const raw = String(formData.get("marketPrice") ?? "").trim();

  if (!id) return;

  const parsed = raw === "" ? null : Number(raw);
  const safeMarketPrice =
    parsed !== null && Number.isFinite(parsed) ? parsed : null;

  const collectionRow = await prisma.collectionItem.findFirst({
    where: { id, userId },
    select: {
      id: true,
      itemId: true,
    },
  });

  if (!collectionRow) return;

  // Build one timestamp so both row update + history row feel consistent
  const now = new Date();

  // Save manual price on the collection row
    await prisma.collectionItem.update({
    where: { id },
    data: {
      marketPrice: safeMarketPrice,

      // Mark this price as a manual override entered by the user
      priceSource: safeMarketPrice !== null ? "manual" : null,

      // Lock the row when user enters a manual market price
      manualPriceLocked: safeMarketPrice !== null,

      // Only set last update time when we actually have a market price
      lastPriceUpdated: safeMarketPrice !== null ? now : null,
    },
  });

  // Manual prices stay on this user's row only. ItemPrice history is shared
  // by every user who owns this catalog item, so it holds provider prices only.

  revalidatePath("/dashboard");
}

/**
 * Unlock manual pricing for one collection row
 *
 * What this does:
 * - clears the row-level manual market price
 * - clears manual source metadata
 * - turns auto pricing back on
 *
 * After unlocking:
 * - the next refresh can sync simulated/API pricing again
 * - the UI falls back to catalog/shared pricing if one exists
 */
async function useAutoPriceAgain(formData: FormData): Promise<void> {
  "use server";

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.collectionItem.updateMany({
    where: { id, userId },
    data: {
      marketPrice: null,
      priceSource: null,
      lastPriceUpdated: null,
      manualPriceLocked: false,
    },
  });

  revalidatePath("/dashboard");
}

  async function updateItemDetails(formData: FormData): Promise<void> {
  "use server";

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const conditionRaw = String(formData.get("condition") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const quantityRaw = Number(formData.get("quantity") ?? 1);
  const purchasePriceRaw = String(formData.get("purchasePrice") ?? "").trim();
  const marketPriceRaw = String(formData.get("marketPrice") ?? "").trim();

  const condition = conditionRaw || null;
  const notes = notesRaw || null;

  const quantity = Number.isFinite(quantityRaw) ? Math.max(1, quantityRaw) : 1;

  const parsedPurchase =
    purchasePriceRaw === "" ? null : Number(purchasePriceRaw);
  const safePurchasePrice =
    parsedPurchase !== null && Number.isFinite(parsedPurchase)
      ? parsedPurchase
      : null;

  const parsedMarket = marketPriceRaw === "" ? null : Number(marketPriceRaw);
  const safeMarketPrice =
    parsedMarket !== null && Number.isFinite(parsedMarket)
      ? parsedMarket
      : null;

  const collectionRow = await prisma.collectionItem.findFirst({
    where: { id, userId },
    select: {
      id: true,
      itemId: true,
    },
  });

  if (!collectionRow) return;

  // Use one timestamp for this update cycle
  const now = new Date();

    await prisma.collectionItem.update({
    where: { id },
    data: {
      condition,
      notes,
      quantity,
      purchasePrice: safePurchasePrice,
      marketPrice: safeMarketPrice,

      /*
      If the user manually entered a market price in the edit form,
      mark the row as manual and stamp the update time.

      If they cleared the market price, clear source + last update too.
      */
      priceSource: safeMarketPrice !== null ? "manual" : null,
      manualPriceLocked: safeMarketPrice !== null,
      lastPriceUpdated: safeMarketPrice !== null ? now : null,
    },
  });

  // Manual prices stay on this user's row only. ItemPrice history is shared
  // by every user who owns this catalog item, so it holds provider prices only.

  revalidatePath("/dashboard");
}

  // ==================================================
  // LOAD DASHBOARD DATA
  // ==================================================

  /**
   * Load collection items
   *
   * Includes newest 10 price history rows for each linked item
   */
  const items: CollectionItemWithItem[] = await prisma.collectionItem.findMany({
    where: isMainCollection ? { userId } : { collectionId: activeCollectionId },
    orderBy: { id: "desc" },
    include: {
      item: {
        include: {
          prices: {
            orderBy: { lastUpdated: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  // ==================================================
  // PRICE HELPERS
  // ==================================================

  /**
   * Latest shared/catalog market price
   */
  function getCatalogMarketPrice(item: CollectionItemWithItem) {
    return item.item.prices?.[0]?.marketPrice ?? null;
  }

  /**
   * Manual market price saved on collection row
   */
  function getManualMarketPrice(item: CollectionItemWithItem) {
    return item.marketPrice ?? null;
  }

  /**
   * Purchase price saved on collection row
   */
  function getPurchasePrice(item: CollectionItemWithItem) {
    return item.purchasePrice ?? null;
  }

  /**
 * Where the current collection row market price came from
 * Examples:
 * - manual
 * - simulated
 * - tcgplayer
 */
function getPriceSource(item: CollectionItemWithItem) {
  return item.priceSource ?? null;
}

/**
 * When the current collection row market price was last updated
 */
function getLastPriceUpdated(item: CollectionItemWithItem) {
  return item.lastPriceUpdated ?? null;
}

/**
 * Effective market price priority:
 * 1. market price on the owned row (manual override or last synced provider price)
 * 2. latest saved catalog price from a provider
 * 3. purchase price (shown in the UI as "Purchase Fallback")
 * Otherwise null: the item has no price yet. Never invent one (no rarity guesses).
 */
function getEffectiveMarketPrice(item: CollectionItemWithItem): number | null {
  return getManualMarketPrice(item) ?? getCatalogMarketPrice(item) ?? getPurchasePrice(item);
}

  /**
   * Total market value for this row
   */
  function getRowMarketTotal(item: CollectionItemWithItem) {
    return (getEffectiveMarketPrice(item) ?? 0) * item.quantity;
  }

  /**
   * Total purchase value for this row
   */
  function getRowPurchaseTotal(item: CollectionItemWithItem) {
    return (getPurchasePrice(item) ?? 0) * item.quantity;
  }

  // ==================================================
  // FILTERING + SORTING
  // ==================================================

  /**
   * Build category dropdown options from current collection items
   */
  const categories = Array.from(
    new Set(
      items
        .map((i) => i.item?.category)
        .filter((value): value is string => Boolean(value))
    )
  ).sort();

  /**
   * Apply category filter + search filter
   */
  const filtered = items.filter((i) => {
    if (cat && i.item.category !== cat) return false;
    if (!q) return true;

    const hay =
      `${i.item.name} ${i.item.set} ${i.item.game} ${
        i.item.category ?? ""
      }`.toLowerCase();

    return hay.includes(q.toLowerCase());
  });

  /**
   * Sort filtered rows based on selected sort option
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
  // DASHBOARD STATS (PORTFOLIO SUMMARY)
  // ==================================================

  /*
    Dashboard summary should reflect the currently loaded collection rows.

    Why this exists:
    - keeps the summary cards in sync with the active collection
    - avoids confusion if we later change how rows are filtered or loaded
    - makes all summary math use one consistent source
    */
    const summaryRows = filtered;
    /*
    Number of distinct owned rows
    */
    const totalUnique = summaryRows.length;

    /*
    Sum of all owned quantity
    */
    const totalOwned = summaryRows.reduce((sum, row) => {
      return sum + (row.quantity ?? 0);
    }, 0);

    /*
    Total current market value
    */
    const collectionValue = summaryRows.reduce((sum, row) => {
      return sum + getRowMarketTotal(row);
    }, 0);

    /*
    Total amount paid
    */
    const costBasis = summaryRows.reduce((sum, row) => {
      return sum + getRowPurchaseTotal(row);
    }, 0);

    /*
    Portfolio profit / loss
    */
    const totalProfitLoss = collectionValue - costBasis;

  /* ============================================================
   COLLECTION PERFORMANCE CALCULATION
   ------------------------------------------------------------
   Purpose:
   Build value + cost + profit for each collection so the
   dashboard can show performance metrics.

   Output Example:
   [
     {
       id: "abc",
       name: "Yu-Gi-Oh",
       value: 350,
       cost: 230,
       profit: 120
     }
   ]
   ============================================================ */

const collectionTotals = collections
  /* Exclude the default "Main" collection
     because it represents ALL items already */
  .filter((collection) => collection.id !== defaultCollection.id)

  .map((collection) => {
    /* --------------------------------------------
       Get all items that belong to this collection
       -------------------------------------------- */
    const itemsInCollection = items.filter(
      (i) => i.collectionId === collection.id
    );

    /* --------------------------------------------
       Calculate total MARKET VALUE
       -------------------------------------------- */
    const value = itemsInCollection.reduce((sum, row) => {
      return sum + getRowMarketTotal(row);
    }, 0);

    /* --------------------------------------------
       Calculate total PURCHASE COST
       -------------------------------------------- */
    const cost = itemsInCollection.reduce((sum, row) => {
      return sum + getRowPurchaseTotal(row);
    }, 0);

    /* --------------------------------------------
       Profit / Loss
       -------------------------------------------- */
    const profit = value - cost;

    return {
      id: collection.id,
      name: collection.name,
      value,
      cost,
      profit,
    };
  });

  // ==================================================
  // ALLOCATION (BY GAME)
  // ==================================================

  /**
   * Groups total value by game using existing market-total logic.
   * This makes an allocation view like a portfolio tracker.
   */
  const valueByGame = new Map<string, number>();

  for (const row of items) {
    const gameLabel = (row.item.game || "Unknown").trim() || "Unknown";
    const rowValue = getRowMarketTotal(row);

    valueByGame.set(gameLabel, (valueByGame.get(gameLabel) ?? 0) + rowValue);
  }

  // Turn the map into a sorted array (largest value first)
  const allocationByGame = Array.from(valueByGame.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Keep top 5, put the rest into "Other" so the UI stays clean
  const topGames = allocationByGame.slice(0, 5);
  const otherTotal = allocationByGame
    .slice(5)
    .reduce((sum, x) => sum + x.value, 0);

  const allocationDisplay =
    otherTotal > 0
      ? [...topGames, { label: "Other", value: otherTotal }]
      : topGames;

  // Safe total for percent math
  const allocationTotal = Math.max(0, collectionValue);

  // Single most valuable item (market total)
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

  // Top 5 items by market total
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

  /* ============================================================
   PORTFOLIO VALUE HISTORY
   ------------------------------------------------------------
   Purpose:
   Build real chart data from saved item price history.

   How it works:
   1. Load all price history rows for items in the current view
   2. Group rows by calendar day
   3. For each day, keep the latest saved price per item
   4. Multiply each item's latest price by owned quantity
   5. Sum everything into one daily portfolio total
   ============================================================ */

/* Track owned quantity per item so we can multiply price × quantity */
const quantityByItemId = new Map<string, number>();

for (const row of items) {
  quantityByItemId.set(row.item.id, row.quantity);
}

/* Only load history for items currently shown */
const currentItemIds = Array.from(new Set(items.map((i) => i.item.id)));

/* Pull all saved price history rows for those items */
const priceHistoryRows =
  currentItemIds.length > 0
    ? await prisma.itemPrice.findMany({
        where: {
          itemId: {
            in: currentItemIds,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          itemId: true,
          marketPrice: true,
          createdAt: true,
        },
      })
    : [];

/* Group price rows by readable day label */
const rowsByDay = new Map<
  string,
  { itemId: string; marketPrice: number; createdAt: Date }[]
>();

for (const row of priceHistoryRows) {
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(row.createdAt));

  const existing = rowsByDay.get(dayLabel) ?? [];
  existing.push(row);
  rowsByDay.set(dayLabel, existing);
}

/* Final chart arrays */
let chartLabels: string[] = [];
let chartValues: number[] = [];

/* For each day, keep only the newest saved price per item */
for (const [dayLabel, dayRows] of rowsByDay.entries()) {
  const latestPriceByItemId = new Map<
    string,
    { marketPrice: number; createdAt: Date }
  >();

  for (const row of dayRows) {
    const existing = latestPriceByItemId.get(row.itemId);

    if (!existing || new Date(row.createdAt) > new Date(existing.createdAt)) {
      latestPriceByItemId.set(row.itemId, {
        marketPrice: row.marketPrice,
        createdAt: row.createdAt,
      });
    }
  }

  /* Sum daily portfolio value */
  let dailyPortfolioValue = 0;

  for (const [itemId, latestPrice] of latestPriceByItemId.entries()) {
    const quantity = quantityByItemId.get(itemId) ?? 0;
    dailyPortfolioValue += latestPrice.marketPrice * quantity;
  }

  chartLabels.push(dayLabel);
  chartValues.push(Number(dailyPortfolioValue.toFixed(2)));
}

/* Fallback so chart never renders empty */
if (chartLabels.length === 0) {
  chartLabels = ["Now"];
  chartValues = [collectionValue];
}

  // ==================================================
  // PRICE CHANGE LEADERBOARD (REAL + CLEAN)
  // ==================================================

  type PriceMover = {
    id: string;
    name: string;
    change: number;
    pct: number | null;
  };

  const priceMovers: PriceMover[] = items
    .map((row) => {
      const prices = row.item.prices ?? [];
      if (prices.length < 2) return null;

      const latest = prices[0].marketPrice ?? 0;
      const previous = prices[1].marketPrice ?? 0;

      const change = latest - previous;
      const pct = previous > 0 ? (change / previous) * 100 : null;

      return { id: row.id, name: row.item.name, change, pct };
    })
    .filter((x): x is PriceMover => Boolean(x));

  const topGainers = priceMovers
    .filter((m) => m.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);

  const topLosers = priceMovers
    .filter((m) => m.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 5);

      /*
        =========================================
        PROFIT-BASED LEADERBOARD
        -----------------------------------------
        Purpose:
        - Shows best and worst investments based on
          purchase cost vs current market value
        - Different from price movers:
          price movers track market change
          profit leaderboard tracks your own gain/loss
        =========================================
        */
        const profitItems = items
          .map((row) => {
            const market = getRowMarketTotal(row);
            const cost = getRowPurchaseTotal(row);

            /*
            Skip rows with no cost basis.
            If cost is 0, we cannot measure real investment performance.
            */
            if (cost === 0) return null;

            return {
              id: row.id,
              name: row.item.name,
              profit: market - cost,
            };
          })
          .filter(
            (x): x is { id: string; name: string; profit: number } => Boolean(x)
          );

        /*
        Best investments first
        */
        const topProfitItems = [...profitItems]
          .sort((a, b) => b.profit - a.profit)
          .slice(0, 3);

        /*
        Worst investments first
        */
        const worstProfitItems = [...profitItems]
          .sort((a, b) => a.profit - b.profit)
          .slice(0, 3);

    // ==================================================
  // SET COMPLETION
  // ==================================================

  /*
  Smart set tracking

  Old behavior:
  - only allow set completion if the collection has exactly 1 set and 1 game

  New behavior:
  - if not on Main collection, automatically track the most common set
  - automatically track the most common game
  - this makes set completion more forgiving and useful
  */
  let trackedSetName: string | null = null;
  let trackedGameName: string | null = null;

  if (!isMainCollection) {
    /*
    Count how many times each set appears
    */
    const setCounts = new Map<string, number>();

    /*
    Count how many times each game appears
    */
    const gameCounts = new Map<string, number>();

    for (const row of items) {
      if (row.item.set) {
        setCounts.set(row.item.set, (setCounts.get(row.item.set) ?? 0) + 1);
      }

      if (row.item.game) {
        gameCounts.set(row.item.game, (gameCounts.get(row.item.game) ?? 0) + 1);
      }
    }

    /*
    Pick the most common set in this collection
    */
    trackedSetName =
      [...setCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    /*
    Pick the most common game in this collection
    */
    trackedGameName =
      [...gameCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  /*
  Can show completion as long as:
  - not main collection
  - we found a set
  - we found a game
  */
  const canShowSetCompletion =
    !isMainCollection && !!trackedSetName && !!trackedGameName;

  /*
  Count unique owned items in the tracked set
  */
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

  /*
  Build a clean list of owned tracked item ids
  */
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

  /*
  Total number of items in the tracked set
  */
  const totalItemsInTrackedSet =
    canShowSetCompletion && trackedSetName && trackedGameName
      ? await prisma.item.count({
          where: {
            set: trackedSetName,
            game: trackedGameName,
          },
        })
      : 0;

  /*
  Completion percent
  */
  const setCompletionPercent =
    totalItemsInTrackedSet > 0
      ? Math.round((ownedUniqueSetItems / totalItemsInTrackedSet) * 100)
      : 0;

  /*
  Load ALL missing items with:
  - rarity
  - item number
  - latest price row

  Why:
  - we want to show the full missing list
  - we want to sort by importance
  - we want to calculate missing value
  */
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

        /*
        Pull all data needed for missing-item priority display
        */
        select: {
          id: true,
          name: true,
          rarity: true,
          itemNumber: true,
          prices: {
            orderBy: { lastUpdated: "desc" },
            take: 1,
          },
        },
      })
    : [];

/*
Convert DB result into clean UI format.
Missing items without a saved provider price get price: null (unknown),
never a rarity-based guess.
*/
const formattedMissingItems = missingItems.map((item) => ({
  id: item.id,
  name: item.name,
  rarity: item.rarity,
  itemNumber: item.itemNumber,
  price: item.prices?.[0]?.marketPrice ?? null,
}));

/*
Helper for rarity sorting
Higher score = higher priority
*/
function getRaritySortScore(rarity?: string | null) {
  const value = rarity?.toLowerCase() ?? "";

  if (value.includes("holo")) return 4;
  if (value.includes("rare")) return 3;
  if (value.includes("uncommon")) return 2;
  return 1;
}

/*
Convert card/item number into a sortable number.
If it is not numeric, push it lower in number sorting.
*/
function getItemNumberSortValue(itemNumber?: string | null) {
  const parsed = Number(itemNumber);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/*
Sort missing items based on dashboard query param
*/
const sortedMissingItems = [...formattedMissingItems].sort((a, b) => {
  switch (missingSort) {
    case "price_asc":
      return (a.price ?? 0) - (b.price ?? 0);

    case "number_asc":
      return getItemNumberSortValue(a.itemNumber) - getItemNumberSortValue(b.itemNumber);

    case "name_asc":
      return a.name.localeCompare(b.name);

    case "rarity_desc":
      return getRaritySortScore(b.rarity) - getRaritySortScore(a.rarity);

    case "price_desc":
    default:
      return (b.price ?? 0) - (a.price ?? 0);
  }
});

/*
Total value of all missing items in the tracked set
*/
const missingValue = sortedMissingItems.reduce(
  (total, item) => total + (item.price ?? 0),
  0
);
  
  // ==================================================
  // LAST REFRESH LABEL
  // ==================================================

  const latestPriceUpdate = await prisma.itemPrice.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });

  const lastRefreshLabel = latestPriceUpdate
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(latestPriceUpdate.createdAt))
    : null;

    

  // ==================================================
  // UI
  // ==================================================
  return (
    <div className="w-full px-4 pb-12 pt-8 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[2200px] rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-xl sm:p-8">
        {/* =========================================
            HEADER
           ========================================= */}
        <DashboardHeader
          userEmail={session?.user?.email ?? ""}
          lastRefreshLabel={lastRefreshLabel}
          refreshPrices={refreshPrices}
          logout={logout}
        />

        {/* =========================================
            COLLECTION CONTROLS
           ========================================= */}
        <CollectionControls
          collections={collections}
          activeCollectionId={String(activeCollectionId)}
          isMainCollection={isMainCollection}
          currentView={currentView}
          switchCollection={switchCollection}
          createCollection={createCollection}
        />

        {/* =========================================
            SUMMARY / VAULT STATS
           ========================================= */}
        <PortfolioSummaryCards
          totalUnique={totalUnique}
          totalOwned={totalOwned}
          collectionValue={collectionValue}
          costBasis={costBasis}
          totalProfitLoss={totalProfitLoss}
          mostValuableItem={mostValuableItem}
        />

        {/* =========================================
            ANALYTICS SECTION
           ========================================= */}
        <PortfolioAnalytics
          chartLabels={chartLabels}
          chartValues={chartValues}
          allocationDisplay={allocationDisplay}
          allocationTotal={allocationTotal}
          topGainers={topGainers}
          topLosers={topLosers}
          topValuableItems={topValuableItems}
          topProfitItems={topProfitItems}
          worstProfitItems={worstProfitItems}
        />
        <div className="mt-6">
          <CollectionValueBreakdown collections={collectionTotals} />
        </div>

        {/* =========================================
            SET COMPLETION
           ========================================= */}
        <SetCompletionCard
          canShowSetCompletion={canShowSetCompletion}
          isMainCollection={isMainCollection}
          trackedSetName={trackedSetName}
          trackedGameName={trackedGameName}
          ownedUniqueSetItems={ownedUniqueSetItems}
          totalItemsInTrackedSet={totalItemsInTrackedSet}
          setCompletionPercent={setCompletionPercent}
          missingItems={sortedMissingItems}
          missingValue={missingValue}
          missingSort={missingSort}
          activeCollectionId={activeCollectionId}
        />
        {/* =========================================
            FILTERS / SORT / SEARCH / COLLECTION ITEMS
           ========================================= */}
        <div className="mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold">Your Collection</h2>

            <div className="flex items-center gap-2">
              <form method="GET">
                <input type="hidden" name="cid" value={activeCollectionId} />
                {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                {sort ? <input type="hidden" name="sort" value={sort} /> : null}
                {q ? <input type="hidden" name="q" value={q} /> : null}
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

              <form method="GET">
                <input type="hidden" name="cid" value={activeCollectionId} />
                {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                {sort ? <input type="hidden" name="sort" value={sort} /> : null}
                {q ? <input type="hidden" name="q" value={q} /> : null}
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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

            <div className="flex flex-wrap items-center gap-3">
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
              COLLECTION ITEMS
              Rendered in a client component so cards
              can open the detail modal
             ========================================= */}
          <DashboardCollectionArea
              sorted={sorted as any}
              currentView={currentView}
              isMainCollection={isMainCollection}
              activeCollectionId={activeCollectionId}
              collections={collections}
              addItem={addItem}
              onAdd={addItemToCollection}
              defaultCatalogQuery={catalog}
              savePurchasePrice={savePurchasePrice}
              saveMarketPrice={saveMarketPrice}
              updateQuantity={updateQuantity}
              deleteItem={deleteItem}
              updateItemDetails={updateItemDetails}
              useAutoPriceAgain={useAutoPriceAgain}
            />
        </div>
      </div>
    </div>
  );
}