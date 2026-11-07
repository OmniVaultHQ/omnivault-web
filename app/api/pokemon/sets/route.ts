import { NextResponse } from "next/server";
import { fetchPokemonSets } from "@/lib/catalog/sources/pokemon";

export async function GET() {
  try {
    const sets = await fetchPokemonSets();

    return NextResponse.json({
      success: true,
      sets,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch Pokémon sets.",
      },
      {
        status: 500,
      }
    );
  }
}