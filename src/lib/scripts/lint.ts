/**
 * Deterministic compliance check for presenter scripts. The rules come straight from the
 * product's honesty rules (docs/research/tiktok-aigc-policy.md): the presenter is a
 * fictional brand host, so a script may state verifiable product facts and may not sound
 * like a customer, a professional, or a medical promise.
 *
 *  fatal  → blocks generation (the Generate button stays disabled until it is fixed)
 *  warn   → shown next to the field with a suggested rewrite; generation proceeds
 *
 * Pure and client-safe: the Script pane runs it on every keystroke and the API runs the
 * same rules before saving. The rule table is exported so tests can pin every rule.
 */

export type LintLevel = "fatal" | "warn";

export interface LintRule {
  id: string;
  level: LintLevel;
  pattern: RegExp;
  /** Shown to the seller: what is wrong and how to say it instead. */
  message: string;
  /** Rules that are satisfied when another phrase is present (e.g. "results may vary"). */
  unless?: RegExp;
}

export interface Finding {
  rule: string;
  level: LintLevel;
  message: string;
  /** The offending words as written. */
  match: string;
  /** Character offset of the match in the text, for highlighting. */
  index: number;
}

export interface LintResult {
  fatal: Finding[];
  warn: Finding[];
}

const CONDITIONS =
  "disease|illness|infection|condition|cancer|diabetes|anxiety|depression|arthritis|inflammation|pain|acne|eczema|psoriasis|rosacea|insomnia|migraines?|headaches?|allerg(?:y|ies)|colds?|flu|covid|virus|hair loss|balding|wrinkles|cavities|gum disease|blood pressure|cholesterol|symptoms?";
const MEDICAL_VERBS = "cures?|cured|curing|treats?|treated|treating|treatment|prevents?|prevented|preventing|prevention|heals?|healed|healing|diagnos(?:e|es|ed|ing)|revers(?:e|es|ed|ing)|eliminates?|eliminated|eliminating";
const PROFESSIONS =
  "doctor|physician|dermatologist|dentist|nurse|pharmacist|surgeon|therapist|psychologist|nutritionist|dietitian|professor|scientist|chemist|lawyer|attorney|police officer|cop|veterinarian|vet|pediatrician|clinician|md";

export const LINT_RULES: readonly LintRule[] = [
  {
    id: "medical-claim",
    level: "fatal",
    pattern: new RegExp(`\\b(?:${MEDICAL_VERBS})\\b[^.!?]{0,80}\\b(?:${CONDITIONS})\\b|\\b(?:${CONDITIONS})\\b[^.!?]{0,80}\\b(?:${MEDICAL_VERBS})\\b`, "i"),
    message: "Medical claims (cure, treat, prevent, heal, eliminate a condition) are not allowed. Describe what the product is and does, for example “formulated with 2% salicylic acid”.",
  },
  {
    id: "weight-claim",
    level: "fatal",
    pattern: /\b(?:lose|loses|losing|lost|burns?|burning|melts?|melting|sheds?|shedding|drop|drops|dropping)\b[^.!?]{0,40}\b(?:weight|fat|pounds|lbs|kilos?|kg|inches|belly)\b|\b(?:weight[- ]loss|fat[- ]burn(?:er|ing)?|slimming|gain muscle|muscle gain|build muscle fast)\b/i,
    message: "Weight-loss, fat-burning and muscle-gain promises are not allowed. Stick to verifiable facts about the product.",
  },
  {
    id: "guaranteed",
    level: "fatal",
    pattern: /\bguarantee[sd]?\b|\bguaranteeing\b|\b100\s?%\s+(?:effective|works|results|success)\b/i,
    message: "“Guaranteed” results are not allowed. If there is a money-back policy, say exactly that: “30-day returns”.",
  },
  {
    id: "testimony",
    level: "fatal",
    pattern:
      /\b(?:I|I've|I have|I'd|I had)\s+(?:been\s+)?(?:using|used|use|tried|trying|bought|ordered|purchased|wearing|wore|worn|own|owned|tested|switched to|noticed|lost|gained|got)\b|\bmy\s+(?:skin|hair|face|body|teeth|weight|results|routine|experience|kids?|dog|cat|baby|husband|wife|family)\b|\b(?:as|from)\s+an?\s+(?:customer|user|buyer|owner)\b|\bsince\s+I\s+started\b|\bin\s+my\s+experience\b/i,
    message: "The presenter is a fictional brand host, not a customer. First-person experience (“I've been using”, “my skin”) reads as a fake testimonial. Say “This serum is made with…” or “Designed for…”.",
  },
  {
    id: "professional-persona",
    level: "fatal",
    pattern: new RegExp(`\\b(?:as an?|i'?m an?|i am an?|speaking as an?|this is your|your (?:friendly|local|resident)|from one|trust me,? i'?m an?)\\s+(?:${PROFESSIONS})\\b`, "i"),
    message: "The presenter may not pose as a doctor, dermatologist, nurse, pharmacist, lawyer or any other professional. Remove the persona and keep the product facts.",
  },
  {
    id: "professional-endorsement",
    level: "warn",
    pattern: new RegExp(`\\b(?:${PROFESSIONS})s?\\s+(?:recommend|recommended|approve|approved|agree|say|swear by|endorse|endorsed|trust)\\b|\\b(?:${PROFESSIONS})[- ](?:recommended|approved|endorsed)\\b`, "i"),
    message: "An endorsement by a profession needs substantiation you can show. Prefer the verifiable fact behind it, e.g. “dermatologist-tested in a 2025 panel of 40”.",
  },
  {
    id: "instant",
    level: "warn",
    pattern: /\b(?:instant(?:ly)?|immediate(?:ly)?|overnight|in seconds|in minutes|right away|miracle|miraculous|magic(?:al)?)\b/i,
    message: "“Instant”, “overnight” and “miracle” promise an effect. Say what the product does and how long it takes: “visibly smoother after four weeks”.",
  },
  {
    id: "before-after",
    level: "warn",
    pattern: /\b(?:before and after|before\/after|after (?:one|two|three|four|\d+) (?:days?|weeks?|months?|uses?)|(?:visible|noticeable) (?:results|difference|change))\b/i,
    unless: /\b(?:individual )?results (?:may|can|will) vary\b/i,
    message: "A before/after or timed-result claim needs “Individual results may vary” in the script.",
  },
  {
    id: "price",
    level: "warn",
    pattern: /(?:\$|€|£|¥|usd\s?)\d|\b\d+(?:\.\d+)?\s?(?:dollars|bucks|usd|percent off|% off)\b|\b(?:only|just)\s+\d+\b|\bfree shipping\b|\bdiscount\b|\bsale price\b/i,
    message: "Prices and promotions change; TikTok Shop shows the live price and any deal under the video. Leave the number out so the video stays accurate.",
  },
  {
    id: "superlative",
    level: "warn",
    pattern: /\b(?:the best|#\s?1|number one|clinically proven|scientifically proven|proven to|world's (?:best|first|only)|best[- ]selling|top[- ]rated|five[- ]star)\b/i,
    message: "Superlatives and “proven” claims need evidence you can show. Replace with the specific fact that makes it good.",
  },
  {
    id: "first-person",
    level: "warn",
    pattern: /\b(?:I|I'm|I've|I'd|I'll|[Mm]y|[Mm]ine)\b/,
    message: "First person reads like a personal opinion. Speak as the brand: “This…”, “It…”, “Designed for…”.",
  },
];

export function lintScript(text: string, opts: { language?: string } = {}): LintResult {
  const fatal: Finding[] = [];
  const warn: Finding[] = [];
  const subject = text ?? "";
  for (const rule of LINT_RULES) {
    const m = rule.pattern.exec(subject);
    if (!m) continue;
    if (rule.unless && rule.unless.test(subject)) continue;
    // One finding per rule: the first match is enough to point the seller at the problem.
    const finding: Finding = { rule: rule.id, level: rule.level, message: rule.message, match: m[0], index: m.index };
    (rule.level === "fatal" ? fatal : warn).push(finding);
  }
  if (opts.language && opts.language !== "en" && subject.trim()) {
    warn.push({
      rule: "language-coverage",
      level: "warn",
      message: "The compliance check reads English wording. Make sure the lines in your language follow the same rules: no customer testimony, no medical or guaranteed claims, no professional persona.",
      match: "",
      index: 0,
    });
  }
  return { fatal, warn };
}

export function hasFatal(result: LintResult): boolean {
  return result.fatal.length > 0;
}
