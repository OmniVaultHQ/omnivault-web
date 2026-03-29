import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updatePricesForItems } from "@/lib/prices";

/*
File: app/api/prices/update/route.ts

Purpose:
- Refresh prices for all imported catalog items
- Uses the existing pricing engine in lib/prices.ts
*/
export async function POST() {
  try {
    /*
    Step 1:
    Load all imported catalog item IDs
    */
    const items = await prisma.item.findMany({
      where: {
        isCustom: false,
      },
      select: {
        id: true,
      },
    });

    const itemIds = items.map((item) => item.id);

    /*
    Step 2:
    Run your existing pricing engine
    */
    const results = await updatePricesForItems(itemIds);

    /*
    Step 3:
    Return success
    */
    return NextResponse.json({
      success: true,
      updatedCount: itemIds.length,
      results,
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