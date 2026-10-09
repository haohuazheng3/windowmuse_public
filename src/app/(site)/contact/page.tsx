import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContactForm } from "@/components/ContactForm";
import { Breadcrumbs, Container, Pane, Section } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: `Write to WindowMuse about a video, billing or a refund, your account, privacy, partnerships or press. ${SITE.replyTime} Or email ${SITE.email}.`,
  path: "/contact",
});

const HELP = [
  {
    title: "A video that failed or looks wrong",
    body: "Failed generations are never charged. If a finished video has the wrong product, a strange gesture or a line it should not have said, send the reference shown on the video's page (ref XXXXXXXX) and tell us what you expected.",
  },
  {
    title: "Billing or a refund",
    body: "Write from the email you sign in with. Unused packs and plans are refunded in full within 14 days; partly used ones for the unused credits. Receipts come from Stripe.",
  },
  {
    title: "Your data",
    body: "Ask for a copy or deletion of everything we hold about you: account, products, photos, scripts, videos, messages. We confirm within two business days and finish within 30 days.",
  },
  {
    title: "Partnership or agency use",
    body: "Running videos for several shops, or integrating WindowMuse into a workflow? Tell us the volume and the catalog types and we will come back with specifics.",
  },
];

export default function ContactPage() {
  return (
    <>
      <Container className="pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact" },
          ]}
        />
        <div className="mt-6 max-w-3xl">
          <p className="eyebrow eyebrow-accent">Contact</p>
          <h1 className="display mt-4 text-[2.5rem] text-ink sm:text-[3.6rem]">
            Talk to a person <em>at the window.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.12rem] leading-relaxed text-ink-3">
            One form, one inbox, read by the people who build the product. {SITE.replyTime} If you would rather use your own mail app:{" "}
            <a href={`mailto:${SITE.email}`} className="text-accent-text underline underline-offset-4">
              {SITE.email}
            </a>
            .
          </p>
        </div>
      </Container>

      <Section className="!pt-10">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
          <Suspense fallback={<div className="pane min-h-[520px] p-6 sm:p-9" aria-hidden="true" />}>
            <ContactForm />
          </Suspense>
          <div className="grid content-start gap-4">
            {HELP.map((h) => (
              <Pane key={h.title} className="p-6">
                <p className="text-[1rem] font-semibold text-ink">{h.title}</p>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-3">{h.body}</p>
              </Pane>
            ))}
            <p className="px-2 text-[0.88rem] leading-relaxed text-ink-4">
              Quick answers to common questions are on the{" "}
              <Link href="/faq" className="underline underline-offset-4 hover:text-ink-2">
                FAQ
              </Link>
              ; money questions on the{" "}
              <Link href="/refund-policy" className="underline underline-offset-4 hover:text-ink-2">
                refund policy
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
