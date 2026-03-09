"use client";

/*
This component runs on the CLIENT because it uses:
- React state
- file input preview logic
- browser blob URLs
*/

import { useEffect, useState } from "react";
import SubmitButton from "@/app/components/Submitbutton";

/*
Props passed in from the dashboard page.

action
- Server action that handles creating the custom item/card

collections
- All collections the user can choose from

activeCollectionId
- Which collection should be selected by default when the form loads
*/
type Props = {
  action: (formData: FormData) => Promise<void>;
  collections: {
    id: string;
    name: string;
  }[];
  activeCollectionId: string;
};

export default function AddCardForm({
  action,
  collections,
  activeCollectionId,
}: Props) {
  /*
  previewUrl
  - Holds a temporary browser blob URL for image preview
  - This is only for the UI preview before submission
  */
  const [previewUrl, setPreviewUrl] = useState<string>("");

  /*
  Clean up blob URLs when previewUrl changes or component unmounts.

  Why this matters:
  URL.createObjectURL() creates a temporary browser object URL.
  If we never revoke it, memory can leak over time.
  */
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /*
  Handles local image file selection.

  Flow:
  1. Read the selected file
  2. If no file, clear preview
  3. If not an image, clear preview
  4. Revoke previous preview blob URL
  5. Create new preview blob URL
  */
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    // No file selected
    if (!file) {
      setPreviewUrl("");
      return;
    }

    // Only allow image previews
    if (!file.type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }

    // Revoke old preview URL before replacing it
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
  }

  return (
    /*
    This form submits directly to the server action passed in through props.
    Next.js will send all named form fields in FormData.
    */
    <form action={action} className="mt-3 space-y-3">
      {/* 
      Collection selector
      Lets the user choose which collection the custom item should be added to
      */}
      <select
        name="collectionId"
        defaultValue={activeCollectionId}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
      >
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/*
      File upload section
      Lets the user choose a local image file from their device
      */}
      <div className="space-y-2">
        <input
          type="file"
          name="imageFile"
          accept="image/*"
          onChange={onPickFile}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
        />

        {/*
        Preview the selected local image file before submitting the form
        */}
        {previewUrl ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-xs opacity-70">Preview</div>
            <img
              src={previewUrl}
              alt="Preview"
              className="mx-auto max-h-[220px] rounded-lg border border-white/10 bg-black/30 object-contain"
            />
          </div>
        ) : null}
      </div>

      {/*
      Optional image URL fallback
      Use this if the user wants to paste an image link instead of uploading a file
      */}
      <input
        name="imageUrl"
        placeholder="Image URL (optional)"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
      />

      {/*
      Category / game
      Examples:
      - Warhammer
      - Comics
      - Gundam
      - Pokémon
      */}
      <input
        name="game"
        placeholder="Category (ex: Warhammer, Comics, Gundam)"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
      />

      {/*
      Set / line / product family
      Examples:
      - Blood Angels
      - Starter Deck
      - Base Set
      */}
      <input
        name="set"
        placeholder="Set / Line (ex: Blood Angels, Starter Deck)"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
      />

      {/*
      Item name
      Examples:
      - Sanguinary Guard
      - RX-78-2
      - Blue Eyes White Dragon
      */}
      <input
        name="name"
        placeholder="Item name (ex: Sanguinary Guard, RX-78-2)"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
      />

      {/*
      Quantity to add
      Defaults to 1 and cannot go below 1
      */}
      <input
        name="quantity"
        type="number"
        min={1}
        defaultValue={1}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
      />

      {/*
      Submit button
      Sends the form data to the server action
      */}
      <SubmitButton
  className="mt-4 w-full rounded-xl bg-white text-black font-medium py-3 hover:bg-gray-200 transition"
>
  + Add to Collection
</SubmitButton>
    </form>
  );
}