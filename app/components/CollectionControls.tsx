import SubmitButton from "@/app/components/Submitbutton";

type Collection = {
  id: string;
  name: string;
};

type Props = {
  collections: Collection[];
  activeCollectionId: string;
  isMainCollection: boolean;
  currentView: "list" | "grid";
  switchCollection: (formData: FormData) => Promise<void>;
  createCollection: (formData: FormData) => Promise<void>;
};

export default function CollectionControls({
  collections,
  activeCollectionId,
  isMainCollection,
  currentView,
  switchCollection,
  createCollection,
}: Props) {
  return (
    <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        {/* Switch collection */}
        <form
          action={switchCollection}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="text-sm text-white/60">Collection:</div>

          <select
            name="cid"
            defaultValue={activeCollectionId}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input type="hidden" name="view" value={currentView} />

          <SubmitButton className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">
            Open
          </SubmitButton>
        </form>

        {/* Create collection */}
        <form
          action={createCollection}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input
            name="name"
            placeholder="New collection name"
            className="w-[220px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
          />

          <input type="hidden" name="view" value={currentView} />

          <SubmitButton className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">
            Create
          </SubmitButton>
        </form>
      </div>

      <div className="text-sm text-white/60">
        Active:{" "}
        {isMainCollection
          ? "Main (All Collections)"
          : collections.find((c) => c.id === activeCollectionId)?.name ?? "Main"}
      </div>
    </div>
  );
}