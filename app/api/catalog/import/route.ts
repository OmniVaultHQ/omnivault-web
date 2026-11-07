import { NextRequest, NextResponse } from "next/server";
import { importPokemonSet } from "@/lib/catalog";

/*
Temporary test route to import one Pokémon set.

How to use:
- Start your dev server
- Visit:
  http://localhost:3000/api/catalog/import?setCode=base1

Examples:
- base1
- base2
- neo1
- sv1

This will:
- fetch the set from the Pokémon API
- save it into your database
- return the result
*/
export async function GET(request: NextRequest) {
  try {
    /*
    Read set code from query string.
    Default to base1 so the route still works if no code is passed.
    */
    const { searchParams } = new URL(request.url);
    const setCode = searchParams.get("setCode")?.trim() || "base1";

    const result = await importPokemonSet(setCode);

    return NextResponse.json({
      success: true,
      message: `Import completed for set "${setCode}"`,
      result,
    });
  } catch (error) {
    console.error("IMPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Import failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}