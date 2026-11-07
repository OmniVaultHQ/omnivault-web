"use client";

import { useEffect, useState } from "react";

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [setCode, setSetCode] = useState("base1");
  const [status, setStatus] = useState("");
  const [pokemonSets, setPokemonSets] = useState<
  { id: string; name: string }[]
>([]);

  useEffect(() => {
  async function loadPokemonSets() {
    try {
      const response = await fetch("/api/pokemon/sets");

      const data = await response.json();

      if (data.success) {
        setPokemonSets(data.sets);
      }
    } catch (err) {
      console.error("Failed to load Pokémon sets.", err);
    }
  }

  loadPokemonSets();
}, []);

  async function importPokemonSet() {
    setStatus("Importing Pokémon set...");

    try {
      const response = await fetch(
        `/api/admin/import-pokemon-set?setCode=${setCode}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Pokémon import failed");
      }

      setStatus(`Imported ${data.importedCount} cards from ${data.setName}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Pokémon import failed");
    }
  }

  async function uploadCsv() {
    if (!file) {
      setStatus("Choose a CSV file first.");
      return;
    }

    setStatus("Uploading CSV...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/import-item", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "CSV upload failed");
      }

      setStatus(`CSV imported successfully. Imported ${data.count ?? "items"}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "CSV upload failed");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="mb-6 text-2xl font-bold">Admin Import</h1>

        {/* Pokémon Import Section */}
        <div className="mb-8 rounded-lg border border-white/10 bg-black/20 p-4">
          <h2 className="mb-4 text-xl font-bold">Import Pokémon Set</h2>

          <label className="mb-2 block text-sm">Set Code</label>

          <select
            value={setCode}
            onChange={(e) => setSetCode(e.target.value)}
            className="mb-4 w-full rounded border border-white/20 bg-black/30 px-3 py-2"
          >
            {pokemonSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>

          <button
            onClick={importPokemonSet}
            className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/10"
          >
            Import Pokémon Set
          </button>
        </div>

        {/* CSV Import Section */}
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <h2 className="mb-4 text-xl font-bold">CSV Import</h2>

          <p className="mb-4 text-sm opacity-70">
            Upload a CSV with columns:
            <br />
            <code>itemNumber,name,set,game,imageUrl,rarity,setCode</code>
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mb-4"
          />

          <br />

          <button
            onClick={uploadCsv}
            className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/10"
          >
            Upload CSV
          </button>
        </div>

        {status && <div className="mt-6 text-sm opacity-80">{status}</div>}
      </div>
    </main>
  );
}