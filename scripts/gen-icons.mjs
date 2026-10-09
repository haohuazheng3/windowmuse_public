// Generates every raster icon from the logo mark (one source of truth).
// Usage: node scripts/gen-icons.mjs   (npm run icons)
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (p) => path.join(root, "public", p);

// Tile: the always-dark pane; the arch in warm paper; the muse in violet.
const BG = "#15110E";
const FRAME = "#F3EFE7";
const MUSE = "#6B5BFF";

// The mark on a 32-unit grid (same geometry as src/components/Logo.tsx):
// outer arch minus inner arch (evenodd), and the muse dot at the crown.
const ARCH = "M6 30V15a10 10 0 0 1 20 0v15Z M11 30V16a5 5 0 0 1 10 0v14Z";
const mark = (frame = FRAME, muse = MUSE) => `
  <path d="${ARCH}" fill-rule="evenodd" fill="${frame}"/>
  <circle cx="16" cy="10" r="2" fill="${muse}"/>`;

// Square tile with the mark scaled into a safe area.
function tile({ size = 512, radius = 0.22, pad = 0.16, bg = BG } = {}) {
  const r = size * radius;
  const inner = size * (1 - pad * 2);
  const scale = inner / 32;
  const off = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/>
  <g transform="translate(${off} ${off}) scale(${scale})">${mark()}</g>
</svg>`;
}

function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}

fs.mkdirSync(pub("brand"), { recursive: true });

// icon.svg (crisp at any size, used by modern browsers as the favicon)
fs.writeFileSync(pub("icon.svg"), tile({ size: 64, radius: 0.24, pad: 0.12 }));
// one-colour mark for print and single-colour uses (dot included, as the brand allows)
fs.writeFileSync(pub("brand/logo-mark.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${mark("#15110E", "#15110E")}</svg>`);
fs.writeFileSync(pub("brand/logo-tile.svg"), tile({ size: 512 }));

// PNGs
const sizes = {
  "apple-icon.png": [180, { radius: 0, pad: 0.17 }],
  "icon-192.png": [192, {}],
  "icon-512.png": [512, {}],
  "brand/logo-512.png": [512, {}],
  "brand/logo-1024.png": [1024, {}],
};
for (const [file, [size, opts]] of Object.entries(sizes)) {
  fs.writeFileSync(pub(file), png(tile({ size, ...opts }), size));
}
// maskable icon: full-bleed background, mark inside the 80% safe zone
fs.writeFileSync(pub("icon-maskable-512.png"), png(tile({ size: 512, radius: 0, pad: 0.24 }), 512));

// favicon.ico with 16/32/48 PNG entries
const icoSizes = [16, 32, 48];
const images = icoSizes.map((s) => png(tile({ size: 64, radius: 0.24, pad: s <= 16 ? 0.06 : 0.1 }), s));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const dir = [];
images.forEach((buf, i) => {
  const e = Buffer.alloc(16);
  const s = icoSizes[i];
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  dir.push(e);
});
fs.writeFileSync(pub("favicon.ico"), Buffer.concat([header, ...dir, ...images]));
console.log("icons written to public/");
