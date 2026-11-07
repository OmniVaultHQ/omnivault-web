import { fetchPokemonSet } from "../sources/pokemon";
import { importNormalizedCatalog } from "./importNormalizedCatalog";

/*
Pokémon importer wrapper.

Purpose:
- Pokémon source fetches and normalizes the set
- Universal importer saves it into the database
*/

export async function importPokemonSet(setCode: string) {
  const normalized = await fetchPokemonSet(setCode);

  const result = await importNormalizedCatalog(normalized);

  return {
    ...result,
    setCode: normalized.collection.code ?? null,
    setName: normalized.collection.name,
  };
}