import Link from "next/link";

/** The arch on a 32-unit grid: outer arch minus inner arch (evenodd). Shared with scripts/gen-icons.mjs. */
export const ARCH_PATH = "M6 30V15a10 10 0 0 1 20 0v15Z M11 30V16a5 5 0 0 1 10 0v14Z";
export const MUSE_DOT = { cx: 16, cy: 10, r: 2 } as const;

/**
 * The mark: an arched shop window, and the muse, a small dot at its crown.
 * A window is where a product is shown; the muse is the presence that makes people
 * stop and listen. It holds up in one colour, at 16px, and on a keynote screen.
 */
export function LogoMark({
  size = 28,
  className = "",
  mono = false,
  tone = "ink",
}: {
  size?: number;
  className?: string;
  /** One-colour rendering: the whole mark (dot included) takes currentColor. */
  mono?: boolean;
  /** Frame colour when not mono. */
  tone?: "ink" | "accent" | "light";
}) {
  const frame = mono ? "currentColor" : tone === "accent" ? "var(--accent)" : tone === "light" ? "#F3EFE7" : "var(--ink)";
  const dot = mono ? "currentColor" : "var(--muse)";
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d={ARCH_PATH} fillRule="evenodd" fill={frame} />
      <circle cx={MUSE_DOT.cx} cy={MUSE_DOT.cy} r={MUSE_DOT.r} fill={dot} />
    </svg>
  );
}

/** The wordmark, set in Fraunces at its softest. */
export function Wordmark({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span
      className={`font-display font-semibold tracking-[-0.018em] ${light ? "text-[#F3EFE6]" : "text-ink"} ${className}`}
      style={{ fontVariationSettings: '"SOFT" 100, "opsz" 30' }}
    >
      Window<span className={light ? "text-[#B7ADFF]" : "muse-text"}>Muse</span>
    </span>
  );
}

/** Mark + wordmark as one unit. */
export function Logo({ size = 26, className = "", light = false }: { size?: number; className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} tone={light ? "light" : "ink"} />
      <Wordmark className="text-[1.12rem] leading-none" light={light} />
    </span>
  );
}

/** Logo as the home link. */
export function LogoLink({ className = "", size = 26 }: { className?: string; size?: number }) {
  return (
    <Link href="/" aria-label="WindowMuse, home" className={`group inline-flex min-h-[44px] items-center gap-2 rounded-full pr-1 ${className}`}>
      <LogoMark size={size} className="transition-transform duration-500 group-hover:-translate-y-[1px]" />
      <Wordmark className="text-[1.12rem] leading-none" />
    </Link>
  );
}
