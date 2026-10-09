import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Container, CtaPane, FaqList, Section, SectionHead } from "@/components/ui";
import { FAQS, type Faq } from "@/content/faq";
import { faqLd, pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description:
    "Answers about WindowMuse: what the videos are, how long they take, how credits and refunds work, TikTok’s AI label, the fictional presenters, languages, photos, and what happens to your data.",
  path: "/faq",
});

const GROUPS: { tag: Faq["tags"][number]; eyebrow: string; title: string }[] = [
  { tag: "product", eyebrow: "The product", title: "What you get and how it is made" },
  { tag: "credits", eyebrow: "Credits and billing", title: "Paying, refunds, cancelling" },
  { tag: "compliance", eyebrow: "Labels and rules", title: "Staying on the right side of TikTok and the FTC" },
  { tag: "account", eyebrow: "Your account and data", title: "Photos, scripts, videos, deletion" },
  { tag: "general", eyebrow: "Everything else", title: "General questions" },
];

/** Each question appears once, in the first group whose tag it carries. */
function grouped(): { group: (typeof GROUPS)[number]; faqs: Faq[] }[] {
  const seen = new Set<string>();
  return GROUPS.map((group) => {
    const faqs = FAQS.filter((f) => !seen.has(f.q) && f.tags.includes(group.tag));
    faqs.forEach((f) => seen.add(f.q));
    return { group, faqs };
  }).filter((g) => g.faqs.length > 0);
}

export default function FaqPage() {
  const sections = grouped();
  return (
    <>
      <JsonLd data={faqLd(FAQS)} />
      <Container className="pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]}
        />
        <div className="mt-6 max-w-3xl">
          <p className="eyebrow eyebrow-accent">FAQ</p>
          <h1 className="display mt-4 text-[2.5rem] text-ink sm:text-[3.6rem]">
            Questions, <em>answered plainly.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.12rem] leading-relaxed text-ink-3">
            {FAQS.length} questions sellers ask before and after the first video. If yours is missing,{" "}
            <Link href="/contact" className="text-accent-text underline underline-offset-4">
              write to us
            </Link>{" "}
            or email {SITE.email}; we reply within two business days.
          </p>
        </div>
      </Container>

      {sections.map(({ group, faqs }, i) => (
        <Section key={group.tag} className={i === 0 ? "!pt-12" : "!pt-14"} id={group.tag}>
          <SectionHead eyebrow={group.eyebrow} title={group.title} />
          <FaqList faqs={faqs} />
        </Section>
      ))}

      <Section>
        <CtaPane />
      </Section>
    </>
  );
}
