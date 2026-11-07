import { NextResponse } from "next/server";
import { importPokemonSet } from "@/lib/catalog/importers/importPokemonSet";

/*
File: app/api/admin/import-all-pokemon/route.ts

Purpose:
- Bulk import MANY Pokémon sets at once
- This is how OmniVault builds a REAL catalog database

Why this exists:
- Importing one set at a time is too slow
- We want thousands of cards in minutes
- This is the foundation of your entire product

IMPORTANT:
- You can expand this list over time
- This is safe because importPokemonSet uses upsert
*/

const SET_CODES = [
  "base1",
  "base2",
  "base3",
  "base4",
  "base5",
  "gym1",
  "gym2",
  "neo1",
  "neo2",
  "neo3",
  "neo4",
  "sv1",
  "sv2",
  "sv3",
];

/*
GET /api/admin/import-all-pokemon

Run this in browser:
http://localhost:3000/api/admin/import-all-pokemon
*/
export async function GET() {
  try {
    const results = [];

    /*
    Loop through each set and import it
    */
    for (const setCode of SET_CODES) {
      console.log("IMPORTING SET:", setCode);

      const result = await importPokemonSet(setCode);

      results.push({
        setCode,
        imported: result.importedCount,
      });
    }

    /*
    Return summary
    */
    return NextResponse.json({
      success: true,
      message: "Bulk Pokémon import complete",
      results,
    });
  } catch (error) {
    console.error("BULK IMPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Bulk import failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}