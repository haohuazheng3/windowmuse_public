import { PresenterAvatar } from "./PresenterAvatar";
import { LogoMark } from "./Logo";
import { presenterById, PRESENTERS } from "@/content/presenters";

/*
 * The hero "window": a still illustration of what a finished video is made of. It is
 * deliberately not a fake player and shows no numbers: a stylised phone, the seller's
 * photo slots, one presenter from the catalog, and the three beats of every script.
 * Everything here is static markup, so it paints with the hero text.
 */

const BEATS = [
  { label: "Hook", sec: "0–3 s", text: "One line that earns the next ten seconds." },
  { label: "Why it’s worth it", sec: "3–12 s", text: "Two or three verifiable facts, shown on the real product." },
  { label: "CTA", sec: "12–15 s", text: "Where to tap. The product card does the rest." },
];

const PHOTO_SLOTS = ["Front", "Side", "In use"];

export function WindowDemo({ className = "" }: { className?: string }) {
  const presenter = presenterById("maya") ?? PRESENTERS[0];
  return (
    <figure role="group" className={`pane-ink overflow-hidden p-5 sm:p-7 ${className}`} aria-label="How a WindowMuse video is put together">
      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        {/* The phone: decoration for the eye; the three beats on the right carry the same information in words. */}
        <div className="mx-auto w-[220px] shrink-0 sm:w-[236px]" aria-hidden="true">
          <div
            className="relative aspect-[9/16] w-full overflow-hidden rounded-[32px] bg-[#0B0907]"
            style={{ boxShadow: "0 0 0 6px #2A251F, 0 0 0 7px rgba(243,238,230,0.12), 0 30px 60px -24px rgba(0,0,0,0.9)" }}
          >
            {/* soft window light inside the frame */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `radial-gradient(90% 60% at 20% 0%, ${presenter.palette.bg}33, transparent 60%)` }}
            />
            {/* the label the seller turns on when posting */}
            <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[0.62rem] font-semibold tracking-wide text-[#F3EEE6] backdrop-blur-sm">
              <LogoMark size={11} mono className="text-[#B7ADFF]" />
              AI-generated · fictional presenter
            </div>

            {/* the presenter */}
            <div className="absolute inset-x-0 top-10 flex justify-center">
              <PresenterAvatar presenter={presenter} size={128} decorative />
            </div>

            {/* the seller's photos, exactly as uploaded */}
            <div className="absolute inset-x-3 bottom-[88px]">
              <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#A89E92]">Your product photos</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PHOTO_SLOTS.map((s, i) => (
                  <div
                    key={s}
                    className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#F3EEE6]/30 text-[0.6rem] text-[#CFC6BB]"
                    style={{ background: i === 0 ? "rgba(243,238,230,0.08)" : "rgba(243,238,230,0.04)" }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* the spoken line + the three beats */}
            <div className="absolute inset-x-3 bottom-3">
              <div className="rounded-2xl bg-black/50 px-3 py-2.5 backdrop-blur-sm">
                <p className="text-[0.66rem] leading-snug text-[#F3EEE6]">
                  <span className="text-[#B7ADFF]">{presenter.name}:</span> “This is the one I’d hand you across the counter. Here’s why.”
                </p>
                <div className="mt-2 flex h-1.5 gap-1" aria-hidden>
                  <span className="w-[20%] rounded-full bg-[#FF7A4D]" />
                  <span className="w-[60%] rounded-full bg-[#F3EEE6]/35" />
                  <span className="w-[20%] rounded-full bg-[#F3EEE6]/20" />
                </div>
                <div className="mt-1 flex justify-between text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-[#A89E92]" aria-hidden>
                  <span>Hook</span>
                  <span>Why</span>
                  <span>CTA</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The three beats, explained */}
        <figcaption className="min-w-0">
          <p className="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#FF9A78]">Inside every video</p>
          <ol className="mt-4 space-y-4">
            {BEATS.map((b, i) => (
              <li key={b.label} className="flex gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F3EEE6]/10 text-[0.8rem] font-semibold tabular-nums text-[#F3EEE6]">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[1rem] font-semibold text-[#F3EEE6]">
                    {b.label}
                    <span className="text-[0.78rem] font-medium tabular-nums text-[#A89E92]">{b.sec}</span>
                  </p>
                  <p className="mt-0.5 text-[0.92rem] leading-relaxed text-[#CFC6BB]">{b.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[0.82rem] leading-relaxed text-[#A89E92]">
            {presenter.name} is one of {PRESENTERS.length} fictional presenters. The product is never redrawn: what you upload is what{" "}
            {presenter.gender === "woman" ? "she" : "he"} holds.
          </p>
        </figcaption>
      </div>
    </figure>
  );
}
