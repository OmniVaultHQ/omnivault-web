import { NextResponse } from "next/server";
import { importPokemonSet } from "@/lib/catalog";

/*
Temporary test route to import a Pokémon set.

How to use:
- Start your dev server
- Visit: http://localhost:3000/api/catalog/import

This will:
- Fetch the set from Pokémon API
- Save it into your database
- Return the result
*/
export async function GET() {
  try {
    const result = await importPokemonSet("base1");

    return NextResponse.json({
      success: true,
      message: "Import completed",
      result,
    });
  } catch (error) {
    console.error("IMPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Import failed",
        error: String(error),
      },
      { status: 500 }
    );
  }
}