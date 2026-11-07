import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/*
File: app/api/catalog/search/route.ts

Purpose:
- Search OmniVault's master catalog
- Used by the CatalogSearch UI
- Returns lightweight JSON results for fast rendering

Why this version exists:
- avoids Prisma engine crashes from nested relation loading
- keeps search case-insensitive for SQLite
- supports partial text search and numeric item number search
- fetches latest prices in a second safer query
*/

export async function GET(req: Request) {
  try {
    /*
    Step 1:
    Read search query from URL
    */
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    /*
    Step 2:
    Empty search returns empty array
    */
    if (!query) {
      return NextResponse.json([]);
    }

    /*
    Step 3:
    Lowercase query so matching is case-insensitive
    */
    const queryLower = query.toLowerCase();

    /*
    Step 4:
    Normalize digit-only searches like:
    001 -> 1
    */
    const numericQuery = /^\d+$/.test(query) ? String(Number(query)) : null;

    /*
    Step 5:
    Load catalog items only

    IMPORTANT:
    We do NOT include nested prices here.
    That nested relation query is what has been causing Prisma/SQLite trouble.
    */
    const allCatalogItems = await prisma.item.findMany({
      where: {
        isCustom: false,
      },
      select: {
        id: true,
        name: true,
        game: true,
        set: true,
        imageUrl: true,
        rarity: true,
        itemNumber: true,
      },
    });

    /*
    Step 6:
    Filter in JavaScript so search is case-insensitive
    and partial search works for SQLite
    */
    const filtered = allCatalogItems.filter((item) => {
      const name = item.name?.toLowerCase() ?? "";
      const set = item.set?.toLowerCase() ?? "";
      const game = item.game?.toLowerCase() ?? "";
      const itemNumber = item.itemNumber?.toLowerCase() ?? "";

      const matchesText =
        name.includes(queryLower) ||
        set.includes(queryLower) ||
        game.includes(queryLower) ||
        itemNumber.includes(queryLower);

      /*
      Extra helper for number search:
      001 -> 1
      */
      const matchesNumeric =
        numericQuery !== null &&
        item.itemNumber !== null &&
        !Number.isNaN(Number(item.itemNumber)) &&
        String(Number(item.itemNumber)) === numericQuery;

      return matchesText || matchesNumeric;
    });

    /*
    Step 7:
    Sort matches AFTER filtering

    Why:
    - fixes the old problem where useful results were excluded
      before filtering
    - keeps search feeling natural
    */
    const sorted = filtered.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    const aExact = aName === queryLower;
    const bExact = bName === queryLower;

    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = aName.startsWith(queryLower);
    const bStarts = bName.startsWith(queryLower);

    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return aName.localeCompare(bName);
    });

    /*
    Step 8:
    Limit final results
    */
    const limited = sorted.slice(0, 20);

    /*
    Step 9:
    Load latest saved price rows for only the visible results

    We do this as a second query to keep Prisma stable.
    */
    const visibleItemIds = limited.map((item) => item.id);

    const latestPriceRows =
      visibleItemIds.length > 0
        ? await prisma.itemPrice.findMany({
            where: {
              itemId: {
                in: visibleItemIds,
              },
            },
            orderBy: [
              { itemId: "asc" },
              { createdAt: "desc" },
            ],
            select: {
              itemId: true,
              marketPrice: true,
              createdAt: true,
            },
          })
        : [];

    /*
    Step 10:
    Keep only the newest price per item
    */
    const latestPriceByItemId = new Map<string, number>();

    for (const row of latestPriceRows) {
      if (!latestPriceByItemId.has(row.itemId)) {
        latestPriceByItemId.set(row.itemId, row.marketPrice);
      }
    }

    /*
    Step 11:
    Build final frontend-friendly response
    */
    const result = limited.map((item) => ({
      id: item.id,
      name: item.name,
      game: item.game,
      set: item.set,
      imageUrl: item.imageUrl,
      rarity: item.rarity,
      itemNumber: item.itemNumber,
      marketPrice: latestPriceByItemId.get(item.id) ?? null,
    }));

    /*
    Step 12:
    Return results to frontend
    */
    return NextResponse.json(result);
  } catch (error) {
    console.error("CATALOG SEARCH ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Catalog search failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}