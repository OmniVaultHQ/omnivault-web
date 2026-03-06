import CatalogSearch from "@/app/components/CatalogSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function CatalogPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <CatalogSearch />
    </div>
  );
}