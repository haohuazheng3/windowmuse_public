"use client";

import { BuyButton, CheckoutError, useCheckout } from "@/components/CheckoutButton";
import { CREDIT_RULES, PACKS, formatPrice, perCreditUsd } from "@/content/plans";

/** One-time top-ups on the billing page; both buttons share one checkout state and error line. */
export function BillingPacks() {
  const checkout = useCheckout();
  return (
    <section className="pane p-5 sm:p-6" aria-labelledby="packs-heading">
      <h2 id="packs-heading" className="headline text-[1.35rem] text-ink">
        Buy a pack
      </h2>
      <p className="mt-1 text-[0.88rem] text-ink-4">One payment, no renewal. Pack credits use the limits of the plan you are on.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.values(PACKS).map((p) => (
          <div key={p.sku} className="pane-inset flex flex-col gap-3 px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[1.05rem] font-semibold text-ink">{p.name}</p>
              <p className="text-[1.05rem] font-semibold tabular-nums text-ink">{formatPrice(p.priceUsd)}</p>
            </div>
            <p className="text-[0.86rem] text-ink-3">
              {formatPrice(perCreditUsd(p))} per credit · {CREDIT_RULES.expiryNote(p)}
            </p>
            <BuyButton sku={p.sku} checkout={checkout} className="btn btn-primary btn-block" label={`Buy ${p.name}`} />
          </div>
        ))}
      </div>
      <CheckoutError checkout={checkout} />
    </section>
  );
}
