import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Row = {
  itemNumber?: string;
  name?: string;
  set?: string;
  game?: string;
  imageUrl?: string;
  rarity?: string;
  setCode?: string;
};

// Robust-ish CSV parser (handles quotes)
function parseCSV(text: string): Row[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const obj: any = {};

    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });

    rows.push(obj);
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseCSV(text);

    if (!parsed.length) {
      return NextResponse.json(
        { error: "CSV appears empty (needs header + at least 1 row)" },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;

    for (const r of parsed) {
      const itemNumber = (r.itemNumber ?? "").trim() || null;
      const name = (r.name ?? "").trim();
      const set = (r.set ?? "").trim();
      const game = (r.game ?? "").trim();
      const imageUrl = (r.imageUrl ?? "").trim() || null;
      const rarity = (r.rarity ?? "").trim() || null;
      const setCode = (r.setCode ?? "").trim() || null;

      // Minimum required fields
      if (!name || !set || !game) {
        skipped++;
        continue;
      }

      // Find an existing catalog item with same name + set + game
      const existingItem = await prisma.item.findFirst({
        where: {
          name,
          set,
          game,
        },
      });

      if (existingItem) {
        await prisma.item.update({
          where: { id: existingItem.id },
          data: {
            imageUrl,
            rarity,
            setCode,
            itemNumber,
          },
        });
      } else {
        await prisma.item.create({
          data: {
            name,
            set,
            game,
            imageUrl,
            rarity,
            setCode,
            itemNumber,
            isCustom: false,
          },
        });
      }

      imported++;
    }

    return NextResponse.json({ imported, skipped });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Import failed" },
      { status: 500 }
    );
  }
}