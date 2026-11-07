import { NextResponse } from "next/server";
import { refreshStaleOwnedItems } from "@/lib/prices";

/*
File: app/api/Prices/update/route.ts

Purpose:
- Refresh market prices for catalog items that are in someone's collection
  and haven't been priced recently (see refreshStaleOwnedItems)

Optional JSON body:
- { "force": true }        -> ignore staleness (re-price everything owned)
- { "staleHours": 6 }      -> custom staleness window
- { "limit": 50 }          -> max items this run
*/
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      force?: boolean;
      staleHours?: number;
      limit?: number;
    };

    const outcome = await refreshStaleOwnedItems({
      staleHours: body.force ? 0 : body.staleHours,
      limit: body.limit,
    });

    return NextResponse.json({
      success: true,
      updatedCount: outcome.checked,
      summary: outcome.summary,
      results: outcome.results,
    });
  } catch (error) {
    console.error("PRICE UPDATE ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Price update failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
