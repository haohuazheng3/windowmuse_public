/** Pure pieces of the daily error digest (src/lib/error-digest.ts), kept apart so they are unit-tested. */

export interface DigestItem {
  name: string;
  message: string;
  source: string;
  route: string | null;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

/** The UTC calendar day, YYYY-MM-DD: the digest's "once a day" unit. */
export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function stamp(d: Date): string {
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function oneLine(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function formatDigest(input: { day: string; openErrors: number; openWarnings: number; items: DigestItem[]; inboxUrl: string }): { subject: string; text: string } {
  const { day, openErrors, openWarnings, items, inboxUrl } = input;
  const plural = openErrors === 1 ? "error" : "errors";
  const lines = [
    `${openErrors} open ${plural} in the error inbox (${day}, UTC).`,
    "The site itself is up: open errors no longer fail /api/health. This digest is sent at most once a day while any stay open.",
    "",
    ...items.flatMap((e, i) => [
      `${i + 1}. ${oneLine(`${e.name}: ${e.message}`, 220)}`,
      `   ${e.source} · ${e.route ?? "no route"} · ×${e.count} · first ${stamp(e.firstSeen)} · last ${stamp(e.lastSeen)}`,
    ]),
    ...(openErrors > items.length ? ["", `…and ${openErrors - items.length} more.`] : []),
    ...(openWarnings > 0 ? ["", `Also open: ${openWarnings} warning${openWarnings === 1 ? "" : "s"} (listed in the inbox, not here).`] : []),
    "",
    `Review and resolve: ${inboxUrl}`,
  ];
  return { subject: `Daily error digest: ${openErrors} open ${plural}`, text: lines.join("\n") };
}
