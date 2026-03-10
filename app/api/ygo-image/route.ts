import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();

  if (!name) return NextResponse.json({ imageUrl: null });

  const url = `https://db.ygoprodeck.com/api/v7/iteminfo.php?name=${encodeURIComponent(
    name
  )}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ imageUrl: null });

    const data = await res.json();
    const imageUrl = data?.data?.[0]?.item_images?.[0]?.image_url ?? null;

    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}