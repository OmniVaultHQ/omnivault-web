import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/*
File: app/api/catalog/search/route.ts

Purpose:
- Search OmniVault's master catalog
- Used by the CatalogSearch UI
- Returns lightweight JSON results for fast rendering

Why this version exists:
- Your current Prisma + SQLite setup does not support:
  mode: "insensitive"
- So we load catalog items from the database first
- Then we do case-insensitive filtering in JavaScript
- This is fine for your current catalog size

Extra feature:
- Also returns the latest market price if one exists
*/

export async function GET(req: Request) {
  try {
    /*
    Step 1:
    Read the query from the URL

    Example:
    /api/catalog/search?q=charizard
    */
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    /*
    Step 2:
    Empty search returns empty results
    */
    if (!query) {
      return NextResponse.json([]);
    }

    /*
    Step 3:
    Normalize search text to lowercase so matching is case-insensitive
    */
    const queryLower = query.toLowerCase();

    /*
    Step 4:
    If the search is only digits, also normalize number search

    Example:
    "001" becomes "1"
    */
    const numericQuery =
      /^\d+$/.test(query) ? String(Number(query)) : null;

    /*
    Step 5:
    Load catalog items from the database

    IMPORTANT:
    We only want imported catalog items, not user-created custom items.

    We also load the newest saved price, if one exists.
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
        Get latest saved market price for this item
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
    Do case-insensitive matching in JavaScript

    Why:
    - avoids SQLite case-sensitivity issues
    - gives predictable matching right now
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
      Extra helper for number searches like:
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
    Flatten the latest price into marketPrice so the frontend
    gets a simpler response shape
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
    Return JSON results to the frontend
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