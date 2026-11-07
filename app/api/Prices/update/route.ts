import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { auth } from "@/auth";
import { refreshStaleOwnedItems } from "@/lib/prices";

/*
File: app/api/Prices/update/route.ts

Purpose:
- Refresh market prices for catalog items that are in someone's collection
  and haven't been priced recently (see refreshStaleOwnedItems)

Who can call it:
- A scheduled job sending "Authorization: Bearer <CRON_SECRET>"
  -> refreshes owned items for all users
- A logged-in user (session cookie)
  -> refreshes only that user's owned items
- Anyone else -> 401. Every call spends eBay / pokemontcg.io quota.

Optional JSON body:
- { "force": true }        -> ignore staleness (re-price everything owned)
- { "staleHours": 6 }      -> custom staleness window
- { "limit": 50 }          -> max items this run (capped at 200)
*/

const MAX_LIMIT = 200;

function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    const isCron = hasValidCronSecret(request);
    let userId: string | undefined;

    if (!isCron) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      }
      userId = session.user.id;
    }

    const body = (await request.json().catch(() => ({}))) as {
      force?: boolean;
      staleHours?: number;
      limit?: number;
    };

    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.min(Math.max(1, Math.floor(body.limit)), MAX_LIMIT)
        : undefined;

    const staleHours =
      typeof body.staleHours === "number" && Number.isFinite(body.staleHours) && body.staleHours >= 0
        ? body.staleHours
        : undefined;

    const outcome = await refreshStaleOwnedItems({
      userId,
      staleHours: body.force ? 0 : staleHours,
      limit,
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
      { success: false, message: "Price update failed" },
      { status: 500 }
    );
  }
}
