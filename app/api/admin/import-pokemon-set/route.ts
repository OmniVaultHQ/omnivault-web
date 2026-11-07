import { NextRequest, NextResponse } from "next/server";
import { importPokemonSet } from "@/lib/catalog/importers/importPokemonSet";

/*
File: app/api/admin/import-pokemon-set/route.ts

Purpose:
- Imports one Pokémon set from the Pokémon TCG API
- Saves the normalized data into OmniVault catalog tables

Example URL:
- /api/admin/import-pokemon-set?setCode=base1
- /api/admin/import-pokemon-set?setCode=base2

Important:
- This route is separate from CSV import
- CSV import stays in:
  app/api/admin/import-item/route.ts
*/
export async function GET(req: NextRequest) {
  try {
    /*
    Step 1:
    Read the set code from the URL
    */
    const { searchParams } = new URL(req.url);
    const setCode = searchParams.get("setCode")?.trim();

    if (!setCode) {
      return NextResponse.json(
        { error: "Missing setCode" },
        { status: 400 }
      );
    }

    /*
    Step 2:
    Run the Pokémon importer
    */
    const result = await importPokemonSet(setCode);

    /*
    Step 3:
    Return success JSON to the browser
    */
    return NextResponse.json({
      success: true,
      message: `Imported Pokémon set: ${setCode}`,
      ...result,
    });
  } catch (error) {
    console.error("POKEMON IMPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Pokémon set import failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}