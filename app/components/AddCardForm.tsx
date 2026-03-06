"use client";

import { useEffect, useMemo, useState } from "react";
import SubmitButton from "@/app/components/Submitbutton";

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export default function AddCardForm({ action }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // clean up blob url
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }

    // replace old blob url (avoid memory leak)
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);

    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
  }

  return (
    <form action={action} className="mt-3 space-y-3">
      {/* File upload */}
      <div className="space-y-2">
        <input
          type="file"
          name="imageFile"
          accept="image/*"
          onChange={onPickFile}
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
        />

        {previewUrl ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs opacity-70 mb-2">Preview</div>
            <img
              src={previewUrl}
              alt="Preview"
              className="mx-auto max-h-[220px] rounded-lg border border-white/10 object-contain bg-black/30"
            />
          </div>
        ) : null}
      </div>

      {/* Optional URL fallback */}
      <input
        name="imageUrl"
        placeholder="Image URL (optional)"
        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
      />

      <input
        name="game"
        placeholder="Category (ex: Warhammer, Comics, Gundam)"
        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
      />

      <input
        name="set"
        placeholder="Set / Line (ex: Blood Angels, Starter Deck)"
        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
      />

      <input
        name="name"
        placeholder="Item name (ex: Sanguinary Guard, RX-78-2)"
        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
      />

      <input
        name="quantity"
        type="number"
        min={1}
        defaultValue={1}
        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
      />

      <SubmitButton className="w-full rounded-lg bg-white text-black py-2 font-medium hover:bg-white/90">
        + Add to Collection
      </SubmitButton>
    </form>
  );
}