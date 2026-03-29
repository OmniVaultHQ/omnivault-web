import type { NormalizedCatalogImport } from "../types";

/*
Pokémon source adapter

File: lib/sources/pokemon.ts

Purpose:
- Talks to the public Pokémon TCG API
- Downloads all cards for one set
- Converts raw API data into OmniVault's normalized catalog format

Why this file exists:
- External APIs all return data in different shapes
- OmniVault should convert them into ONE shared format
- That way the importer can stay clean and reusable
*/

/*
Small helper types for the Pokémon TCG API response.

We only include fields OmniVault actually uses right now.
This keeps the file easier to read and maintain.
*/
type PokemonCardApiItem = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images?: {
    small?: string;
    large?: string;
  };
  set: {
    id: string;
    name: string;
    series?: string;
    printedTotal?: number;
    total?: number;
    releaseDate?: string;
    images?: {
      symbol?: string;
      logo?: string;
    };
  };
};

type PokemonCardsApiResponse = {
  data: PokemonCardApiItem[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
};

/*
Base URL for the public Pokémon TCG API
*/
const POKEMON_API_BASE = "https://api.pokemontcg.io/v2";

/*
Fetch ALL cards for one Pokémon set.

Why this helper exists:
- the API is paginated
- one set can contain many cards
- importer needs the full set, not just the first page
*/
async function fetchAllCardsForSet(
  setCode: string
): Promise<PokemonCardApiItem[]> {
  const allCards: PokemonCardApiItem[] = [];

  let page = 1;
  const pageSize = 250;
  let totalCount = 0;

  while (true) {
    /*
    Example final URL:
    /cards?q=set.id:base1&page=1&pageSize=250
    */
    const url =
      `${POKEMON_API_BASE}/cards?q=set.id:${encodeURIComponent(setCode)}` +
      `&page=${page}&pageSize=${pageSize}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },

      /*
      We do not want stale cached API data while importing
      */
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Pokémon API request failed: ${response.status}`);
    }

    const json = (await response.json()) as PokemonCardsApiResponse;

    /*
    Stop if API returned no cards
    */
    if (!json.data || json.data.length === 0) {
      break;
    }

    allCards.push(...json.data);
    totalCount = json.totalCount ?? allCards.length;

    /*
    Stop once we have downloaded everything
    */
    if (allCards.length >= totalCount) {
      break;
    }

    page += 1;
  }

  return allCards;
}

/*
Fetch one Pokémon set and normalize it into OmniVault's shared catalog format.

Examples:
- base1
- base2
- neo1
- sv1

What this returns:
- collection = the set itself
- items = every card in that set

This normalized structure is later consumed by:
lib/catalog/importers/importPokemonSet.ts
*/
export async function fetchPokemonSet(
  setCode: string
): Promise<NormalizedCatalogImport> {
  /*
  Step 1:
  Download all cards for the requested set
  */
  const cards = await fetchAllCardsForSet(setCode);

  if (!cards.length) {
    throw new Error(`No Pokémon cards found for set code "${setCode}"`);
  }

  /*
  Step 2:
  Use the first card's set block as the shared set info

  Why this is safe:
  all cards returned from this API call belong to the same set
  */
  const firstCard = cards[0];
  const setInfo = firstCard.set;

  /*
  Step 3:
  Convert the Pokémon API response into OmniVault's normalized structure
  */
  return {
    collection: {
      /*
      Master source info
      */
      sourceKey: "pokemon-tcg",
      sourceName: "Pokémon TCG",
      sourceCategory: "cards",

      /*
      Set / collection info
      */
      externalId: setInfo.id,
      name: setInfo.name,
      code: setInfo.id,
      type: "set",
      releaseDate: setInfo.releaseDate ? new Date(setInfo.releaseDate) : null,
      imageUrl: setInfo.images?.logo ?? setInfo.images?.symbol ?? null,

      /*
      Flexible metadata for future use
      */
      metadata: {
        series: setInfo.series ?? null,
        printedTotal: setInfo.printedTotal ?? null,
        total: setInfo.total ?? null,
      },
    },

    /*
    Convert each Pokémon card into one OmniVault catalog item
    */
    items: cards.map((card) => ({
      externalId: card.id,
      externalUrl: null,

      /*
      Main display fields
      */
      name: card.name,
      category: "card",
      game: "Pokémon",
      set: card.set.name,
      setCode: card.set.id,
      itemNumber: card.number ?? null,
      rarity: card.rarity ?? null,
      imageUrl: card.images?.large ?? card.images?.small ?? null,

      /*
      Flexible metadata for future feature growth
      */
      metadata: {
        pokemonTcgId: card.id,
      },
    })),
  };
}