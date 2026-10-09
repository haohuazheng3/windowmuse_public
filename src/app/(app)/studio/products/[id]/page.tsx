import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/studio/ProductEditor";
import { categoryLabel } from "@/lib/product-schema";
import { getProduct, listAssets } from "@/lib/products";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product" };

export default async function ProductPage(props: PageProps<"/studio/products/[id]">) {
  const { id } = await props.params;
  const { userId } = await requireUser();
  const product = await getProduct(userId, id);
  if (!product) notFound();
  const assets = await listAssets(userId, product.id, { ttlSeconds: 60 * 60 });

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-[0.85rem] text-ink-4">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/studio/products" prefetch={false} className="hover:text-ink-2">
              Products
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-ink-3">
            {product.name}
          </li>
        </ol>
      </nav>
      <div>
        <p className="eyebrow eyebrow-accent">{categoryLabel(product.category)}</p>
        <h1 className="display mt-2 text-[2rem] text-ink sm:text-[2.6rem]">{product.name}</h1>
        {product.brand ? <p className="mt-2 text-[0.95rem] text-ink-3">{product.brand}</p> : null}
      </div>
      <ProductEditor product={product} assets={assets} />
    </div>
  );
}
