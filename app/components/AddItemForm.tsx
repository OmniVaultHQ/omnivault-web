"use client";

/*
This component runs on the CLIENT because it uses:
- React state
- file input preview logic
- browser blob URLs
*/

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import SubmitButton from "@/app/components/Submitbutton";

/*
Props passed in from the dashboard page.

action
- Server action that handles creating the custom item

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

export default function AddItemForm({
  action,
  collections,
  activeCollectionId,
}: Props) {
  /*
  previewUrl
  - Stores a temporary browser blob URL for local image preview
  - This is only used before the form is submitted
  */
  const [previewUrl, setPreviewUrl] = useState("");

  /*
  formRef
  - Allows us to manually reset the form after submission
  */
  const formRef = useRef<HTMLFormElement>(null);

  /*
  Cleanup when component unmounts or preview changes.

  Why:
  URL.createObjectURL() creates a temporary blob URL in memory.
  If we never revoke it, memory can slowly leak.
  */
  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /*
  Handles choosing a local file from the user's computer.

  Flow:
  1. Read the selected file
  2. If no file is selected, clear preview
  3. If the file is not an image, clear preview
  4. Revoke old preview URL
  5. Create a new preview URL
  */
  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    // If user removed the file, clear preview
    if (!file) {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl("");
      return;
    }

    // Only preview image files
    if (!file.type.startsWith("image/")) {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl("");
      return;
    }

    // Clean up old preview before creating a new one
    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);
  }

  /*
  handleSubmit
  - Runs the server action
  - Resets the form fields
  - Clears image preview

  Note:
  If your server action redirects immediately, the page refresh/navigation
  may happen before the reset is visible. That is normal.
  */
  async function handleSubmit(formData: FormData) {
    await action(formData);

    // Reset all form fields
    formRef.current?.reset();

    // Clear preview image
    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl("");
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">
      {/* =========================================
          COLLECTION
          Choose which collection receives the item
         ========================================= */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white/80">
          Collection
        </label>
        <select
          name="collectionId"
          defaultValue={activeCollectionId}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
        >
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* =========================================
          BASIC DETAILS
          Category, condition, game, set, and item name
         ========================================= */}
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80">
            Category
          </label>
          <select
            name="category"
            defaultValue=""
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
          >
            <option value="" disabled>
              Select Category
            </option>
            <option value="TCG">TCG</option>
            <option value="Miniatures">Miniatures</option>
            <option value="Comics">Comics</option>
            <option value="Models">Models</option>
            <option value="Figures">Figures</option>
            <option value="Shoes">Shoes</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* =========================================
            CONDITION
            Tracks the condition of the user's owned item
           ========================================= */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80">
            Condition
          </label>
          <select
            name="condition"
            defaultValue=""
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
          >
            <option value="">No Condition Set</option>
            <option value="Mint">Mint</option>
            <option value="Near Mint">Near Mint</option>
            <option value="Lightly Played">Lightly Played</option>
            <option value="Moderately Played">Moderately Played</option>
            <option value="Heavily Played">Heavily Played</option>
            <option value="Damaged">Damaged</option>
            <option value="Sealed">Sealed</option>
            <option value="Opened">Opened</option>
            <option value="Painted">Painted</option>
            <option value="Unpainted">Unpainted</option>
            <option value="Assembled">Assembled</option>
            <option value="New">New</option>
            <option value="Used">Used</option>
            <option value="Custom">Custom</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80">
            Game / Brand
          </label>
          <input
            name="game"
            placeholder="Warhammer, Gundam, Pokémon..."
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80">
            Set / Line
          </label>
          <input
            name="set"
            placeholder="Blood Angels, Starter Deck, Base Set..."
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80">
            Item Name
          </label>
          <input
            name="name"
            placeholder="Sanguinary Guard, RX-78-2 Gundam..."
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
          />
        </div>
      </div>

      {/* =========================================
          VALUE FIELDS
          Quantity and purchase price grouped together
         ========================================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80">
            Quantity
          </label>
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80">
            Purchase Price
          </label>
          <input
            type="number"
            name="purchasePrice"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
          />
        </div>
      </div>

      {/* =========================================
          IMAGE SECTION
          Upload file or paste image URL
         ========================================= */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-white/85">Item Image</h4>
          <p className="mt-1 text-xs text-white/50">
            Upload an image from your computer or paste an image URL below.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="file"
            name="imageFile"
            accept="image/*"
            onChange={onPickFile}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none"
          />

          <input
            name="imageUrl"
            placeholder="Image URL (optional)"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400/40"
          />

          {/* Preview of local uploaded file */}
          {previewUrl ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 text-xs text-white/60">Preview</div>
              <img
                src={previewUrl}
                alt="Preview"
                className="mx-auto max-h-[220px] rounded-lg border border-white/10 bg-black/20 object-contain"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* =========================================
          SUBMIT AREA
          Stronger CTA for adding the item
         ========================================= */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 text-xs text-white/50">
          Add this item to the selected collection and track its quantity, cost
          basis, and condition.
        </div>

        <SubmitButton className="w-full rounded-xl bg-white py-3 font-medium text-black transition hover:bg-gray-200">
          + Add Item to Collection
        </SubmitButton>
      </div>
    </form>
  );
}