import type { NormalizedCatalogImport } from "../types";

/*
Small helper types for the Pokémon TCG API response.

We only include fields we actually use right now.
This keeps the file easier to understand.
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

const POKEMON_API_BASE = "https://api.pokemontcg.io/v2";

/*
Fetch ALL cards for one Pokémon set from the public Pokémon TCG API.

Why this exists:
- the API is paginated
- some sets may eventually need more than one request
- importer should be safe and complete
*/
async function fetchAllCardsForSet(setCode: string): Promise<PokemonCardApiItem[]> {
  const allCards: PokemonCardApiItem[] = [];

  let page = 1;
  const pageSize = 250;
  let totalCount = 0;

  while (true) {
    const url =
      `${POKEMON_API_BASE}/cards?q=set.id:${encodeURIComponent(setCode)}` +
      `&page=${page}&pageSize=${pageSize}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Pokémon API request failed: ${response.status}`);
    }

    const json = (await response.json()) as PokemonCardsApiResponse;

    if (!json.data || json.data.length === 0) {
      break;
    }

    allCards.push(...json.data);
    totalCount = json.totalCount ?? allCards.length;

    if (allCards.length >= totalCount) {
      break;
    }

    page += 1;
  }

  return allCards;
}

/*
Fetch one Pokémon set and normalize it into OmniVault's catalog format.

Example set codes:
- base1
- base2
- neo1
- sv1
*/
export async function fetchPokemonSet(
  setCode: string
): Promise<NormalizedCatalogImport> {
  const cards = await fetchAllCardsForSet(setCode);

  if (!cards.length) {
    throw new Error(`No Pokémon cards found for set code "${setCode}"`);
  }

  /*
  Use the first card's set block as the collection/set info,
  since all cards returned belong to the same set.
  */
  const firstCard = cards[0];
  const setInfo = firstCard.set;

  return {
    collection: {
      sourceKey: "pokemon-tcg",
      sourceName: "Pokémon TCG",
      sourceCategory: "cards",
      externalId: setInfo.id,
      name: setInfo.name,
      code: setInfo.id,
      type: "set",
      releaseDate: setInfo.releaseDate ? new Date(setInfo.releaseDate) : null,
      imageUrl: setInfo.images?.logo ?? setInfo.images?.symbol ?? null,
      metadata: {
        series: setInfo.series ?? null,
        printedTotal: setInfo.printedTotal ?? null,
        total: setInfo.total ?? null,
      },
    },

    items: cards.map((card) => ({
      externalId: card.id,
      externalUrl: null,
      name: card.name,
      category: "card",
      game: "Pokémon",
      set: card.set.name,
      setCode: card.set.id,
      itemNumber: card.number ?? null,
      rarity: card.rarity ?? null,
      imageUrl: card.images?.large ?? card.images?.small ?? null,
      metadata: {
        pokemonTcgId: card.id,
      },
    })),
  };
}