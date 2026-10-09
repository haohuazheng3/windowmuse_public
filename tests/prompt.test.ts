import { describe, expect, it } from "vitest";
import { PRESENTERS, presenterById } from "@/content/presenters";
import { buildPrompt, cleanLine, imageRefs, spokenLines, type PromptInput } from "@/lib/video/prompt";
import { clampResolution, mapInput, toReplicatePrompt, toTaskStatus } from "@/lib/video/replicate";

const maya = presenterById("maya") ?? PRESENTERS[0]!;

const input: PromptInput = {
  presenter: maya,
  product: { name: "Cloud Mug", brand: "Nimbus", category: "kitchen" },
  script: { hook: "Here is what the Nimbus Cloud Mug actually does.", body: 'Double walls keep coffee hot for 40 minutes. "Look" at the glaze.', cta: "Tap the link below." },
  language: "en",
  tone: "friendly",
  angle: "demo",
  durationSec: 15,
  imageCount: 3,
};

describe("buildPrompt", () => {
  const prompt = buildPrompt(input);

  it("describes the presenter as fictional and places them in their setting", () => {
    expect(prompt).toContain("fictional");
    expect(prompt).toContain(maya.name);
    expect(prompt).toContain(maya.setting);
  });
  it("names every reference photo and forbids redrawing the product", () => {
    expect(prompt).toContain("@Image1, @Image2 and @Image3");
    expect(prompt).toMatch(/never redrawn/);
    expect(prompt).toContain("Cloud Mug by Nimbus");
  });
  it("asks for vertical handheld UGC framing with eye contact", () => {
    expect(prompt).toContain("Vertical 9:16");
    expect(prompt).toContain("15 seconds");
    expect(prompt).toMatch(/handheld/);
    expect(prompt).toMatch(/looks into the lens/);
  });
  it("names the language and quotes the lines without inner double quotes", () => {
    expect(prompt).toContain('Maya speaks in English, lip-synced, natural pace, no other voices: "Here is what the Nimbus Cloud Mug actually does. Double walls keep coffee hot for 40 minutes. \'Look\' at the glaze. Tap the link below."');
    expect(buildPrompt({ ...input, language: "zh" })).toContain("speaks in Chinese (Mandarin), delivering the lines in Chinese (Mandarin) even where they are written in English, lip-synced");
  });
  it("forbids on-screen text, subtitles and music", () => {
    expect(prompt).toMatch(/No on-screen text, no subtitles/);
    expect(prompt).toMatch(/no music/);
  });
  it("does not repeat the brand when the product name already carries it", () => {
    const p = buildPrompt({ ...input, product: { name: "Nimbus Cloud Mug", brand: "Nimbus", category: "kitchen" } });
    expect(p).toContain("Product: Nimbus Cloud Mug (kitchen)");
  });
  it("varies direction by tone and angle", () => {
    const calm = buildPrompt({ ...input, tone: "calm-expert", angle: "three-reasons" });
    expect(calm).toMatch(/composed and precise/);
    expect(calm).toMatch(/counts the three reasons/);
    expect(calm).not.toBe(prompt);
  });
});

describe("prompt helpers", () => {
  it("clamps image references to 1..8", () => {
    expect(imageRefs(0)).toEqual(["@Image1"]);
    expect(imageRefs(2)).toEqual(["@Image1", "@Image2"]);
    expect(imageRefs(20)).toHaveLength(8);
  });
  it("cleans stage directions and whitespace from lines", () => {
    expect(cleanLine("  Hello   [smiles] there (beat)  ")).toBe("Hello there");
    expect(spokenLines("Jun", "en", { hook: "A", body: "B", cta: "C" })).toBe('Jun speaks in English, lip-synced, natural pace, no other voices: "A B C"');
    expect(spokenLines("Jun", "ko", { hook: "A", body: "B", cta: "C" })).toContain("speaks in Korean, delivering the lines in Korean even where they are written in English");
  });
});

describe("replicate mapping", () => {
  const gen = {
    jobId: "job_1",
    prompt: "Shows the mug in @Image1 and @Image2.",
    referenceImageUrls: ["https://files.example.com/d/a.jpg", "https://files.example.com/d/b.jpg"],
    durationSec: 15,
    aspect: "9:16" as const,
    resolution: "720p" as const,
    generateAudio: true as const,
    watermark: false,
    callbackUrl: "https://windowmuse.com/api/video/callback/job_1?t=abc",
  };
  it("rewrites @ImageN to [ImageN] and maps every field", () => {
    expect(toReplicatePrompt(gen.prompt)).toBe("Shows the mug in [Image1] and [Image2].");
    const { input: mapped, dropped } = mapInput(gen);
    expect(dropped).toEqual([]);
    expect(mapped).toEqual({
      prompt: "Shows the mug in [Image1] and [Image2].",
      reference_images: gen.referenceImageUrls,
      duration: 15,
      aspect_ratio: "9:16",
      resolution: "720p",
      generate_audio: true,
      watermark: false,
      output_format: "mp4",
    });
  });
  it("clamps the resolution to what the host offers and drops keys the live schema lost", () => {
    expect(clampResolution("1080p", ["480p", "720p"])).toBe("720p");
    expect(clampResolution("1080p", ["480p", "720p", "1080p"])).toBe("1080p");
    expect(clampResolution("720p", ["480p"])).toBe("480p");
    const { input: mapped, dropped } = mapInput({ ...gen, seed: 7 }, { prompt: {}, reference_images: {}, duration: {}, resolution: { enum: ["480p"] } });
    expect(dropped).toEqual(["aspect_ratio", "generate_audio", "watermark", "output_format", "seed"]);
    expect(mapped.resolution).toBe("480p");
  });
  it("translates prediction statuses", () => {
    expect(toTaskStatus({ id: "p", status: "starting" })).toEqual({ state: "queued" });
    expect(toTaskStatus({ id: "p", status: "processing" })).toEqual({ state: "running" });
    expect(toTaskStatus({ id: "p", status: "succeeded", output: ["https://r.example/out.mp4"] })).toEqual({ state: "succeeded", videoUrl: "https://r.example/out.mp4" });
    expect(toTaskStatus({ id: "p", status: "succeeded", output: null })).toMatchObject({ state: "failed" });
    expect(toTaskStatus({ id: "p", status: "failed", error: "NSFW" })).toEqual({ state: "failed", error: "NSFW" });
    expect(toTaskStatus({ id: "p", status: "canceled" })).toMatchObject({ state: "expired" });
  });
});
