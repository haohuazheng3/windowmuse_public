import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Container, CtaPane, Pane, Section, SectionHead } from "@/components/ui";
import { CREDIT_RULES, DURATIONS, TRIAL } from "@/content/plans";
import { LANGUAGE_NAMES, PRESENTERS } from "@/content/presenters";
import { howToLd, pageMetadata, type HowToStep } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "How it works",
  description:
    "The five steps from product photos to a posted TikTok Shop video: add the product, upload photos, pick a fictional presenter, approve a checked script, generate. Plus what to upload and what the presenter will and won’t say.",
  path: "/how-it-works",
});

const STEPS: (HowToStep & { eyebrow: string; details: string[] })[] = [
  {
    eyebrow: "Step 1 · about a minute",
    name: "Add the product",
    text: "Give the product a name, a category and one to five selling points. Optional: brand, audience, price and your TikTok Shop link. Your draft is kept while you type, saved the moment you press Save, and reused for every video of that product.",
    details: [
      "Selling points are the raw material of the script: “stainless steel, dishwasher safe, 1.2 L” beats “amazing quality”.",
      "The TikTok Shop link is not burned into the video; it reminds you which product card to attach when you post.",
    ],
  },
  {
    eyebrow: "Step 2 · a few minutes",
    name: "Upload product photos",
    text: "Upload one to eight photos of the real product (JPEG, PNG or WebP, 300 to 6000 px, up to 20 MB each). They go straight from your browser to private storage. You confirm they are your product photos and show no people.",
    details: [
      "Three to five angles on a plain background work best; keep the packaging and logo readable.",
      "The model holds and shows the product exactly as photographed. It never redraws, recolours or resizes it.",
    ],
  },
  {
    eyebrow: "Step 3 · one tap",
    name: "Pick a presenter",
    text: `Choose one of ${PRESENTERS.length} fictional presenters by gender, vibe and setting. Each has a described look, a room and a way of speaking. None is a real person, and we never accept face uploads.`,
    details: [
      "Match the setting to the product: a kitchen for cookware, a desk for gadgets, a bathroom shelf for skincare.",
      "Presenters speak the languages listed on their card; the speech is generated natively, not dubbed.",
    ],
  },
  {
    eyebrow: "Step 4 · two minutes",
    name: "Approve the script",
    text: "Set the language, tone, length (10, 15, 20 or 30 seconds) and angle, then press “Write it for me” or write your own. Edit the hook, the body and the call to action with a live word budget. A compliance check flags claims TikTok or the FTC would.",
    details: [
      "Budget: about 2.5 spoken words per second, so a 15-second video is roughly 35 words.",
      "Fatal findings (cure claims, “guaranteed”, first-person customer stories, expert personas) block generation; warnings (“instant”, before/after, prices) ask you to look again.",
    ],
  },
  {
    eyebrow: "Step 5 · a few minutes of waiting",
    name: "Generate and post",
    text: "Choose 480p, 720p or 1080p, see the credit cost, press Generate. Credits are reserved, not charged, until the video succeeds. The job page updates on its own, then shows the player, the download and the posting checklist.",
    details: [
      "The checklist: attach the product card, turn on TikTok’s AI-generated content label, turn on the commercial content disclosure.",
      "If a generation fails or times out, the reservation is released. You pay for videos, not for attempts.",
    ],
  },
];

const UPLOAD_DO = [
  "Front, side and in-use angles, so the presenter can turn the product naturally.",
  "Even, soft light: window light or a lamp bounced off a wall. No harsh phone flash.",
  "A plain background that is not the same colour as the product.",
  "Packaging, labels and logo in focus and readable.",
  "The real product you ship, in the colour and size you sell.",
];

const UPLOAD_DONT = [
  "People, hands, faces, or anyone’s likeness. The upload is refused and your account may be reviewed.",
  "Screenshots of listings, collages, or images with text overlays and watermarks.",
  "Renders or AI-generated images of the product. TikTok Shop requires the physical product to be shown as it really is.",
  "Photos of a different variant than the one you link to.",
  "Blurry, tiny or heavily filtered photos. The model reproduces what it sees, including the blur.",
];

const WILL_SAY = [
  "Verifiable facts: material, size, capacity, what is in the box, what it is for, who it is for.",
  "How to use it, in the order you would show a friend.",
  "Comparisons to your own other products or to doing without.",
  "A plain call to action: tap the product card, check the sizes, see the bundle.",
];

const WONT_SAY = [
  "“I’ve been using this for a month and my skin…”: the presenter is not a customer, and a fictional customer is a fake review under FTC rules.",
  "Cure, treat, prevent, heal, or any weight-loss, muscle-gain or sexual-performance promise.",
  "“Guaranteed”, “instant”, or results the product cannot deliver.",
  "“As a dermatologist / nurse / pharmacist…”: no professional, official or expert personas.",
  "Anything about a real person, a competitor by name, or a price that differs from your listing.",
];

export default function HowItWorksPage() {
  const languages = Object.values(LANGUAGE_NAMES);
  return (
    <>
      <JsonLd
        data={howToLd({
          name: "How to make a TikTok Shop presenter video with WindowMuse",
          description: "From product photos to a posted vertical video in five steps.",
          path: "/how-it-works",
          totalTime: "PT15M",
          steps: STEPS.map(({ name, text }) => ({ name, text })),
        })}
      />
      <Container className="pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "How it works", path: "/how-it-works" },
          ]}
        />
        <div className="mt-6 max-w-3xl">
          <p className="eyebrow eyebrow-accent">How it works</p>
          <h1 className="display mt-4 text-[2.5rem] text-ink sm:text-[3.6rem]">
            Five panes, one page, <em>one video.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.12rem] leading-relaxed text-ink-3">
            The whole flow lives on one studio page. Your progress is kept in the address bar and in your browser, so a refresh or a
            dropped connection never loses work. Here is each step, what it needs from you, and what happens behind it.
          </p>
        </div>
      </Container>

      <Section className="!pt-12">
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.name} id={`step-${i + 1}`} className="pane scroll-mt-28 p-6 sm:p-8">
              <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:gap-7">
                <span
                  className="font-display text-[2.6rem] font-semibold leading-none tabular-nums text-accent-text"
                  style={{ fontVariationSettings: '"SOFT" 100, "opsz" 72' }}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="eyebrow">{s.eyebrow}</p>
                  <h2 className="headline mt-2 text-[1.6rem] text-ink">{s.name}</h2>
                  <p className="mt-3 text-[1rem] leading-relaxed text-ink-2">{s.text}</p>
                  <ul className="mt-4 space-y-2">
                    {s.details.map((d) => (
                      <li key={d} className="flex gap-2.5 text-[0.94rem] leading-relaxed text-ink-3">
                        <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-muse" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHead
          eyebrow="What to upload"
          title="Good photos make the whole video."
          lede="The presenter is rendered around your photos. Everything the video gets right about the product, it gets from them."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Pane className="p-7">
            <p className="tag tag-ok">Upload this</p>
            <ul className="mt-4 space-y-2.5">
              {UPLOAD_DO.map((t) => (
                <li key={t} className="flex gap-2.5 text-[0.96rem] leading-relaxed text-ink-2">
                  <span aria-hidden className="mt-[0.15em] text-ok">
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Pane>
          <Pane className="p-7">
            <p className="tag tag-bad">Not this</p>
            <ul className="mt-4 space-y-2.5">
              {UPLOAD_DONT.map((t) => (
                <li key={t} className="flex gap-2.5 text-[0.96rem] leading-relaxed text-ink-2">
                  <span aria-hidden className="mt-[0.15em] text-bad">
                    ✕
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Pane>
        </div>
        <p className="mt-5 text-[0.9rem] text-ink-4">
          Formats: JPEG, PNG, WebP · 300 to 6000 px on each side · up to 20 MB each · 1 to 8 photos per product.
        </p>
      </Section>

      <Section>
        <SectionHead
          eyebrow="The script"
          title="What the presenter will and won’t say."
          lede="The presenter speaks as your shop, about facts you can back up. That is what keeps the video on TikTok and keeps you on the right side of advertising law."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Pane className="p-7">
            <p className="eyebrow eyebrow-accent">Will say</p>
            <ul className="mt-4 space-y-2.5">
              {WILL_SAY.map((t) => (
                <li key={t} className="flex gap-2.5 text-[0.96rem] leading-relaxed text-ink-2">
                  <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </Pane>
          <Pane className="p-7">
            <p className="eyebrow">Won’t say</p>
            <ul className="mt-4 space-y-2.5">
              {WONT_SAY.map((t) => (
                <li key={t} className="flex gap-2.5 text-[0.96rem] leading-relaxed text-ink-2">
                  <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-4" />
                  {t}
                </li>
              ))}
            </ul>
          </Pane>
        </div>
        <Pane inset className="mt-4 p-6">
          <p className="text-[0.96rem] leading-relaxed text-ink-2">
            <strong className="text-ink">Languages:</strong> {languages.join(", ")}. <strong className="text-ink">Lengths:</strong>{" "}
            {DURATIONS.join(", ")} seconds. <strong className="text-ink">Tones:</strong> friendly, energetic, calm expert, playful.{" "}
            <strong className="text-ink">Angles:</strong> demo, unboxing, problem and solution, three reasons.
          </p>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">
            “Write it for me” uses an AI writer when it is configured and a deterministic template otherwise; the studio always says which
            one wrote the draft. Either way you edit and approve every word before it is spoken.
          </p>
        </Pane>
      </Section>

      <Section>
        <SectionHead eyebrow="Credits" title="What a video costs." />
        <Pane className="p-7">
          <ul className="space-y-2">
            {CREDIT_RULES.lines.map((l) => (
              <li key={l} className="flex gap-2.5 text-[0.98rem] leading-relaxed text-ink-2">
                <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-muse" />
                {l}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[0.92rem] text-ink-4">
            <Link href="/pricing" className="text-ink-3 underline underline-offset-4 hover:text-ink">
              Plans, packs and the credit calculator
            </Link>
          </p>
        </Pane>
      </Section>

      <Section>
        <CtaPane
          title={
            <>
              Try it on one product. <em className="!text-[#B7ADFF]">{TRIAL.credits} videos are free.</em>
            </>
          }
          body={`Sign in with your email, add a product, upload the photos you already have. Your first ${TRIAL.credits} videos render at ${TRIAL.resolution} and cost nothing.`}
        />
      </Section>
    </>
  );
}
