import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/*
Catalog search route

Supports searching by:
- name
- set
- game
- item number

Important:
- SQLite does NOT support Prisma's mode: "insensitive"
- this route always returns JSON, even on errors
*/
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
const query = searchParams.get("q")?.trim();

/*
Handle number searches like:
001 → 1
*/
const numericQuery =
  query && /^\d+$/.test(query)
    ? String(Number(query)) // removes leading zeros
    : null;

if (!query) {
  return NextResponse.json([]);
}

    /*
    Search name first
    */
    const nameMatches = await prisma.item.findMany({
      where: {
        name: {
          contains: query,
        },
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
      take: 8,
    });

    /*
    Search broader fields too
    */
    const otherMatches = await prisma.item.findMany({
      where: {
        OR: [
          {
            set: {
              contains: query,
            },
          },
          {
            game: {
              contains: query,
            },
          },
          {
  OR: [
    {
      itemNumber: {
        contains: query,
      },
    },
    ...(numericQuery
      ? [
          {
            itemNumber: {
              contains: numericQuery,
            },
          },
        ]
      : []),
  ],
}
        ],
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
      take: 8,
    });

    /*
    Merge and remove duplicates
    */
    const seen = new Set<string>();

    const merged = [...nameMatches, ...otherMatches].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return NextResponse.json(merged.slice(0, 10));
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