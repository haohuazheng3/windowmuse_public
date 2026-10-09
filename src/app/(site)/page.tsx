import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { LogoMark } from "@/components/Logo";
import { PresenterAvatar } from "@/components/PresenterAvatar";
import { WindowDemo } from "@/components/WindowDemo";
import { Container, CtaPane, FaqList, Pane, Section, SectionHead } from "@/components/ui";
import { FAQS } from "@/content/faq";
import { PACKS, PLANS, TRIAL, formatPrice, perCreditUsd } from "@/content/plans";
import { PRESENTERS, SCENE_LABELS, VIBE_LABELS } from "@/content/presenters";
import { faqLd, pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: `${SITE.name} — AI presenter videos for TikTok Shop sellers`,
  absoluteTitle: true,
  description: SITE.description,
  path: "/",
});

const WHAT_YOU_GET = [
  {
    eyebrow: "A host, not a slideshow",
    title: "A presenter who holds your product and talks.",
    body: `Pick one of ${PRESENTERS.length} fictional presenters. They show the product exactly as you photographed it, look at the camera and speak the script you approved. Vertical 9:16, 10 to 30 seconds, no watermark on paid plans.`,
  },
  {
    eyebrow: "A script you can defend",
    title: "Hook, reasons, call to action, checked before it renders.",
    body: "Write it yourself or let us draft it in one of 11 languages. A compliance check flags medical claims, fake-customer phrasing and “guaranteed” before you spend a credit, because TikTok and the FTC will flag them after.",
  },
  {
    eyebrow: "Ready to post",
    title: "An MP4 and the two switches that keep it up.",
    body: "Download the file from your studio, attach your product card on TikTok, turn on the AI-generated content label and the commercial content disclosure. The download page walks you through both.",
  },
];

const STEPS = [
  { n: "01", title: "Add the product", body: "Name, category, one to five selling points. The things a good shop assistant would actually say." },
  { n: "02", title: "Upload photos", body: "One to eight photos of the real product. Front, side, in use. No people in the frame." },
  { n: "03", title: "Pick a presenter and approve the script", body: "Choose the host by vibe and setting. Edit the hook, the reasons and the CTA until they sound like your shop." },
  { n: "04", title: "Generate and post", body: "One credit for a 15-second 720p video. A few minutes later it is in your studio with the posting checklist." },
];

const HOME_FAQ_QUESTIONS = [
  "What does WindowMuse actually make?",
  "How long does a video take?",
  "How do credits work?",
  "Do I have to label these videos as AI-generated on TikTok?",
  "Are the presenters real people?",
  "What happens if a generation fails?",
];

const TEASER_PRESENTER_IDS = ["maya", "jun", "sofia"];

export default function HomePage() {
  const picked = FAQS.filter((f) => HOME_FAQ_QUESTIONS.includes(f.q));
  const faqs = picked.length === HOME_FAQ_QUESTIONS.length ? picked : FAQS.slice(0, 6);
  const teaserPresenters = [
    ...TEASER_PRESENTER_IDS.map((id) => PRESENTERS.find((p) => p.id === id)).filter((p): p is (typeof PRESENTERS)[number] => Boolean(p)),
    ...PRESENTERS.filter((p) => !TEASER_PRESENTER_IDS.includes(p.id)),
  ].slice(0, 6);
  const plans = [PLANS.starter, PLANS.growth, PLANS.pro];

  return (
    <>
      <JsonLd data={faqLd(faqs)} />

      {/* ---------- Hero: in the void, with the window demo floating beside it ---------- */}
      <Container className="pt-10 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p className="eyebrow eyebrow-accent">For TikTok Shop sellers · early access</p>
            <h1 className="display mt-5 text-[2.9rem] text-ink sm:text-[4.2rem] lg:text-[4.6rem]">
              Your shop window, <em>with a voice.</em>
            </h1>
            <p className="mt-6 max-w-xl text-[1.12rem] leading-relaxed text-ink-3 sm:text-[1.2rem]">
              Upload your product photos, pick a presenter, approve the script: WindowMuse generates a vertical video in which a
              fictional on-camera host shows your real product and says why it is worth buying.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-in" prefetch={false} className="btn btn-primary btn-lg">
                Start free — {TRIAL.credits} videos
              </Link>
              <Link href="/how-it-works" className="btn btn-ghost btn-lg">
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-[0.88rem] leading-relaxed text-ink-4">
              {TRIAL.credits} free videos at {TRIAL.resolution}, no card needed. Presenters are fictional; the product is never redrawn.
            </p>
          </div>
          <WindowDemo className="lg:animate-float" />
        </div>
      </Container>

      {/* ---------- What you get ---------- */}
      <Section>
        <SectionHead
          eyebrow="What you get"
          title="One product, one presenter, one honest minute of attention."
          lede="Shoppable video on TikTok rewards sellers who post often and keep it real. WindowMuse makes the posting part fast without faking the real part."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHAT_YOU_GET.map((w) => (
            <Pane key={w.eyebrow} className="flex min-w-0 flex-col p-7 sm:p-8">
              <p className="eyebrow eyebrow-accent">{w.eyebrow}</p>
              <p className="headline mt-3 text-[1.45rem] text-ink">{w.title}</p>
              <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-3">{w.body}</p>
            </Pane>
          ))}
        </div>
      </Section>

      {/* ---------- How it works strip ---------- */}
      <Section>
        <SectionHead eyebrow="How it works" title="Four steps, one page, nothing to install." />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="pane flex min-w-0 flex-col p-6">
              <span className="font-display text-[1.6rem] font-semibold tabular-nums text-accent-text" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 36' }}>
                {s.n}
              </span>
              <p className="mt-2 text-[1.08rem] font-semibold leading-snug text-ink">{s.title}</p>
              <p className="mt-2 text-[0.94rem] leading-relaxed text-ink-3">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-[0.92rem] text-ink-4">
          Most videos finish within a few minutes; busy periods take longer.{" "}
          <Link href="/how-it-works" className="text-ink-3 underline underline-offset-4 hover:text-ink">
            The full walkthrough, with what to upload
          </Link>
        </p>
      </Section>

      {/* ---------- Presenters teaser ---------- */}
      <Section>
        <SectionHead
          eyebrow="Presenters"
          title={`${PRESENTERS.length} hosts. All fictional, all described, none photographed.`}
          lede="Every presenter is a written persona: a look, a setting, a way of speaking. No real person’s face or voice is ever used, which is what makes the AI label honest."
        />
        <div className="pane-grid !grid-cols-3 lg:!grid-cols-6">
          {teaserPresenters.map((p) => (
            <Link key={p.id} href="/presenters" className="pane pane-hover flex min-w-0 flex-col items-center p-3 text-center sm:p-4">
              <PresenterAvatar presenter={p} size={96} className="h-auto w-full max-w-[112px]" decorative />
              <span className="mt-3 text-[0.98rem] font-semibold text-ink">{p.name}</span>
              <span className="mt-0.5 text-[0.78rem] leading-snug text-ink-4">
                {VIBE_LABELS[p.vibe]} · {SCENE_LABELS[p.scene]}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Link href="/presenters" className="btn btn-ghost">
            Browse all {PRESENTERS.length} presenters
          </Link>
        </div>
      </Section>

      {/* ---------- Pricing teaser ---------- */}
      <Section>
        <SectionHead
          eyebrow="Pricing"
          title="One credit is one video."
          lede={`A credit is a video up to 15 seconds at 720p. Longer or 1080p costs more, failed generations cost nothing. Start with ${TRIAL.credits} free credits at ${TRIAL.resolution}.`}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <Pane key={p.sku} className={`flex min-w-0 flex-col p-7 ${p.sku === "growth" ? "ring-2 ring-accent" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">{p.name}</p>
                {p.sku === "growth" ? <span className="tag tag-accent">Most room to post</span> : null}
              </div>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-[2.6rem] font-semibold leading-none tabular-nums text-ink" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 72' }}>
                  {formatPrice(p.priceUsd)}
                </span>
                <span className="text-[0.9rem] text-ink-4">/ month</span>
              </p>
              <p className="mt-2 text-[1rem] text-ink-2">
                <strong className="text-ink">{p.credits} credits</strong> a month · ${perCreditUsd(p).toFixed(2)} per video
              </p>
              <p className="mt-1 text-[0.9rem] text-ink-3">{p.allow1080p ? "1080p and three videos at once" : "720p, one video at a time"}</p>
            </Pane>
          ))}
        </div>
        <p className="mt-5 text-[0.92rem] text-ink-4">
          No subscription? Packs of {PACKS.pack10.credits} ({formatPrice(PACKS.pack10.priceUsd)}) and {PACKS.pack50.credits} credits ({formatPrice(PACKS.pack50.priceUsd)}),
          valid 90 days.{" "}
          <Link href="/pricing" className="text-ink-3 underline underline-offset-4 hover:text-ink">
            Full pricing and the credit calculator
          </Link>
        </p>
      </Section>

      {/* ---------- Built for TikTok Shop rules ---------- */}
      <Section>
        <Pane className="overflow-hidden p-7 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:gap-12">
            <div>
              <div className="w-fit">
                <LogoMark size={40} />
              </div>
              <p className="eyebrow eyebrow-accent mt-5">Built for TikTok Shop rules</p>
              <h2 className="headline mt-3 text-[1.9rem] text-ink sm:text-[2.2rem]">AI presenters are allowed. Fake ones are not.</h2>
              <p className="mt-4 text-[1rem] leading-relaxed text-ink-3">
                TikTok Shop permits AI-generated product demonstrations when the AI is disclosed, the product is shown as it really is,
                and nobody is impersonated. TikTok also says a video is not demoted just because the AI-generated label is on. WindowMuse
                is built inside those lines, so you do not have to think about them every time you post.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ["Label reminder on every download", "TikTok requires realistic AI video to carry its AI-generated content label, and product videos need the commercial content disclosure. Both steps are on the download page, every time."],
                ["Fictional presenters only", "No uploads of faces, no cloning of voices, no celebrities, no experts in lab coats. Every presenter is a written persona rendered by the model."],
                ["Your real product photos", "The model shows the product as photographed and never redraws it. TikTok Shop prohibits AI that changes a product’s size, colour, material or contents."],
                ["No fake testimonials", "Scripts speak as a brand presenter about verifiable facts. The compliance check blocks first-person customer stories, cure claims and “guaranteed”, which the FTC treats as fake reviews."],
              ].map(([title, body]) => (
                <li key={title} className="pane-inset min-w-0 p-5">
                  <p className="text-[1rem] font-semibold text-ink">{title}</p>
                  <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-3">{body}</p>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 text-[0.86rem] text-ink-4">
            Live streams are not offered: TikTok Shop does not allow AI voices in LIVE.{" "}
            <Link href="/acceptable-use" className="underline underline-offset-4 hover:text-ink-2">
              Read the acceptable-use policy
            </Link>
          </p>
        </Pane>
      </Section>

      {/* ---------- FAQ ---------- */}
      <Section>
        <SectionHead eyebrow="Questions" title="Things sellers ask before the first video." />
        <FaqList faqs={faqs} />
        <p className="mt-5 text-[0.92rem] text-ink-4">
          <Link href="/faq" className="text-ink-3 underline underline-offset-4 hover:text-ink">
            All {FAQS.length} questions, including billing and privacy
          </Link>
        </p>
      </Section>

      <Section>
        <CtaPane />
      </Section>
    </>
  );
}
