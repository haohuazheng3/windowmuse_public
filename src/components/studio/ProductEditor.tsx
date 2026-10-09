"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProduct, updateProduct } from "@/app/(app)/studio/products/actions";
import type { ProductInput } from "@/lib/product-schema";
import type { AssetView, ProductView } from "@/lib/products";
import { PhotosPane, itemsFromAssets } from "./PhotosPane";
import { ProductForm } from "./ProductForm";

/** The product page: edit the details, manage photos, start a video, or delete with a confirm step. */
export function ProductEditor({ product, assets }: { product: ProductView; assets: AssetView[] }) {
  const router = useRouter();
  const [items, setItems] = useState(() => itemsFromAssets(assets));
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const save = async (input: ProductInput) => {
    const r = await updateProduct(product.id, input);
    if (r.ok) router.refresh();
    return r;
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    const r = await deleteProduct(product.id);
    if (!r.ok) {
      setDeleting(false);
      setDeleteError(r.error);
      return;
    }
    router.push("/studio/products");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/studio/new?product=${encodeURIComponent(product.id)}`} prefetch={false} className="btn btn-primary">
          Make a video with this product
        </Link>
        <Link href="/studio/products" prefetch={false} className="btn btn-quiet">
          All products
        </Link>
      </div>

      <section className="pane p-5 sm:p-6" aria-labelledby="product-details">
        <h2 id="product-details" className="headline text-[1.25rem] text-ink">
          Details
        </h2>
        <p className="mt-0.5 text-[0.88rem] text-ink-3">What the presenter knows about the product. Changes apply to the next script you write.</p>
        <div className="mt-5">
          <ProductForm initial={product} submitLabel="Save changes" busyLabel="Saving…" onSubmit={save} savedNote="Saved." />
        </div>
      </section>

      <PhotosPane productId={product.id} items={items} setItems={setItems} confirmed={false} onConfirmedChange={() => undefined} showConfirm={false} />

      <section className="pane p-5 sm:p-6" aria-labelledby="product-delete">
        <h2 id="product-delete" className="headline text-[1.25rem] text-ink">
          Delete this product
        </h2>
        {confirming ? (
          <div className="mt-3 rounded-[20px] bg-bad-soft px-4 py-4">
            <p className="text-[0.95rem] text-ink">
              Delete <span className="font-semibold">{product.name}</span>? Its photos are removed from storage right away. Finished videos stay in your library.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn btn-primary !bg-bad" disabled={deleting} aria-busy={deleting} onClick={() => void remove()}>
                {deleting ? <span className="spinner" aria-hidden="true" /> : null}
                {deleting ? "Deleting…" : "Yes, delete it"}
              </button>
              <button type="button" className="btn btn-ghost" disabled={deleting} onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
            {deleteError ? (
              <p role="alert" className="mt-3 text-[0.88rem] text-bad">
                {deleteError}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" className="btn btn-ghost !text-bad" onClick={() => setConfirming(true)}>
              Delete product
            </button>
            <p className="text-[0.85rem] text-ink-4">Asks once more before anything happens.</p>
          </div>
        )}
      </section>
    </div>
  );
}
