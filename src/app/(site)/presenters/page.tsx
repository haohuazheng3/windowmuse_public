import type { Metadata } from "next";
import Link from "next/link";
import { PresenterCatalog } from "@/components/PresenterCatalog";
import { Breadcrumbs, Container, CtaPane, Pane, Section, SectionHead } from "@/components/ui";
import { LANGUAGE_NAMES, PRESENTERS } from "@/content/presenters";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Presenters",
  description: `The ${PRESENTERS.length} fictional on-camera presenters of WindowMuse: women and men, five vibes, six settings, speaking ${Object.keys(LANGUAGE_NAMES).length} languages. Written personas rendered by the video model; no real person’s face or voice.`,
  path: "/presenters",
});

export default function PresentersPage() {
  const women = PRESENTERS.filter((p) => p.gender === "woman").length;
  const men = PRESENTERS.length - women;
  return (
    <>
      <Container className="pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Presenters", path: "/presenters" },
          ]}
        />
        <div className="mt-6 max-w-3xl">
          <p className="eyebrow eyebrow-accent">The catalog</p>
          <h1 className="display mt-4 text-[2.5rem] text-ink sm:text-[3.6rem]">
            {PRESENTERS.length} presenters, <em>none of them real.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.12rem] leading-relaxed text-ink-3">
            {women} women and {men} men, each a written persona: a look, a room, a way of speaking. The video model renders them from that
            description, so no real person’s face or voice is ever used, and the AI-generated label you turn on when posting is simply
            true. The portraits below are abstract on purpose; the presenter in your video is lifelike.
          </p>
        </div>
      </Container>

      <Section className="!pt-10">
        <PresenterCatalog />
      </Section>

      <Section>
        <SectionHead eyebrow="Choosing" title="Pick the room before the face." />
        <div className="grid gap-4 md:grid-cols-3">
          <Pane className="p-6">
            <p className="text-[1rem] font-semibold text-ink">Match the setting to the product</p>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-ink-3">
              Cookware in a kitchen, gadgets at a desk, skincare in soft home light, gear outdoors. Viewers believe a product faster when
              it is shown where it lives.
            </p>
          </Pane>
          <Pane className="p-6">
            <p className="text-[1rem] font-semibold text-ink">Match the vibe to the tone</p>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-ink-3">
              Energetic presenters suit the “three reasons” angle and short hooks; calm experts carry problem-and-solution scripts;
              playful ones sell food, toys and anything with a reveal.
            </p>
          </Pane>
          <Pane className="p-6">
            <p className="text-[1rem] font-semibold text-ink">Check the languages</p>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-ink-3">
              Each card lists what the presenter speaks. Speech is generated natively by the model, so lip movement matches the language;
              it is not dubbed over an English take.
            </p>
          </Pane>
        </div>
        <p className="mt-5 text-[0.9rem] leading-relaxed text-ink-4">
          Presenters never play doctors, nurses, officials or customers, and never resemble a public figure.{" "}
          <Link href="/acceptable-use" className="underline underline-offset-4 hover:text-ink-2">
            Acceptable use
          </Link>
        </p>
      </Section>

      <Section>
        <CtaPane
          title={
            <>
              Put one in front of <em className="!text-[#B7ADFF]">your product.</em>
            </>
          }
          body="Sign in, add a product, upload the photos, and choose a presenter from this same catalog in the studio."
        />
      </Section>
    </>
  );
}
