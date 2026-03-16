import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Optional: cid=collectionId
  const url = new URL(req.url);
  const cid = (url.searchParams.get("cid") ?? "").trim();

  const rows = await prisma.collectionItem.findMany({
    where: cid ? { userId, collectionId: cid } : { userId },
    include: { item: true },
    orderBy: { id: "desc" },
  });

  const headers = [
    "Name",
    "Game",
    "Set",
    "Category",
    "Quantity",
    "Purchase Price",
    "Market Price",
    "Total Value",
  ];

  const lines = rows.map((r) => {
    const purchase = r.purchasePrice ?? 0;
    const market = r.marketPrice ?? 0;
    const total = market * r.quantity;

    return [
      csvEscape(r.item.name),
      csvEscape(r.item.game),
      csvEscape(r.item.set),
      csvEscape(r.item.category ?? ""),
      csvEscape(r.quantity),
      csvEscape(purchase),
      csvEscape(market),
      csvEscape(total.toFixed(2)),
    ].join(",");
  });

  const csv = [headers.join(","), ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="omnivault-export.csv"`,
    },
  });
}