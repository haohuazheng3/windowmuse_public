import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutNotice, OfferBuyButton } from "@/components/CheckoutButton";
import { CreditCalculator } from "@/components/CreditCalculator";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Container, CtaPane, FaqList, Pane, Section, SectionHead } from "@/components/ui";
import { FAQS } from "@/content/faq";
import { CREDIT_RULES, PACKS, PLANS, TRIAL, formatPrice, perCreditUsd, type Offer } from "@/content/plans";
import { faqLd, pageMetadata, softwareApplicationLd } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description: `Starter ${formatPrice(PLANS.starter.priceUsd)} for ${PLANS.starter.credits} videos a month, Growth ${formatPrice(PLANS.growth.priceUsd)} for ${PLANS.growth.credits}, Pro ${formatPrice(PLANS.pro.priceUsd)} for ${PLANS.pro.credits}; packs of ${PACKS.pack10.credits} and ${PACKS.pack50.credits} credits. One credit is one 15-second 720p video. ${TRIAL.credits} free videos to start, failed generations never charged.`,
  path: "/pricing",
});

const plans: Offer[] = [PLANS.starter, PLANS.growth, PLANS.pro];
const packs: Offer[] = [PACKS.pack10, PACKS.pack50];

function PlanPane({ offer, highlighted = false }: { offer: Offer; highlighted?: boolean }) {
  const monthly = offer.interval === "month";
  return (
    <Pane className={`flex min-w-0 flex-col p-7 sm:p-8 ${highlighted ? "ring-2 ring-accent" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{offer.name}</p>
        {highlighted ? <span className="tag tag-accent">Most room to post</span> : null}
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[2.8rem] font-semibold leading-none tabular-nums text-ink" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 72' }}>
          {formatPrice(offer.priceUsd)}
        </span>
        <span className="text-[0.92rem] text-ink-4">{monthly ? "/ month" : "once"}</span>
      </p>
      <p className="mt-2 text-[1rem] text-ink-2">
        <strong className="text-ink">{offer.credits} credits</strong>
        {monthly ? " a month" : ""} · ${perCreditUsd(offer).toFixed(2)} per credit
      </p>
      <p className="mt-1 text-[0.92rem] text-ink-3">{offer.blurb}</p>
      <ul className="mt-5 space-y-2 text-[0.94rem] leading-relaxed text-ink-2">
        {offer.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        <OfferBuyButton sku={offer.sku} label={monthly ? `Subscribe to ${offer.name}` : `Buy ${offer.credits} credits`} />
        <p className="mt-2.5 text-center text-[0.8rem] text-ink-4">{CREDIT_RULES.expiryNote(offer)}</p>
      </div>
    </Pane>
  );
}

const BILLING_FAQ_QUESTIONS = ["How do credits work?", "Can I get a refund?", "Can I cancel any time?", "When would I need 1080p?", "What happens if a generation fails?"];

export default function PricingPage() {
  const faqs = FAQS.filter((f) => BILLING_FAQ_QUESTIONS.includes(f.q));
  return (
    <>
      <JsonLd data={[softwareApplicationLd([...plans, ...packs]), faqLd(faqs)]} />
      <Container className="pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]}
        />
        <div className="mx-auto mt-6 max-w-2xl text-center">
          <p className="eyebrow eyebrow-accent">Pricing</p>
          <h1 className="display mt-4 text-[2.6rem] text-ink sm:text-[3.8rem]">
            One credit, <em>one video.</em>
          </h1>
          <p className="mt-5 text-[1.12rem] leading-relaxed text-ink-3">
            A credit is one video up to 15 seconds at 720p. Longer runs cost two, 1080p doubles it, and a failed generation costs nothing.
            Start with {TRIAL.credits} free videos at {TRIAL.resolution}.
          </p>
        </div>
        <Suspense fallback={null}>
          <CheckoutNotice />
        </Suspense>
      </Container>

      <Section className="!pt-12">
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <PlanPane key={p.sku} offer={p} highlighted={p.sku === "growth"} />
          ))}
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.88rem] text-ink-4">
          <li>Stripe secure checkout</li>
          <li>Cancel any time from your studio</li>
          <li>Your statement reads a line ending in “* WINDOWMUSE”</li>
          <li>14-day refund on unused credits</li>
        </ul>
      </Section>

      <Section id="packs">
        <SectionHead
          eyebrow="Packs"
          title="No subscription? Buy credits once."
          lede="Packs last 90 days and follow the limits of the plan you are on: 720p and one video at a time without a plan, 1080p and three at a time on Growth or Pro."
        />
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          {packs.map((p) => (
            <PlanPane key={p.sku} offer={p} />
          ))}
        </div>
      </Section>

      <Section>
        <CreditCalculator />
      </Section>

      <Section>
        <SectionHead eyebrow="The rules" title="How credits behave." />
        <Pane className="p-7 sm:p-8">
          <ul className="space-y-2.5">
            {CREDIT_RULES.lines.map((l) => (
              <li key={l} className="flex gap-2.5 text-[0.98rem] leading-relaxed text-ink-2">
                <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-muse" />
                {l}
              </li>
            ))}
            <li className="flex gap-2.5 text-[0.98rem] leading-relaxed text-ink-2">
              <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-muse" />
              Growth and Pro unlock 1080p and three videos generating at once; Starter and the trial run one at a time.
            </li>
            <li className="flex gap-2.5 text-[0.98rem] leading-relaxed text-ink-2">
              <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-muse" />
              Videos stay in your studio for as long as your plan or pack is active and for 90 days after; download what you want to keep.
            </li>
          </ul>
        </Pane>
      </Section>

      <Section>
        <SectionHead eyebrow="Paying" title="The money questions." />
        <div className="grid gap-4 md:grid-cols-3">
          <Pane className="p-6">
            <p className="text-[1rem] font-semibold text-ink">Refunds</p>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-ink-3">
              A pack or plan you bought by mistake and have not used is refunded in full within 14 days. Partly used purchases are refunded
              for the unused credits. Failed videos are never charged, so they need no refund.{" "}
              <Link href="/refund-policy" className="text-accent-text underline underline-offset-4">
                Refund policy
              </Link>
            </p>
          </Pane>
          <Pane className="p-6">
            <p className="text-[1rem] font-semibold text-ink">Checkout and receipts</p>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-ink-3">
              Payments are handled by Stripe on checkout.stripe.com; we never see your card number. Stripe emails the receipt. On your
              statement the charge appears as your bank’s descriptor prefix followed by “* WINDOWMUSE”.
            </p>
          </Pane>
          <Pane className="p-6">
            <p className="text-[1rem] font-semibold text-ink">Changing plans</p>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-ink-3">
              Open Billing in your studio to upgrade, downgrade or cancel through Stripe’s portal. Credits you already have keep their expiry
              date; nothing is charged after you cancel. Questions: {SITE.email}.
            </p>
          </Pane>
        </div>
      </Section>

      <Section>
        <SectionHead eyebrow="Questions" title="Before you buy." />
        <FaqList faqs={faqs} />
      </Section>

      <Section>
        <CtaPane
          title={
            <>
              Not sure yet? <em className="!text-[#B7ADFF]">Start with the free ones.</em>
            </>
          }
          body={`${TRIAL.credits} credits at ${TRIAL.resolution}, valid ${TRIAL.expiryDays} days, no card. Add a plan or a pack when the first video earns it.`}
        />
      </Section>
    </>
  );
}
