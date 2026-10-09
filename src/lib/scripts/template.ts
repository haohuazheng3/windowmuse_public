/**
 * The deterministic script writer: what "Write it for me" produces when no AI key is
 * configured, and the fallback when the AI call fails. It writes in the brand-presenter
 * voice (never a customer, never a professional), only from the facts the seller typed,
 * and varies its phrasing by angle × tone so two products never sound like the same form
 * letter. Pure: the same input always yields the same draft.
 *
 * Non-English languages: the lines are written in English and the draft carries a note;
 * the prompt tells the video model to deliver them in the chosen language (Seedance speaks
 * all 11 natively), and the seller can rewrite the lines in their language before generating.
 */
import {
  countWords,
  fitToBudget,
  joinScript,
  languageName,
  MAX_HOOK_WORDS,
  wordBudget,
  type Angle,
  type ScriptDraft,
  type ScriptInput,
  type Tone,
} from "./types";

/* ------------------------------------------------------------------ helpers */

/** Stable small hash so phrasing varies per product but never changes between renders. */
function seedOf(input: ScriptInput): number {
  const s = `${input.product.name}|${input.product.brand ?? ""}|${input.product.category}|${input.angle}|${input.tone}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function pick<T>(list: readonly T[], seed: number, salt: number): T {
  return list[(seed + salt * 7919) % list.length]!;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

/** Ends a fragment with a period unless it already carries punctuation. */
function sentence(s: string): string {
  const t = clean(s).replace(/[.!?]+$/, "");
  if (!t) return "";
  return `${t[0]!.toUpperCase()}${t.slice(1)}.`;
}

/** Lower-cases the first letter so a selling point reads inside a sentence. */
function inline(s: string): string {
  const t = clean(s).replace(/[.!?]+$/, "");
  if (!t) return "";
  // Keep acronyms and proper nouns (two capitals in a row) as typed.
  return /^[A-Z][A-Z]/.test(t) ? t : `${t[0]!.toLowerCase()}${t.slice(1)}`;
}

function productLabel(input: ScriptInput): string {
  const { name, brand } = input.product;
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) return `the ${brand} ${name}`;
  return `the ${name}`;
}

/* ------------------------------------------------------------------ hooks: angle × tone */

type HookWriter = (p: string, input: ScriptInput, n: number) => string;

const HOOKS: Record<Angle, Record<Tone, readonly HookWriter[]>> = {
  demo: {
    friendly: [
      (p) => `Here is what ${p} actually does.`,
      (p) => `Let's take a proper look at ${p}.`,
      (p) => `${cap(p)}, start to finish.`,
    ],
    energetic: [
      (p) => `Watch ${p} in action. Right now.`,
      (p) => `Okay, ${p}. Let's go.`,
      (p) => `You need to see ${p} do this.`,
    ],
    "calm-expert": [
      (p) => `A short walkthrough of ${p}.`,
      (p) => `This is ${p}, and here is how it works.`,
      (p) => `A few things to notice about ${p}.`,
    ],
    playful: [
      (p) => `Tiny demo, big little product: ${p}.`,
      (p) => `${cap(p)}. Let's play.`,
      (p) => `Does ${p} live up to the hype? Watch.`,
    ],
  },
  unboxing: {
    friendly: [
      (p) => `${cap(p)} just arrived. Let's open it together.`,
      (p) => `First look at ${p}, fresh out of the box.`,
      (p) => `Unboxing ${p}, nothing staged.`,
    ],
    energetic: [
      (p) => `It's here. ${cap(p)}, unboxed.`,
      (p) => `Box, open, ${p}. Let's see it.`,
      (p) => `New in: ${p}. Opening it now.`,
    ],
    "calm-expert": [
      (p) => `What comes in the box with ${p}.`,
      (p) => `Unboxing ${p}: contents, build, first impressions.`,
      (p) => `A careful first look at ${p}.`,
    ],
    playful: [
      (p) => `Unboxing ${p}. Tape, meet scissors.`,
      (p) => `Guess what's in the box. Spoiler: ${p}.`,
      (p) => `${cap(p)}, straight from the box to your screen.`,
    ],
  },
  "problem-solution": {
    friendly: [
      (p, i) => `${painPoint(i)} ${cap(p)} was made for that.`,
      (p, i) => `If ${painPointIf(i)}, ${p} is worth a look.`,
      (p, i) => `${painPoint(i)} Here is what ${p} does about it.`,
    ],
    energetic: [
      (p, i) => `${painPoint(i)} Not anymore. ${cap(p)}.`,
      (p, i) => `Stop ${painPointGerund(i)}. ${cap(p)} fixes the setup.`,
      (p, i) => `${painPoint(i)} Meet ${p}.`,
    ],
    "calm-expert": [
      (p, i) => `${painPoint(i)} ${cap(p)} approaches it differently.`,
      (p, i) => `A common problem, ${painPointNoun(i)}, and how ${p} is built for it.`,
      (p, i) => `${painPoint(i)} Here is the fix: ${p}.`,
    ],
    playful: [
      (p, i) => `${painPoint(i)} Rude. ${cap(p)} to the rescue.`,
      (p, i) => `${painPoint(i)} Plot twist: ${p}.`,
      (p, i) => `Tired of ${painPointGerund(i)}? Same. ${cap(p)}.`,
    ],
  },
  "three-reasons": {
    friendly: [
      (p, _i, n) => `${cap(count(n))} ${plural(n, "reason")} people pick ${p}.`,
      (p, _i, n) => `${cap(count(n))} ${plural(n, "thing")} worth knowing about ${p}.`,
      (p, _i, n) => `Why ${p}? ${cap(count(n))} quick ${plural(n, "reason")}.`,
    ],
    energetic: [
      (p, _i, n) => `${cap(count(n))} ${plural(n, "reason")} ${p} is in the cart. Go.`,
      (p, _i, n) => `${cap(p)} in ${count(n)} fast ${plural(n, "point")}.`,
      (p, _i, n) => `${cap(count(n))} ${plural(n, "reason")}. One product. ${cap(p)}.`,
    ],
    "calm-expert": [
      (p, _i, n) => `${cap(count(n))} ${plural(n, "fact")} about ${p}.`,
      (p, _i, n) => `What sets ${p} apart, in ${count(n)} ${plural(n, "point")}.`,
      (p, _i, n) => `${cap(p)}, explained in ${count(n)} ${plural(n, "part")}.`,
    ],
    playful: [
      (p, _i, n) => `${cap(count(n))} ${plural(n, "reason")} ${p} is a little bit addictive.`,
      (p, _i, n) => `${cap(p)}: ${count(n)} ${plural(n, "reason")}, zero fluff.`,
      (p, _i, n) => `Counting to ${count(n)} with ${p}.`,
    ],
  },
};

function cap(s: string): string {
  return s ? `${s[0]!.toUpperCase()}${s.slice(1)}` : s;
}

const COUNT_WORDS = ["zero", "one", "two", "three"] as const;
function count(n: number): string {
  return COUNT_WORDS[Math.max(0, Math.min(3, n))]!;
}
function plural(n: number, noun: string): string {
  return n === 1 ? noun : `${noun}s`;
}

/* Problem framing is derived from the category when the seller gave no audience/problem. */
const CATEGORY_PAIN: Record<string, { statement: string; ifClause: string; gerund: string; noun: string }> = {
  beauty: { statement: "Makeup that slides off by lunch.", ifClause: "your makeup never lasts the day", gerund: "fixing your makeup at noon", noun: "makeup that fades by lunch" },
  skincare: { statement: "A routine with too many steps.", ifClause: "your routine has too many steps", gerund: "juggling six products", noun: "a routine with too many steps" },
  fashion: { statement: "Clothes that look good but feel wrong.", ifClause: "nice clothes never feel comfortable", gerund: "choosing between comfort and style", noun: "style that costs comfort" },
  accessories: { statement: "Small things that break first.", ifClause: "your accessories wear out fast", gerund: "replacing the same accessory", noun: "accessories that wear out" },
  home: { statement: "A corner of the home that never looks finished.", ifClause: "one corner of your home still looks unfinished", gerund: "living with the unfinished corner", noun: "a room that never feels done" },
  kitchen: { statement: "Dinner takes longer than it should.", ifClause: "weeknight dinners take too long", gerund: "cleaning three pans for one meal", noun: "slow weeknight cooking" },
  electronics: { statement: "Tech that is clever but awkward to use.", ifClause: "your gadgets are smarter than they are easy", gerund: "fighting with settings", noun: "clever tech that is awkward to use" },
  "phone-accessories": { statement: "A phone that is always at ten percent.", ifClause: "your phone is always nearly dead", gerund: "hunting for a charger", noun: "a phone that dies at the wrong moment" },
  "health-wellness": { statement: "Habits that are hard to keep.", ifClause: "good habits keep slipping", gerund: "restarting the same habit", noun: "habits that do not stick" },
  fitness: { statement: "Workouts that need more space than you have.", ifClause: "you have no room for gym gear", gerund: "skipping workouts for lack of space", noun: "a home with no gym space" },
  "baby-kids": { statement: "Gear that outgrows its usefulness in a month.", ifClause: "baby gear is outgrown in weeks", gerund: "buying the next size", noun: "gear that is outgrown too fast" },
  pets: { statement: "A pet with more energy than the apartment.", ifClause: "your pet is bored by noon", gerund: "finding the toy under the sofa", noun: "a bored pet" },
  "toys-games": { statement: "Toys that last an afternoon.", ifClause: "new toys are forgotten by the weekend", gerund: "stepping on forgotten toys", noun: "toys that lose their charm fast" },
  stationery: { statement: "Notes that never get found again.", ifClause: "your notes end up everywhere", gerund: "losing the one page you need", noun: "notes you cannot find later" },
  "food-drink": { statement: "Snacks that are either good or good for you.", ifClause: "snack time means a compromise", gerund: "choosing between tasty and sensible", noun: "snacking that always compromises" },
  other: { statement: "The small problem that comes back every day.", ifClause: "the same small annoyance keeps returning", gerund: "putting up with it", noun: "the daily annoyance" },
};

function pain(input: ScriptInput) {
  return CATEGORY_PAIN[input.product.category] ?? CATEGORY_PAIN.other!;
}
function painPoint(i: ScriptInput): string {
  return pain(i).statement;
}
function painPointIf(i: ScriptInput): string {
  return pain(i).ifClause;
}
function painPointGerund(i: ScriptInput): string {
  return pain(i).gerund;
}
function painPointNoun(i: ScriptInput): string {
  return pain(i).noun;
}

/* ------------------------------------------------------------------ body writers */

/** Lead-ins for the second, third… selling point, used in order. */
const CONNECTORS: Record<Tone, readonly string[]> = {
  friendly: ["Then,", "Plus,", "And", "Also,", "On top of that,"],
  energetic: ["Next,", "Also,", "And", "Plus,", "Then,"],
  "calm-expert": ["Beyond that,", "Also,", "Then,", "And", "Lastly,"],
  playful: ["Also, yes:", "Bonus:", "Oh, and", "Plus,", "And"],
};

function connector(tone: Tone, n: number): string {
  const list = CONNECTORS[tone];
  return list[Math.min(n - 1, list.length - 1)]!;
}

const SHOW_LINES: Record<Tone, readonly string[]> = {
  friendly: ["Look at this.", "See that?", "Here, closer.", "Notice this part."],
  energetic: ["Look.", "See it?", "Right here.", "This part."],
  "calm-expert": ["Note the detail here.", "Look closely.", "Here is the detail.", "This is the part that matters."],
  playful: ["Peek.", "Ooh, this bit.", "Look at that.", "This part. Yes."],
};

interface BodyPlan {
  /** Sentences in reading order; `required` ones are always spoken, `optional` ones only while the budget allows. */
  parts: { text: string; required: boolean; reason?: boolean }[];
}

function bodyPlan(input: ScriptInput, seed: number): BodyPlan {
  const points = input.product.sellingPoints.map(clean).filter(Boolean);
  const tone = input.tone;
  const show = pick(SHOW_LINES[tone], seed, 2);
  const parts: BodyPlan["parts"] = [];
  const audience = input.product.audience?.trim();
  const intro = audience ? pick([`Made for ${inline(audience)}.`, `Built for ${inline(audience)}.`], seed, 3) : "";

  switch (input.angle) {
    case "demo": {
      if (intro) parts.push({ text: intro, required: false });
      points.forEach((pt, n) => parts.push({ text: n === 0 ? `${show} ${sentence(pt)}` : `${connector(tone, n)} ${inline(pt)}.`, required: n === 0 }));
      break;
    }
    case "unboxing": {
      if (intro) parts.push({ text: intro, required: false });
      points.forEach((pt, n) => parts.push({ text: n === 0 ? `Straight away, ${inline(pt)}.` : `${connector(tone, n)} ${inline(pt)}.`, required: n === 0 }));
      parts.push({ text: show, required: false });
      break;
    }
    case "problem-solution": {
      if (intro) parts.push({ text: intro, required: false });
      points.forEach((pt, n) => parts.push({ text: n === 0 ? `What changes: ${inline(pt)}.` : `${connector(tone, n)} ${inline(pt)}.`, required: n === 0 }));
      break;
    }
    case "three-reasons": {
      points.slice(0, 3).forEach((pt, n) => {
        const label = tone === "energetic" || tone === "playful" ? `${["One", "Two", "Three"][n]}:` : `Reason ${["one", "two", "three"][n]}:`;
        parts.push({ text: `${label} ${inline(pt)}.`, required: n === 0, reason: true });
      });
      if (points.length < 3) parts.push({ text: intro ? `${show} ${intro}` : show, required: false });
      break;
    }
  }
  return { parts };
}

/** Keeps every required sentence and adds optional ones in order while the whole script fits the budget. */
function assembleBody(plan: BodyPlan, hook: string, cta: string, budget: number): { body: string; /** reasons spoken (three-reasons angle) */ used: number } {
  const chosen = plan.parts.map((part) => part.required);
  const total = () => countWords(joinScript({ hook, body: plan.parts.filter((_, i) => chosen[i]).map((x) => x.text).join(" "), cta }));
  plan.parts.forEach((part, i) => {
    if (part.required) return;
    chosen[i] = true;
    if (total() > budget) chosen[i] = false;
  });
  const used = plan.parts.filter((part, i) => chosen[i] && part.reason).length;
  return { body: clean(plan.parts.filter((_, i) => chosen[i]).map((x) => x.text).join(" ")), used };
}

/* ------------------------------------------------------------------ calls to action */

const CTAS: Record<Tone, readonly ((p: string) => string)[]> = {
  friendly: [(p) => `${cap(p)} is linked below if you want a closer look.`, () => "Tap the link to see it in the shop.", (p) => `Details for ${p} are in the shop link.`],
  energetic: [() => "Tap the link. Go.", () => "It's in the shop link right now.", (p) => `Grab ${p} from the link below.`],
  "calm-expert": [() => "The full specs are in the shop link.", (p) => `${cap(p)} is available through the link below.`, () => "Open the link for sizes and details."],
  playful: [() => "Link's right there. You know what to do.", (p) => `${cap(p)} is one tap away.`, () => "Tap the shop link and have a look."],
};

const SHORT_CTAS: Record<Tone, readonly string[]> = {
  friendly: ["Link below.", "It's in the shop link.", "Shop link below."],
  energetic: ["Tap the link.", "Link below. Go.", "Shop link, now."],
  "calm-expert": ["Details in the link.", "Shop link below.", "Specs in the link."],
  playful: ["Link's below.", "One tap away.", "Shop link. Go on."],
};

/* ------------------------------------------------------------------ public API */

export function writeTemplateScript(input: ScriptInput): ScriptDraft {
  const seed = seedOf(input);
  const p = productLabel(input);
  const budget = wordBudget(input.durationSec);
  const tight = budget <= 25; // 10-second videos: short hook, short call to action

  const writeHook = (n: number) => {
    const pool = HOOKS[input.angle][input.tone];
    const limit = tight ? 10 : MAX_HOOK_WORDS;
    const first = (seed + 7919) % pool.length;
    for (let i = 0; i < pool.length; i++) {
      const h = clean(pool[(first + i) % pool.length]!(p, input, n));
      if (countWords(h) <= limit) return h;
    }
    return clean(`Meet ${p}.`);
  };
  const cta = clean(tight ? pick(SHORT_CTAS[input.tone], seed, 4) : pick(CTAS[input.tone], seed, 4)(p));

  const plan = bodyPlan(input, seed);
  let hook = writeHook(3);
  let assembled = assembleBody(plan, hook, cta, budget);
  if (input.angle === "three-reasons") {
    // The hook counts the reasons that are actually spoken.
    const reasons = Math.min(3, input.product.sellingPoints.length);
    const spoken = Math.max(1, Math.min(reasons, assembled.used));
    if (spoken !== 3) {
      hook = writeHook(spoken);
      assembled = assembleBody(plan, hook, cta, budget);
    }
  }

  const fitted = fitToBudget({ hook, body: assembled.body, cta }, budget);
  const fullText = joinScript(fitted);
  const note =
    input.language === "en"
      ? undefined
      : `Written in English. The presenter will speak these lines in ${languageName(input.language)}; you can also rewrite them in ${languageName(input.language)} here before generating.`;
  return { ...fitted, fullText, source: "template", note };
}
