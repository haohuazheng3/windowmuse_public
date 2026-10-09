import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { PACKS, PLANS, TRIAL, formatPrice } from "@/content/plans";
import { pageMetadata } from "@/lib/seo";
import { CONTENT_UPDATED, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Refund policy",
  description:
    "Failed videos are never charged. Unused packs and plans are refunded in full within 14 days; partly used ones for the unused credits. How to ask, how long it takes, what happens to credits, and when a refund is not possible.",
  path: "/refund-policy",
});

const SUMMARY: { title: string; body: string }[] = [
  { title: "A video failed", body: "Nothing to refund: the reservation is released automatically and your balance is back to what it was." },
  { title: "Bought, not used, within 14 days", body: "Full refund of the pack or of the current billing month of the plan, no questions." },
  { title: "Bought, partly used, within 14 days", body: "Refund of the unused credits at the price per credit you paid." },
  { title: "Videos you generated and kept", body: "Not refundable: the model was run and the credit did its job. Tell us if the video is wrong; we often regenerate it for free." },
];

export default function RefundPolicyPage() {
  const per10 = (PACKS.pack10.priceUsd / PACKS.pack10.credits).toFixed(2);
  return (
    <LegalPage
      title="Refund policy"
      path="/refund-policy"
      updated={CONTENT_UPDATED}
      intro="Short version: you pay for videos that succeed, nothing else. If you bought credits and did not use them, ask within 14 days and the money comes back. If you used some, the unused part comes back. If a video is wrong, say so; we would rather fix it than argue."
      aside={
        <div className="grid gap-3 sm:grid-cols-2">
          {SUMMARY.map((s) => (
            <div key={s.title} className="pane p-5">
              <p className="text-[0.98rem] font-semibold text-ink">{s.title}</p>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-3">{s.body}</p>
            </div>
          ))}
        </div>
      }
    >
      <h2>Failed generations cost nothing</h2>
      <p>
        When you press Generate, the credits for that video are reserved, not charged. If the video fails, is cancelled, or has not
        finished after two hours, the reservation is released and your balance shows the credits again, without you asking. This is the
        most common “refund” and it needs no email.
      </p>

      <h2>Packs</h2>
      <p>
        A pack ({PACKS.pack10.credits} credits for {formatPrice(PACKS.pack10.priceUsd)}, {PACKS.pack50.credits} for{" "}
        {formatPrice(PACKS.pack50.priceUsd)}) is refunded in full if none of its credits has been used and you ask within{" "}
        <strong>14 days of purchase</strong>. If some credits were used, we refund the unused credits at the price per credit of that pack
        (for example ${per10} per unused credit of the {PACKS.pack10.credits}-credit pack). After 14 days, unused pack credits are not
        refunded but stay valid until their 90-day expiry.
      </p>

      <h2>Plans</h2>
      <p>
        Plans (Starter {formatPrice(PLANS.starter.priceUsd)}, Growth {formatPrice(PLANS.growth.priceUsd)}, Pro{" "}
        {formatPrice(PLANS.pro.priceUsd)} a month) can be cancelled at any time from Billing in your studio: the plan runs to the end of the
        paid month, nothing further is charged, and the credits you already have keep their expiry date. Cancelling does not by itself
        refund the current month.
      </p>
      <p>
        If you ask within 14 days of a payment and <strong>none</strong> of that month’s credits has been used, we refund that month in
        full and end the plan immediately. If some were used, we refund the unused credits at that plan’s price per credit. Credits of
        earlier months that have expired under the plan’s rules (Starter at month end, Growth and Pro one month later) are not refundable.
      </p>

      <h2>Credits you used</h2>
      <p>
        A credit charged for a video that finished is not refunded as money. But a finished video is not always a good video. If the
        presenter mangled the product, said a line that was not in your script, or the file is broken, email us the job id: we look at the
        prompt and the result, and when the fault is ours or the model’s we regenerate it at no cost or put the credits back. We decide
        that case by case and we lean towards you.
      </p>

      <h2>The free trial</h2>
      <p>
        The {TRIAL.credits} trial credits are free, so there is nothing to refund. They render at {TRIAL.resolution} and expire after{" "}
        {TRIAL.expiryDays} days.
      </p>

      <h2>How to ask</h2>
      <ol>
        <li>
          Email <a href={`mailto:${SITE.email}?subject=Refund%20request`}>{SITE.email}</a> from the address you sign in with, with “Refund”
          in the subject, or use the <Link href="/contact">contact form</Link> with the topic “Billing, credits or a refund”. The Stripe
          receipt number helps but is not required.
        </li>
        <li>We confirm within two business days. If the request matches this policy, we issue the refund the same day through Stripe to the original payment method.</li>
        <li>Your bank usually shows it within 5 to 10 business days, depending on the card issuer.</li>
      </ol>

      <h2>What happens to the credits</h2>
      <p>
        A refund removes the credits it covers: the lot is revoked and your balance drops accordingly. Videos already generated with that
        purchase remain yours to keep and use.
      </p>

      <h2>Duplicate charges and mistakes on our side</h2>
      <p>
        If you were charged twice, charged after cancelling, or could not use the Service because of an outage or a bug of ours, we refund
        the affected amount in full regardless of the 14-day window. Tell us and we fix it.
      </p>

      <h2>Chargebacks</h2>
      <p>
        Please email us before disputing a charge with your bank: a refund from us arrives faster and costs you nothing. While a dispute is
        open, the credits of that purchase are suspended; if the dispute is resolved in our favour they are restored, if in yours the refund
        stands.
      </p>

      <h2>Breaches</h2>
      <p>
        Credits spent on a video that broke the <Link href="/acceptable-use">acceptable-use policy</Link> (for example a fake-customer
        script that got past the check) are not refunded. Unused credits of an account closed for a breach are refunded only where the law
        requires it.
      </p>

      <h2>Promotional and free purchases</h2>
      <p>
        A purchase completed with a 100% promotion code has nothing to refund. Partial discounts are refunded on what you actually paid.
      </p>
    </LegalPage>
  );
}
