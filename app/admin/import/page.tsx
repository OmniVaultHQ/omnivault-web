"use client";

import { useState } from "react";

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  async function onUpload() {
    if (!file) return;

    setStatus("Uploading...");

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/import-cards", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setStatus(`Error: ${data?.error ?? "Upload failed"}`);
      return;
    }

    setStatus(
      `Imported: ${data.imported}, Updated: ${data.updated}, Skipped: ${data.skipped}`
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold mb-2">
          Admin Import (Gundam Catalog)
        </h1>

        <p className="text-sm opacity-70 mb-4">
          Upload a CSV with columns:
          <br />
          <code>
            cardNumber,name,set,game,imageUrl,rarity,setCode
          </code>
        </p>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mb-4"
        />

        <br />

        <button
          onClick={onUpload}
          className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2"
        >
          Upload CSV
        </button>

        {status && (
          <div className="mt-4 text-sm opacity-80">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}