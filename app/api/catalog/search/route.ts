import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/*
File: app/api/catalog/search/route.ts

Purpose:
- Search OmniVault's master catalog
- Used by the CatalogSearch UI
- Returns lightweight JSON results for fast rendering

Why this version exists:
- SQLite search is case-sensitive in your setup
- so we load catalog items first
- then do case-insensitive filtering in JavaScript

Extra feature:
- also returns the latest market price, if one exists
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
    const numericQuery =
      /^\d+$/.test(query) ? String(Number(query)) : null;

    /*
    Step 5:
    Load imported catalog items and latest saved price
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

        /*
        Load newest saved market price if available
        */
        prices: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            marketPrice: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: 500,
    });

    /*
    Step 6:
    Filter in JavaScript so search is case-insensitive
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
        numericQuery != null &&
        item.itemNumber != null &&
        !Number.isNaN(Number(item.itemNumber)) &&
        String(Number(item.itemNumber)) === numericQuery;

      return matchesText || matchesNumeric;
    });

    /*
    Step 7:
    Flatten latest price into marketPrice so the frontend
    gets a simple response shape
    */
    const resultWithPrice = filtered.slice(0, 20).map((item) => ({
      id: item.id,
      name: item.name,
      game: item.game,
      set: item.set,
      imageUrl: item.imageUrl,
      rarity: item.rarity,
      itemNumber: item.itemNumber,
      marketPrice: item.prices[0]?.marketPrice ?? null,
    }));

    /*
    Step 8:
    Return results to frontend
    */
    return NextResponse.json(resultWithPrice);
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