import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultCollection } from "@/lib/collections";
import CatalogSearch from "@/app/components/CatalogSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  const defaultCollection = await getOrCreateDefaultCollection(userId);

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <CatalogSearch
        collections={collections}
        activeCollectionId={defaultCollection.id}
      />
    </div>
  );
}