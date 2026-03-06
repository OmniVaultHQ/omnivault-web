import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import AddCardForm from "@/app/components/AddCardForm";
import SubmitButton from "@/app/components/Submitbutton";
import type { Prisma } from "@prisma/client";

// ✅ Step 1 helper (you created lib/collections.ts)
import { getOrCreateDefaultCollection } from "@/lib/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParamsMaybePromise =
  | { q?: string | string[]; cat?: string | string[]; cid?: string | string[] }
  | Promise<{ q?: string | string[]; cat?: string | string[]; cid?: string | string[] } | undefined>
  | undefined;

function normalizeStr(v: unknown) {
  if (!v) return "";
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v);
}

type CollectionItemWithCard = Prisma.CollectionItemGetPayload<{
  include: {
    card: {
      include: {
        prices: true;
      };
    };
  };
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParamsMaybePromise;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Next can hand searchParams as a Promise in some versions
  const sp: any =
    searchParams && typeof (searchParams as any).then === "function"
      ? await (searchParams as any)
      : searchParams ?? {};

  const q = normalizeStr(sp?.q).trim();
  const cat = normalizeStr(sp?.cat).trim();
  const cid = normalizeStr(sp?.cid).trim();

  // ----------------------------
  // ✅ Collections
  // ----------------------------
  const defaultCollection = await getOrCreateDefaultCollection(userId);

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const activeCollectionId =
    collections.some((c) => c.id === cid) ? cid : defaultCollection.id;

  // ----------------------------
  // Server Actions
  // ----------------------------

  async function logout() {
    "use server";
    redirect("/api/auth/signout");
  }

  async function createCollection(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;

    const created = await prisma.collection.create({
      data: {
        userId,
        name,
      },
    });

    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${created.id}`);
  }

  async function switchCollection(formData: FormData) {
    "use server";
    const next = String(formData.get("cid") ?? "").trim();
    if (!next) redirect("/dashboard");
    redirect(`/dashboard?cid=${next}`);
  }

  // ✅ Add Card into ACTIVE collection
  async function addCard(formData: FormData) {
    "use server";

    const gameRaw = String(formData.get("game") ?? "").trim();
    const setRaw = String(formData.get("set") ?? "").trim();
    const nameRaw = String(formData.get("name") ?? "").trim();
    const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();
    const qtyRaw = Number(formData.get("quantity") ?? 1);

    const game = gameRaw.toLowerCase();
    const set = setRaw.toLowerCase();
    const name = nameRaw;
    const imageUrl = imageUrlRaw || null;
    const quantity = Number.isFinite(qtyRaw) ? Math.max(1, qtyRaw) : 1;

    if (!game || !set || !name) return;

    // Create custom card
    const card = await prisma.card.create({
      data: {
        name,
        set,
        game,
        imageUrl,
        isCustom: true,
        createdByUserId: userId,
      } as any,
    });

    // Add/increment in ACTIVE collection
    await prisma.collectionItem.upsert({
      where: {
        collectionId_cardId: {
          collectionId: activeCollectionId,
          cardId: card.id,
        },
      },
      create: {
  userId,
  collectionId: activeCollectionId,
  cardId: card.id,
  quantity,
},
      update: {
        quantity: { increment: quantity },
      },
    });

    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${activeCollectionId}`);
  }

  async function incQty(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    await prisma.collectionItem.update({
      where: { id },
      data: { quantity: { increment: 1 } },
    });

    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${activeCollectionId}`);
  }

  async function decQty(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const row = await prisma.collectionItem.findUnique({ where: { id } });
    if (!row) return;

    if (row.quantity <= 1) {
      await prisma.collectionItem.delete({ where: { id } });
    } else {
      await prisma.collectionItem.update({
        where: { id },
        data: { quantity: { decrement: 1 } },
      });
    }

    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${activeCollectionId}`);
  }

  async function deleteItem(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    await prisma.collectionItem.delete({ where: { id } });
    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${activeCollectionId}`);
  }

  async function savePurchasePrice(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const purchasePriceRaw = String(formData.get("purchasePrice") ?? "").trim();
    if (!id) return;

    const purchasePrice =
      purchasePriceRaw === "" ? null : Number(purchasePriceRaw);
    if (purchasePriceRaw !== "" && !Number.isFinite(purchasePrice)) return;

    await prisma.collectionItem.update({
      where: { id },
      data: { purchasePrice },
    });

    revalidatePath("/dashboard");
    redirect(`/dashboard?cid=${activeCollectionId}`);
  }

  // ----------------------------
  // Data (ONLY active collection items)
  // ----------------------------

  const items: CollectionItemWithCard[] = await prisma.collectionItem.findMany({
    where: { collectionId: activeCollectionId },
    orderBy: { id: "desc" },
    include: {
      card: {
        include: {
          prices: {
            orderBy: { lastUpdated: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const categories = Array.from(
    new Set(items.map((i) => i.card?.game).filter(Boolean))
  ).sort();

  const filtered = items.filter((i) => {
    if (cat && i.card.game !== cat) return false;
    if (!q) return true;
    const hay = `${i.card.name} ${i.card.set} ${i.card.game}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const totalUnique = items.length;
  const totalOwned = items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);

  const collectionValue = items.reduce((sum, i) => {
    const market = i.card.prices?.[0]?.marketPrice ?? 0;
    return sum + market * i.quantity;
  }, 0);

  // ----------------------------
  // UI
  // ----------------------------

  return (
    <div className="mx-auto max-w-8xl px-6 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <div className="mt-1 text-sm opacity-70">
              {session?.user?.email ?? ""}
            </div>
          </div>

          <form action={logout}>
            <SubmitButton className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
              Logout
            </SubmitButton>
          </form>
        </div>

        {/* Collections */}
        <div className="mt-4 flex items-center gap-3">
          <form action={switchCollection} className="flex items-center gap-2">
            <div className="text-sm opacity-70">Collection:</div>
            <select
              name="cid"
              defaultValue={activeCollectionId}
              className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">
              Open
            </SubmitButton>
          </form>

          <form action={createCollection} className="flex items-center gap-2">
            <input
              name="name"
              placeholder="New collection name"
              className="w-[220px] rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
            />
            <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">
              Create
            </SubmitButton>
          </form>

          <div className="text-xs opacity-60">
            Active:{" "}
            {collections.find((c) => c.id === activeCollectionId)?.name ?? "Main"}
          </div>
        </div>

        {/* Add Card */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Add Card</h2>
          <div className="mt-3">
            <AddCardForm action={addCard} />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs opacity-70">Total Unique Items</div>
            <div className="mt-1 text-2xl font-bold">{totalUnique}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs opacity-70">Total Items Owned</div>
            <div className="mt-1 text-2xl font-bold">{totalOwned}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs opacity-70">Collection Value</div>
            <div className="mt-1 text-2xl font-bold">
              ${collectionValue.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Your Collection</h2>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* category filter */}
            <form className="flex gap-2" method="GET">
              <input type="hidden" name="cid" value={activeCollectionId} />
              <select
                name="cat"
                defaultValue={cat || ""}
                className="min-w-[220px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <SubmitButton className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
                Filter
              </SubmitButton>
            </form>

            {/* search */}
            <form className="flex gap-2" method="GET">
              <input type="hidden" name="cid" value={activeCollectionId} />
              {cat ? <input type="hidden" name="cat" value={cat} /> : null}
              <input
                name="q"
                defaultValue={q}
                placeholder="Type search... then press Enter"
                className="min-w-[240px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none"
              />
              <SubmitButton className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
                Search
              </SubmitButton>
            </form>
          </div>

          <div className="mt-2 text-xs opacity-60">
            Press Enter to apply. Use clear to reset.
          </div>

          {/* List */}
          <div className="mt-4 space-y-3">
            {filtered.map((i) => {
              const card = i.card;
              const market = card.prices?.[0]?.marketPrice ?? 0;

              return (
                <div
                  key={i.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                      {card.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div>
                      <div className="font-semibold">
                        {card.name}{" "}
                        <span className="opacity-70">x {i.quantity}</span>
                      </div>
                      <div className="text-xs opacity-70">
                        {card.game} • {card.set}
                        {card.isCustom ? (
                          <span className="ml-2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                            Custom
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs opacity-70 w-[54px] text-right">
                      ${market.toFixed(2)}
                    </div>

                    {/* save purchase price */}
                    <form action={savePurchasePrice} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={i.id} />
                      <input
                        name="purchasePrice"
                        defaultValue={(i as any).purchasePrice ?? ""}
                        placeholder="Price"
                        className="w-[90px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                      />
                      <SubmitButton className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                        Save
                      </SubmitButton>
                    </form>

                    <form action={incQty}>
                      <input type="hidden" name="id" value={i.id} />
                      <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                        +1
                      </SubmitButton>
                    </form>

                    <form action={decQty}>
                      <input type="hidden" name="id" value={i.id} />
                      <SubmitButton className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                        -1
                      </SubmitButton>
                    </form>

                    <form action={deleteItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <SubmitButton className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm hover:bg-red-500/20">
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm opacity-70">
                No items match your filters.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}