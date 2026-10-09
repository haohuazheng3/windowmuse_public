import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { Breadcrumbs, Container, CtaPane, Pane, Section, SectionHead } from "@/components/ui";
import { PRESENTERS } from "@/content/presenters";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "WindowMuse is a small product built for TikTok Shop sellers: real product photos in, a fictional presenter video out, with the honesty rules of TikTok and the FTC built into the tool rather than left to the seller.",
  path: "/about",
});

const BELIEFS = [
  {
    title: "The product must be real.",
    body: "The model shows the product exactly as you photographed it and never redraws it. TikTok Shop prohibits AI that fabricates or alters product displays, and a buyer who receives something different from the video returns it.",
  },
  {
    title: "The presenter must be fictional, and labeled.",
    body: `All ${PRESENTERS.length} presenters are written personas. We do not accept face uploads, clone voices or imitate anyone. Every download reminds you to turn on TikTok’s AI-generated content label and the commercial content disclosure.`,
  },
  {
    title: "The script must be defensible.",
    body: "Presenters speak as your shop about facts you can back up. They never pose as customers (a fictional customer is a fake review under FTC rules), never as doctors or experts, and never promise cures, “instant” or “guaranteed”. The compliance check enforces this before a credit is spent.",
  },
  {
    title: "Failures are ours to absorb.",
    body: "Credits are reserved when you press Generate and charged only when the video succeeds. If the model fails, times out or we have an outage, you pay nothing.",
  },
];

const STACK = [
  ["Video model", "ByteDance Seedance 2.5, run through Replicate. Your photos, the presenter description and the approved script are sent to it to render the video; nothing else is."],
  ["Script drafts", "Anthropic’s Claude writes the optional first draft from your product facts, or a deterministic template does when the AI writer is off. You edit and approve every word."],
  ["Sign-in", "Clerk, email code only. No passwords to leak, no social logins."],
  ["Payments", "Stripe Checkout and Stripe’s billing portal. We never see or store card numbers."],
  ["Storage and hosting", "Photos and videos in a private Cloudflare R2 bucket behind signed links; the app on Vercel; data in Neon Postgres."],
  ["Analytics", "FlowGlance only, with region-aware consent. No ad pixels."],
];

export default function AboutPage() {
  return (
    <>
      <Container className="pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]}
        />
        <div className="mt-6 max-w-3xl">
          <p className="eyebrow eyebrow-accent">About {SITE.name}</p>
          <h1 className="display mt-4 text-[2.5rem] text-ink sm:text-[3.6rem]">
            A window is where a product is shown. <em>The muse is what makes people stop.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.12rem] leading-relaxed text-ink-3">
            {SITE.name} exists for one job: turning the product photos a TikTok Shop seller already has into a short, honest presenter
            video they can post today. Not a studio, not an agency, not an avatar of you. A shop window with a voice.
          </p>
        </div>
      </Container>

      <Section className="!pt-12">
        <Pane className="p-7 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
            <div className="w-fit">
              <LogoMark size={72} />
            </div>
            <div className="prose-ui max-w-2xl">
              <h2 className="!mt-0">Why we built it</h2>
              <p>
                TikTok Shop rewards sellers who post product videos often and link each one to a product card. Most sellers have good
                photos and a clear idea of why their product is worth buying, and no time, crew or on-camera confidence to turn that into a
                video several times a week. Creator marketplaces are slow and expensive for a $20 item. Stock footage is not your product.
              </p>
              <p>
                Video models can now render a lifelike host who holds a photographed object and speaks a script. That makes the video part
                cheap. It also makes it easy to fake things: fake customers, fake experts, fake products. TikTok and the FTC both wrote rules
                about exactly that in the last two years. We built WindowMuse so that the fast path and the honest path are the same path.
              </p>
              <h2>What we are not</h2>
              <p>
                We do not clone your face or voice, we do not make avatars of real people, we do not offer live-stream avatars (TikTok Shop
                forbids AI voices in LIVE), and we do not publish anything for you. The video is yours; posting it, with the right labels and
                your product card attached, is your call.
              </p>
            </div>
          </div>
        </Pane>
      </Section>

      <Section>
        <SectionHead eyebrow="What we believe" title="Four rules that shape every feature." />
        <div className="grid gap-4 md:grid-cols-2">
          {BELIEFS.map((b) => (
            <Pane key={b.title} className="p-7">
              <p className="headline text-[1.35rem] text-ink">{b.title}</p>
              <p className="mt-3 text-[0.96rem] leading-relaxed text-ink-3">{b.body}</p>
            </Pane>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead
          eyebrow="How it is built"
          title="The parts, named."
          lede="You are sending us product photos and paying us money; you should know who else touches them. The privacy policy has the full list and the retention periods."
        />
        <Pane className="divide-y divide-[var(--line)] px-6 sm:px-8">
          {STACK.map(([name, body]) => (
            <div key={name} className="grid gap-1 py-5 sm:grid-cols-[180px_1fr] sm:gap-6">
              <p className="text-[0.95rem] font-semibold text-ink">{name}</p>
              <p className="text-[0.95rem] leading-relaxed text-ink-3">{body}</p>
            </div>
          ))}
        </Pane>
        <p className="mt-5 text-[0.9rem] text-ink-4">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-ink-2">
            Privacy policy
          </Link>{" "}
          ·{" "}
          <Link href="/acceptable-use" className="underline underline-offset-4 hover:text-ink-2">
            Acceptable use
          </Link>
        </p>
      </Section>

      <Section>
        <SectionHead eyebrow="Where we are" title="Early access, and honest about it." />
        <Pane className="p-7 sm:p-8">
          <div className="prose-ui max-w-2xl">
            <p>
              WindowMuse opened in {SITE.foundingYear} and is in early access. There are no testimonials, ratings or user counts on this site
              because we have not earned real ones yet; when we have, they will be real. What you see is the product as it is today, and the
              free trial is how you judge it.
            </p>
            <p>
              The author of everything on this site, the blog included, is {SITE.name} as an organisation. If you have a question, a bug or an
              idea, <Link href="/contact">write to us</Link> or email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. {SITE.replyTime}
            </p>
          </div>
        </Pane>
      </Section>

      <Section>
        <CtaPane />
      </Section>
    </>
  );
}
