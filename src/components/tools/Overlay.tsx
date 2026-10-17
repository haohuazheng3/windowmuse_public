"use client";

import { useMemo, useState } from "react";
import type { OverlayTool, OverlayZone } from "@/content/tools/types";
import { useToolEvents, whenMatches, type Values } from "./shared";

/*
 * A vertical frame with the areas the app interface covers and the area to keep the product
 * and any text in. Toggles switch zones (a long caption, a product link). The overlay can be
 * downloaded as a transparent PNG at full frame size or as an SVG, to drop over a video in an
 * editor. Everything is drawn in the browser.
 */

const UI_FILL = "rgba(232, 86, 42, 0.32)";
const UI_STROKE = "rgba(232, 86, 42, 0.9)";
const SAFE_STROKE = "rgba(31, 122, 77, 0.95)";

function px(z: OverlayZone, w: number, h: number) {
  return { x: Math.round((z.x / 100) * w), y: Math.round((z.y / 100) * h), w: Math.round((z.w / 100) * w), h: Math.round((z.h / 100) * h) };
}

function overlaySvg(zones: OverlayZone[], w: number, h: number, labels: boolean): string {
  const fs = Math.round(w / 30);
  const parts = zones.map((z) => {
    const r = px(z, w, h);
    const rect =
      z.tone === "ui"
        ? `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${UI_FILL}" stroke="${UI_STROKE}" stroke-width="${Math.max(2, w / 360)}"/>`
        : `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${SAFE_STROKE}" stroke-width="${Math.max(3, w / 270)}" stroke-dasharray="${w / 40} ${w / 60}"/>`;
    const text = labels
      ? `<text x="${r.x + fs * 0.6}" y="${r.y + fs * 1.4}" font-family="Helvetica, Arial, sans-serif" font-size="${fs}" font-weight="600" fill="${z.tone === "ui" ? "#7A2A10" : "#145236"}">${z.label.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`
      : "";
    return rect + text;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OverlayView({ tool }: { tool: OverlayTool }) {
  const [values, setValues] = useState<Values>(() => Object.fromEntries(tool.inputs.map((i) => [i.id, i.default ?? false])));
  const [labels, setLabels] = useState(true);
  const events = useToolEvents(tool);
  const zones = useMemo(() => tool.zones.filter((z) => whenMatches(z.when, values)), [tool.zones, values]);
  const svg = useMemo(() => overlaySvg(zones, tool.width, tool.height, labels), [zones, tool.width, tool.height, labels]);

  const savePng = () => {
    events.result({ format: "png" });
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = tool.width;
      canvas.height = tool.height;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => b && download(`${tool.id}-${tool.width}x${tool.height}.png`, b), "image/png");
    };
    img.src = url;
  };
  const saveSvg = () => {
    events.result({ format: "svg" });
    download(`${tool.id}-${tool.width}x${tool.height}.svg`, new Blob([svg], { type: "image/svg+xml" }));
  };

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,15rem)_1fr]">
      <div className="mx-auto w-full max-w-[15rem] min-w-0">
        <div className="relative overflow-hidden rounded-[20px] border border-line-2 bg-[repeating-linear-gradient(45deg,var(--pane-2),var(--pane-2)_10px,var(--pane-3)_10px,var(--pane-3)_20px)]" style={{ aspectRatio: `${tool.width} / ${tool.height}` }}>
          <div className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <p className="mt-2 text-center text-[0.8rem] text-ink-4">
          {tool.width} × {tool.height} px
        </p>
      </div>
      <div className="min-w-0 space-y-4">
        {tool.inputs.length ? (
          <div className="flex flex-wrap gap-2">
            {tool.inputs.map((inp) => {
              const on = values[inp.id] === true;
              return (
                <button
                  key={inp.id}
                  type="button"
                  className="chip"
                  data-selected={on ? "" : undefined}
                  aria-pressed={on}
                  onClick={() => {
                    events.used();
                    setValues((v) => ({ ...v, [inp.id]: !on }));
                  }}
                >
                  {inp.label}
                </button>
              );
            })}
            <button type="button" className="chip" data-selected={labels ? "" : undefined} aria-pressed={labels} onClick={() => setLabels((l) => !l)}>
              Labels on overlay
            </button>
          </div>
        ) : null}
        <ul className="space-y-2 text-[0.94rem]">
          {zones.map((z) => {
            const r = px(z, tool.width, tool.height);
            return (
              <li key={z.id} className="flex items-start gap-3">
                <span aria-hidden="true" className={`mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-[4px] ${z.tone === "ui" ? "bg-[#E8562A]/60" : "border-2 border-dashed border-[#1F7A4D]"}`} />
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{z.label}</span>
                  <span className="block tabular-nums text-ink-3">
                    x {r.x}, y {r.y}, {r.w} × {r.h} px
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={savePng}>
            Download PNG overlay
          </button>
          <button type="button" className="btn btn-ghost" onClick={saveSvg}>
            Download SVG
          </button>
        </div>
        {tool.note ? <p className="text-[0.82rem] leading-relaxed text-ink-4">{tool.note}</p> : null}
      </div>
    </div>
  );
}
