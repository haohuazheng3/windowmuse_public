import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { categoryLabel } from "@/lib/product-schema";
import { listProducts } from "@/lib/products";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

function day(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ProductsPage() {
  const { userId } = await requireUser();
  const products = await listProducts(userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow eyebrow-accent">Products</p>
          <h1 className="display mt-2 text-[2.2rem] text-ink sm:text-[2.8rem]">What you sell</h1>
          <p className="mt-2 text-[0.95rem] text-ink-3">Each product keeps its photos and selling points, so the next video starts from step three.</p>
        </div>
        <Link href="/studio/new?new=1" prefetch={false} className="btn btn-primary">
          New product
        </Link>
      </div>
      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          body="A product is a name, a category, one to five selling points and a few photos. Creating one is the first step of a new video."
          action={
            <Link href="/studio/new?new=1" prefetch={false} className="btn btn-primary">
              Add your first product
            </Link>
          }
        />
      ) : (
        <div className="pane-grid">
          {products.map((p) => (
            <Link key={p.id} href={`/studio/products/${p.id}`} prefetch={false} className="pane pane-hover flex min-w-0 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="tag">{categoryLabel(p.category)}</span>
                <span className="text-[0.78rem] text-ink-4 tabular-nums">{p.photoCount} {p.photoCount === 1 ? "photo" : "photos"}</span>
              </div>
              <p className="mt-1 truncate text-[1.05rem] font-semibold text-ink">{p.name}</p>
              {p.brand ? <p className="truncate text-[0.86rem] text-ink-3">{p.brand}</p> : null}
              <p className="line-clamp-2 text-[0.86rem] leading-snug text-ink-4">{p.sellingPoints[0]}</p>
              <p className="mt-auto pt-2 text-[0.78rem] text-ink-4">Updated {day(p.updatedAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
