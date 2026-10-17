import type { Tool } from "@/content/tools/types";

export type ToolByKind = { [K in Tool["kind"]]: Extract<Tool, { kind: K }> };

/* One minimal, valid definition per kind: the fixtures double as the reference examples for the schema. */
export const FIXTURES: ToolByKind = {
  generator: {
    id: "hook-generator",
    kind: "generator",
    title: "TikTok Shop hook generator",
    lede: "Five opening lines for your product, in the first three seconds.",
    inputs: [
      { id: "product", type: "text", label: "Product", required: true, maxLength: 80 },
      { id: "points", type: "textarea", label: "Selling points, one per line", required: true },
      { id: "angle", type: "select", label: "Angle", options: [{ value: "problem", label: "Problem → solution" }, { value: "demo", label: "Demo" }] },
      { id: "seconds", type: "select", label: "Length", options: [{ value: "10", label: "10 s" }, { value: "15", label: "15 s" }], default: "15" },
      { id: "bold", type: "toggle", label: "Bolder wording" },
    ],
    variants: [
      { label: "Question", templates: ["{{pick:Still|Tired of}} {{points|first|lower}}? Meet the {{product}}.", "What if your {{product|lower}} could {{points|first|lower}}?"] },
      { label: "Contrast", templates: ["Most {{product|lower}}s stop at one thing. This one: {{points|list}}."], when: { input: "angle", is: "problem" } },
    ],
    count: 3,
    postProcess: "scriptLint",
    lengthBudget: { wordsPerSecond: 2.5, secondsInputId: "seconds" },
  },
  calculator: {
    id: "fee-calculator",
    kind: "calculator",
    title: "TikTok Shop fee calculator",
    lede: "What stays after the platform fee and your cost.",
    inputs: [
      { id: "price", type: "number", label: "Selling price", unit: "$", min: 0, default: 25 },
      { id: "cost", type: "number", label: "Unit cost", unit: "$", min: 0, default: 9 },
      { id: "fee", type: "select", label: "Referral fee", options: [{ value: "6", label: "6%" }, { value: "8", label: "8%" }] },
    ],
    outputs: [
      { id: "feeUsd", label: "Platform fee", formula: "price * fee / 100", format: "usd" },
      { id: "margin", label: "Margin per unit", formula: "price - cost - feeUsd", format: "usd", primary: true },
      { id: "marginPct", label: "Margin", formula: "if(price > 0, margin / price * 100, 0)", format: "pct" },
    ],
    table: { rowVar: "units", rows: [10, 50, 100], rowLabel: "Units", rowFormat: "int", columns: [{ label: "Profit", formula: "margin * units", format: "usd" }] },
  },
  converter: {
    id: "words-to-seconds",
    kind: "converter",
    title: "Words to seconds",
    lede: "How long a script takes to say.",
    a: { id: "words", label: "Words", format: "words", default: 38, min: 0 },
    b: { id: "seconds", label: "Seconds", format: "seconds", min: 0 },
    params: [{ id: "pace", type: "select", label: "Pace", options: [{ value: "2", label: "Calm (2 words/s)" }, { value: "2.5", label: "Normal (2.5 words/s)" }], default: "2.5" }],
    aToB: "words / pace",
    bToA: "round(seconds * pace)",
  },
  checker: {
    id: "claim-checker",
    kind: "checker",
    title: "Script claim checker",
    lede: "Paste a script; see what TikTok Shop would flag.",
    input: { label: "Your script", placeholder: "Paste the script here" },
    ruleSets: ["scriptLint", { id: "all-caps", label: "Shouting", severity: "info", pattern: "\\b[A-Z]{4,}\\b", message: "All-caps words read as shouting.", suggestion: "Use normal case." }],
    stats: ["words", "sentences", "seconds@2.5", "readingLevel"],
  },
  quiz: {
    id: "ready-quiz",
    kind: "quiz",
    title: "Is your listing ready for video?",
    lede: "Four questions.",
    questions: [
      { q: "Do you have product photos from several angles?", options: [{ label: "Yes, 3 or more", points: 2 }, { label: "One or two", points: 1 }, { label: "None yet", points: 0 }] },
      { q: "Is the product card live on TikTok Shop?", options: [{ label: "Yes", points: 2 }, { label: "Not yet", points: 0 }] },
    ],
    results: [
      { range: [0, 1], title: "Not yet", body: "Get the photos and the card first." },
      { range: [2, 3], title: "Almost", body: "One more step." },
      { range: [4, 4], title: "Ready", body: "Make the video.", cta: { label: "Start free", href: "/sign-in" } },
    ],
  },
  decision: {
    id: "format-picker",
    kind: "decision",
    title: "Which video format?",
    lede: "Two questions, one answer.",
    nodes: {
      start: { question: "Is the product used in the hand?", options: [{ label: "Yes", next: "demo" }, { label: "No", next: "size" }] },
      size: { question: "Is size the main question buyers ask?", options: [{ label: "Yes", next: "unboxing" }, { label: "No", next: "reasons" }] },
    },
    leaves: {
      demo: { title: "Demo", body: "Show it working." },
      unboxing: { title: "Unboxing", body: "Show the box and the scale." },
      reasons: { title: "Three reasons", body: "Three facts, one each." },
    },
  },
  checklist: {
    id: "post-checklist",
    kind: "checklist",
    title: "Before you post",
    lede: "Everything TikTok asks for on an AI presenter video.",
    sections: [{ title: "Labels", items: [{ text: "AI-generated content switch on", note: "More options → AI-generated content" }, { text: "Commercial content disclosure on" }] }],
  },
  brief: {
    id: "creator-brief",
    kind: "brief",
    title: "Creator brief builder",
    lede: "A one-page brief from four fields.",
    inputs: [
      { id: "product", type: "text", label: "Product", required: true },
      { id: "points", type: "textarea", label: "Selling points", required: true },
      { id: "paid", type: "toggle", label: "Paid partnership" },
    ],
    docTitle: "Brief: {{product}}",
    sections: [
      { heading: "What to show", template: "The {{product}} in use.\n\n{{points|bullets}}" },
      { heading: "Disclosure", template: "Turn on the paid partnership label.", when: { input: "paid", is: "true" } },
    ],
  },
};
