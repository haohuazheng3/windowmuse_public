import type { Presenter } from "@/content/presenters";

/*
 * Abstract presenter portrait: a soft arched window with a stylised silhouette inside,
 * coloured from the persona's palette. No faces, no photos. The silhouette is picked
 * deterministically from the presenter id, so a card always looks the same.
 */

type Hair = "short" | "buzz" | "curls" | "puff" | "waves" | "long" | "bob" | "bun" | "ponytail" | "hijab" | "braids" | "cap" | "braid";

const HAIR_BY_ID: Record<string, Hair> = {
  maya: "puff",
  jun: "short",
  sofia: "waves",
  elias: "short",
  priya: "bun",
  theo: "curls",
  amara: "buzz",
  mateo: "cap",
  hana: "bob",
  kwame: "short",
  linh: "long",
  owen: "short",
  zara: "waves",
  diego: "curls",
  nadia: "ponytail",
  felix: "short",
  aisha: "braids",
  ravi: "short",
  mei: "ponytail",
  lucas: "curls",
  chloe: "bob",
  noor: "hijab",
  sam: "curls",
  ingrid: "braid",
  tariq: "curls",
};

const HAIRS: Hair[] = ["short", "buzz", "curls", "puff", "waves", "long", "bob", "bun", "ponytail", "hijab", "braids", "cap", "braid"];

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function hairFor(id: string): Hair {
  return HAIR_BY_ID[id] ?? HAIRS[hashId(id) % HAIRS.length];
}

/** Blend two hex colours (#rrggbb); t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function HairBehind({ hair, fg }: { hair: Hair; fg: string }) {
  switch (hair) {
    case "short":
      return <ellipse cx="60" cy="59" rx="22.5" ry="25.5" fill={fg} />;
    case "buzz":
      return <ellipse cx="60" cy="60" rx="21" ry="24.5" fill={fg} />;
    case "curls":
      return (
        <g fill={fg}>
          <circle cx="44" cy="48" r="12" />
          <circle cx="60" cy="40" r="14" />
          <circle cx="76" cy="48" r="12" />
          <circle cx="38" cy="60" r="9" />
          <circle cx="82" cy="60" r="9" />
          <ellipse cx="60" cy="58" rx="22" ry="22" />
        </g>
      );
    case "puff":
      return (
        <g fill={fg}>
          <circle cx="60" cy="34" r="19" />
          <ellipse cx="60" cy="58" rx="24" ry="22" />
        </g>
      );
    case "waves":
      return <path d="M36 56 Q28 92 34 120 L86 120 Q92 92 84 56 A24 27 0 0 0 36 56 Z" fill={fg} />;
    case "long":
      return <path d="M38 54 L33 122 L87 122 L82 54 A22 25 0 0 0 38 54 Z" fill={fg} />;
    case "bob":
      return <path d="M36 52 Q33 72 38 88 L82 88 Q87 72 84 52 A24 26 0 0 0 36 52 Z" fill={fg} />;
    case "bun":
      return (
        <g fill={fg}>
          <circle cx="60" cy="36" r="8" />
          <ellipse cx="60" cy="59" rx="22" ry="25" />
        </g>
      );
    case "ponytail":
      return (
        <g fill={fg}>
          <ellipse cx="60" cy="59" rx="22" ry="25" />
          <path d="M72 48 Q94 70 86 112 Q82 115 77 110 Q84 78 66 56 Z" />
        </g>
      );
    case "hijab":
      return <path d="M24 150 V112 Q24 62 60 34 Q96 62 96 112 V150 Z" fill={fg} />;
    case "braids":
      return (
        <g fill={fg}>
          <circle cx="60" cy="31" r="10" />
          <path d="M44 48 Q34 92 39 134 L50 134 Q47 92 53 54 Z" />
          <path d="M76 48 Q86 92 81 134 L70 134 Q73 92 67 54 Z" />
          <ellipse cx="60" cy="58" rx="22" ry="24" />
        </g>
      );
    case "cap":
      return <ellipse cx="60" cy="60" rx="21" ry="24" fill={fg} />;
    case "braid":
      return (
        <g fill={fg}>
          <ellipse cx="60" cy="59" rx="22" ry="25" />
          <path d="M74 52 Q86 90 80 130 Q75 134 69 129 Q74 92 65 58 Z" />
        </g>
      );
  }
}

function HairFront({ hair, fg }: { hair: Hair; fg: string }) {
  switch (hair) {
    case "cap":
      return (
        <g fill={fg}>
          <path d="M36 60 A24 25 0 0 1 84 60 L84 63 L36 63 Z" />
          <path d="M80 56 h13 a3.5 3.5 0 0 1 0 7 h-13 z" />
        </g>
      );
    case "long":
      return <path d="M40 58 Q40 40 60 39 Q80 40 80 58 Q60 50 40 58 Z" fill={fg} />;
    case "bob":
      return <path d="M39 57 Q39 39 60 38 Q81 39 81 57 Q60 49 39 57 Z" fill={fg} />;
    default:
      return null;
  }
}

export function PresenterAvatar({
  presenter,
  size = 160,
  className = "",
  decorative = false,
}: {
  presenter: Pick<Presenter, "id" | "name" | "gender" | "palette">;
  /** Rendered width in px; the portrait is 4:5. */
  size?: number;
  className?: string;
  /** True when the name is already visible next to the avatar. */
  decorative?: boolean;
}) {
  const { bg, fg } = presenter.palette;
  const hair = hairFor(presenter.id);
  const skin = mix(fg, bg, 0.3);
  const frame = mix(fg, bg, 0.72);
  const glow = mix(bg, "#ffffff", 0.55);
  const broad = presenter.gender === "man" ? 8 : 0;
  const gid = `wm-av-${presenter.id.replace(/[^a-z0-9]/gi, "")}`;
  const label = `${presenter.name}, abstract portrait`;

  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={Math.round(size * 1.25)}
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <defs>
        <clipPath id={`${gid}-arch`}>
          <path d="M8 150 V60 A52 52 0 0 1 112 60 V150 Z" />
        </clipPath>
        <radialGradient id={`${gid}-light`} cx="0.18" cy="0.1" r="0.8">
          <stop offset="0" stopColor={glow} stopOpacity="0.9" />
          <stop offset="1" stopColor={bg} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the window */}
      <path d="M8 150 V60 A52 52 0 0 1 112 60 V150 Z" fill={bg} />
      <path d="M8 150 V60 A52 52 0 0 1 112 60 V150 Z" fill={`url(#${gid}-light)`} />
      <g clipPath={`url(#${gid}-arch)`}>
        {/* shoulders */}
        <path
          d={`M${16 - broad} 150 V130 Q${16 - broad} 102 ${46 - broad / 2} 100 L${74 + broad / 2} 100 Q${104 + broad} 102 ${104 + broad} 130 V150 Z`}
          fill={fg}
        />
        <HairBehind hair={hair} fg={fg} />
        {/* neck */}
        <rect x="52" y="76" width="16" height="28" rx="6" fill={skin} />
        {/* head: no features, ever */}
        <ellipse cx="60" cy="62" rx="20" ry="23" fill={skin} />
        <HairFront hair={hair} fg={fg} />
      </g>
      {/* the frame and the muse at the crown */}
      <path d="M8 150 V60 A52 52 0 0 1 112 60 V150" fill="none" stroke={frame} strokeWidth="2" />
      <circle cx="60" cy="8" r="3" fill="var(--muse)" />
      {decorative ? null : <title>{label}</title>}
    </svg>
  );
}
