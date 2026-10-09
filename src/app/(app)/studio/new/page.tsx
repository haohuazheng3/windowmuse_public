import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateFlowLoader } from "@/components/studio/CreateFlowLoader";
import { getProduct, listAssets, listProducts } from "@/lib/products";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New video" };

export default async function NewVideoPage(props: PageProps<"/studio/new">) {
  const sp = await props.searchParams;
  const requested = typeof sp.product === "string" && sp.product.length > 0 ? sp.product : null;
  const startWithNewProduct = sp.new === "1";
  const { userId } = await requireUser();
  const [products, product] = await Promise.all([listProducts(userId), requested ? getProduct(userId, requested) : Promise.resolve(null)]);
  if (requested && !product) redirect("/studio/new");
  const assets = product ? await listAssets(userId, product.id, { ttlSeconds: 60 * 60 }) : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow eyebrow-accent">New video</p>
        <h1 className="display mt-2 text-[2.2rem] text-ink sm:text-[2.8rem]">
          Five panes, <em>one video.</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink-3">
          Product, photos, presenter, script, generate. Everything saves as you go; the link in your address bar brings you back to this product.
        </p>
      </div>
      <CreateFlowLoader key={product?.id ?? "none"} products={products} product={product} assets={assets} startWithNewProduct={startWithNewProduct} />
    </div>
  );
}
