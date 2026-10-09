import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

/* Static woff files from @fontsource (satori reads woff/ttf/otf, not woff2). */
function font(pkg: string, file: string): Buffer {
  return fs.readFileSync(path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file));
}

function fonts() {
  return [
    { name: "Fraunces", data: font("fraunces", "fraunces-latin-600-normal.woff"), weight: 600 as const, style: "normal" as const },
    { name: "Fraunces", data: font("fraunces", "fraunces-latin-500-italic.woff"), weight: 500 as const, style: "italic" as const },
    { name: "Geist", data: font("geist-sans", "geist-sans-latin-500-normal.woff"), weight: 500 as const, style: "normal" as const },
    { name: "Geist", data: font("geist-sans", "geist-sans-latin-600-normal.woff"), weight: 600 as const, style: "normal" as const },
  ];
}

const INK = "#15110E";
const INK_2 = "#4A423B";
const INK_4 = "#8A8178";
const ACCENT_TEXT = "#B8431F";
const MUSE = "#6B5BFF";

/** The arch mark (same geometry as src/components/Logo.tsx). */
function Mark({ size, frame = INK }: { size: number; frame?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M6 30V15a10 10 0 0 1 20 0v15Z M11 30V16a5 5 0 0 1 10 0v14Z" fillRule="evenodd" fill={frame} />
      <circle cx="16" cy="10" r="2" fill={MUSE} />
    </svg>
  );
}

/** A 9:16 phone with an arched window and a silhouette: the product of the product, abstractly. */
function Phone() {
  return (
    <div
      style={{
        display: "flex",
        width: 236,
        height: 420,
        borderRadius: 36,
        background: "#15110E",
        boxShadow: "0 0 0 2px rgba(21,17,14,0.12), 0 40px 70px -30px rgba(21,17,14,0.6)",
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          borderRadius: 26,
          background: "linear-gradient(180deg, #2A251F 0%, #1A1714 100%)",
          alignItems: "flex-end",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <svg width="208" height="392" viewBox="0 0 120 226">
          <path d="M18 226 V100 A42 42 0 0 1 102 100 V226 Z" fill="#F6D8C9" />
          <path d="M26 226 V198 Q26 172 58 170 L62 170 Q94 172 94 198 V226 Z" fill="#5A2E22" />
          <circle cx="60" cy="106" r="20" fill="#5A2E22" />
          <ellipse cx="60" cy="128" rx="24" ry="20" fill="#5A2E22" />
          <rect x="52" y="146" width="16" height="30" rx="6" fill="#9A6B5A" />
          <ellipse cx="60" cy="132" rx="19" ry="22" fill="#9A6B5A" />
          <circle cx="60" cy="58" r="3.5" fill={MUSE} />
        </svg>
      </div>
    </div>
  );
}

/** Brand OG card: warm paper, one floating pane, the words, and a phone with the window in it. */
export function ogCard({ eyebrow, title, subtitle, withPhone = true }: { eyebrow: string; title: string; subtitle?: string; withPhone?: boolean }) {
  const titleSize = title.length > 64 ? 50 : title.length > 40 ? 58 : 66;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(900px 560px at 8% -10%, rgba(232,86,42,0.18), transparent 62%), #F3EFE7",
          padding: 48,
          fontFamily: "Geist",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            borderRadius: 40,
            background: "#FFFFFF",
            boxShadow: "0 0 0 2px rgba(21,17,14,0.08), 0 40px 80px -30px rgba(21,17,14,0.35)",
            padding: "52px 60px",
            gap: 44,
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: ACCENT_TEXT }}>{eyebrow}</div>
            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontFamily: "Fraunces",
                fontWeight: 600,
                fontSize: titleSize,
                lineHeight: 1.06,
                color: INK,
                letterSpacing: -1.2,
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div style={{ display: "flex", marginTop: 22, fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 500, fontSize: 28, lineHeight: 1.3, color: INK_2 }}>
                {subtitle}
              </div>
            ) : null}
            <div style={{ display: "flex", marginTop: "auto", alignItems: "center", gap: 14 }}>
              <Mark size={44} />
              <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: 32, color: INK, letterSpacing: -0.5 }}>
                Window<span style={{ color: MUSE }}>Muse</span>
              </div>
              <div style={{ display: "flex", marginLeft: 14, fontSize: 22, color: INK_4 }}>windowmuse.com</div>
            </div>
          </div>
          {withPhone ? (
            <div style={{ display: "flex", alignItems: "center" }}>
              <Phone />
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts() },
  );
}
