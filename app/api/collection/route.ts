import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure a default collection exists
  const existing = await prisma.collection.findFirst({ where: { userId } });
  if (!existing) {
    await prisma.collection.create({
      data: { userId, name: "Main" },
    });
  }

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ collections });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const collection = await prisma.collection.create({
    data: { userId, name },
  });

  return NextResponse.json({ collection });
}