#!/usr/bin/env node
// Render device mockups (SVG phone / browser frames + zoom callouts) to transparent PNGs.
// Usage: node scripts/guide-images/mockups.mjs <guides|pitch> [name-prefix]
//   GUIDE_SOURCE_DIR  — screenshots from the visual-guide capture run (default: submission/visual-guide-assets)
//   GUIDE_CAPTURE_DIR — screenshots from capture.mjs (default: scripts/guide-images/.out/captures)
// Output: scripts/guide-images/.out/mockups/<set>/*.png — then run to_webp.py.
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../../frontend/package.json", import.meta.url))("@playwright/test");
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SET = process.argv[2] || "guides";
const VG = process.env.GUIDE_SOURCE_DIR || path.join(HERE, "..", "..", "submission", "visual-guide-assets");
const CAP = process.env.GUIDE_CAPTURE_DIR || path.join(HERE, ".out", "captures");
const OUT = path.join(HERE, ".out", "mockups", SET);
fs.mkdirSync(OUT, { recursive: true });
const uri = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");

const BLUE = "#0468b1";

// ---------- phone ----------
// Screen is 390x844 CSS (screenshots are 780x1688 @2x). Status bar 30px in app-header blue.
function phone({ img, callout, label }) {
  const SW = 390, SB = 30, SH = 844 + SB, B = 14; // screen w, status bar, screen h, bezel
  const W = SW + B * 2, H = SH + B * 2, R = 58, r = R - B;
  const pad = callout ? Math.max(260, callout.w * (callout.scale || 1.7) * 0.7 + 50) : 40; // room for callout + shadow
  const vbW = W + pad * 2, vbH = H + 120;
  const ox = pad, oy = 30;
  let co = "";
  if (callout) {
    const { x, y, w, h, side = "right", cy = y } = callout; // source rect in screenshot CSS px
    const scale = callout.scale || 1.7;
    const cw = w * scale, ch = h * scale;
    const sx = ox + B + x, sy = oy + B + SB + y; // source rect in viewBox
    const cx = side === "right" ? ox + W - cw * 0.35 : ox - cw * 0.65;
    const cyy = oy + B + SB + cy - ch / 2 + h / 2;
    co = `
      <rect x="${sx}" y="${sy}" width="${w}" height="${h}" rx="8" fill="none" stroke="${BLUE}" stroke-width="3"/>
      <line x1="${side === "right" ? sx + w : sx}" y1="${sy + h / 2}" x2="${side === "right" ? cx : cx + cw}" y2="${cyy + ch / 2}" stroke="${BLUE}" stroke-width="3"/>
      <g filter="url(#sh2)">
        <rect x="${cx - 6}" y="${cyy - 6}" width="${cw + 12}" height="${ch + 12}" rx="20" fill="#fff"/>
      </g>
      <svg x="${cx}" y="${cyy}" width="${cw}" height="${ch}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid slice">
        <clipPath id="cc"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${14 / scale}"/></clipPath>
        <image href="${img}" x="0" y="0" width="390" height="844" clip-path="url(#cc)"/>
      </svg>
      <rect x="${cx}" y="${cyy}" width="${cw}" height="${ch}" rx="14" fill="none" stroke="${BLUE}" stroke-width="4"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW}" height="${vbH}" viewBox="0 0 ${vbW} ${vbH}">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f47"/><stop offset=".5" stop-color="#1d2026"/><stop offset="1" stop-color="#2c3038"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b9099"/><stop offset=".5" stop-color="#d7dae0"/><stop offset="1" stop-color="#7d828b"/></linearGradient>
    <filter id="sh" x="-20%" y="-10%" width="140%" height="125%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0b1a2e" flood-opacity=".28"/></filter>
    <filter id="sh2" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0b1a2e" flood-opacity=".25"/></filter>
    <clipPath id="scr"><rect x="${ox + B}" y="${oy + B}" width="${SW}" height="${SH}" rx="${r}"/></clipPath>
  </defs>
  <!-- side buttons -->
  <rect x="${ox - 4}" y="${oy + 150}" width="6" height="34" rx="3" fill="url(#edge)"/>
  <rect x="${ox - 4}" y="${oy + 205}" width="6" height="62" rx="3" fill="url(#edge)"/>
  <rect x="${ox - 4}" y="${oy + 280}" width="6" height="62" rx="3" fill="url(#edge)"/>
  <rect x="${ox + W - 2}" y="${oy + 225}" width="6" height="96" rx="3" fill="url(#edge)"/>
  <!-- body -->
  <g filter="url(#sh)"><rect x="${ox}" y="${oy}" width="${W}" height="${H}" rx="${R}" fill="url(#body)"/></g>
  <rect x="${ox + 1.5}" y="${oy + 1.5}" width="${W - 3}" height="${H - 3}" rx="${R - 1.5}" fill="none" stroke="url(#edge)" stroke-width="3"/>
  <rect x="${ox + B - 2}" y="${oy + B - 2}" width="${SW + 4}" height="${SH + 4}" rx="${r + 2}" fill="#000"/>
  <!-- screen -->
  <g clip-path="url(#scr)">
    <rect x="${ox + B}" y="${oy + B}" width="${SW}" height="${SB}" fill="${img.includes("offline") ? "#fde68a" : BLUE}"/>
    <image href="${img}" x="${ox + B}" y="${oy + B + SB}" width="${SW}" height="844"/>
    <!-- status bar -->
    <text x="${ox + B + 34}" y="${oy + B + 21}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#fff">9:41</text>
    <g transform="translate(${ox + B + SW - 92},${oy + B + 10})" fill="#fff">
      <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="6" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
      <path d="M27 4.5a10 10 0 0 1 14 0l-1.6 1.7a7.6 7.6 0 0 0-10.8 0zM30.2 7.8a5.5 5.5 0 0 1 7.6 0L34 11.8z"/>
      <rect x="50" y="1" width="22" height="11" rx="3" fill="none" stroke="#fff" stroke-width="1.4"/><rect x="52" y="3" width="15" height="7" rx="1.5"/><rect x="73" y="4.5" width="2" height="4" rx="1"/>
    </g>
  </g>
  <!-- camera punch hole -->
  <circle cx="${ox + W / 2}" cy="${oy + B + 15}" r="7" fill="#05070a"/><circle cx="${ox + W / 2 + 2}" cy="${oy + B + 13}" r="2" fill="#26303d"/>
  ${co}
</svg>`;
}

// ---------- browser window ----------
function browser({ img, w, h, url, crop }) {
  // crop: {x,y,w,h} in source px; image shown at width DW
  const DW = crop ? crop.w : w, DH = crop ? crop.h : h;
  const BAR = 40, pad = 46;
  const W = DW, H = DH + BAR;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + pad * 2}" height="${H + pad * 2}" viewBox="0 0 ${W + pad * 2} ${H + pad * 2}">
  <defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0b1a2e" flood-opacity=".22"/></filter>
  <clipPath id="win"><rect x="${pad}" y="${pad}" width="${W}" height="${H}" rx="12"/></clipPath></defs>
  <g filter="url(#sh)"><rect x="${pad}" y="${pad}" width="${W}" height="${H}" rx="12" fill="#fff"/></g>
  <g clip-path="url(#win)">
    <rect x="${pad}" y="${pad}" width="${W}" height="${BAR}" fill="#e9ecf1"/>
    <circle cx="${pad + 20}" cy="${pad + 20}" r="6" fill="#ff5f57"/><circle cx="${pad + 40}" cy="${pad + 20}" r="6" fill="#febc2e"/><circle cx="${pad + 60}" cy="${pad + 20}" r="6" fill="#28c840"/>
    <rect x="${pad + 90}" y="${pad + 9}" width="${Math.min(460, W - 120)}" height="22" rx="11" fill="#fff"/>
    <text x="${pad + 106}" y="${pad + 25}" font-family="Arial, sans-serif" font-size="13" fill="#4b5563">🔒 ${url}</text>
    <svg x="${pad}" y="${pad + BAR}" width="${DW}" height="${DH}" viewBox="${crop ? `${crop.x} ${crop.y} ${crop.w} ${crop.h}` : `0 0 ${w} ${h}`}" preserveAspectRatio="xMidYMid slice">
      <image href="${img}" x="0" y="0" width="${w}" height="${h}"/>
    </svg>
  </g>
  <rect x="${pad}" y="${pad}" width="${W}" height="${H}" rx="12" fill="none" stroke="#cfd5dd" stroke-width="1"/>
</svg>`;
}

// ---------- plain rounded panel (time sequence) ----------
function panel({ img, w, h }) {
  const pad = 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}" viewBox="0 0 ${w + pad * 2} ${h + pad * 2}">
  <defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0b1a2e" flood-opacity=".22"/></filter>
  <clipPath id="c"><rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="12"/></clipPath></defs>
  <g filter="url(#sh)"><rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="12" fill="#fff"/></g>
  <image href="${img}" x="${pad}" y="${pad}" width="${w}" height="${h}" clip-path="url(#c)"/>
  <rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="12" fill="none" stroke="#cfd5dd"/>
</svg>`;
}

const PITCH = () => ({
  // Slide A — reporting flow
  "a1-open": phone({ img: uri(path.join(VG, "c-initial.png")) }),
  "a2-ai": phone({ img: uri(path.join(VG, "c-photo-ai.png")), callout: { x: 8, y: 360, w: 272, h: 92, side: "right", scale: 1.55 } }),
  "a3-offline": phone({ img: uri(path.join(VG, "c-offline.png")) }),
  "a4-done": phone({ img: uri(path.join(VG, "c-confirm.png")) }),
  // Slide B — location
  "b1-building": phone({ img: uri(path.join(VG, "c-building.png")), callout: { x: 4, y: 728, w: 320, h: 40, side: "right", scale: 1.5 } }),
  "b2-landmark": phone({ img: uri(path.join(VG, "c-landmark.png")), callout: { x: 6, y: 640, w: 370, h: 115, side: "right", scale: 1.35 } }),
  "b3-arabic": phone({ img: uri(path.join(VG, "c-language.png")) }),
  // Slide C — priority loop
  "c1-tag": browser({ img: uri(path.join(VG, "d-priority-flag.png")), w: 1440, h: 800, url: "terra.foad.dev/dashboard", crop: { x: 690, y: 150, w: 700, h: 470 } }),
  "c2-phone": phone({ img: uri(path.join(CAP, "p-phone.png")), callout: { x: 40, y: 350, w: 240, h: 180, side: "left", scale: 1.4 } }),
  // Slide D — time sequence (map + timeline crops, 2x captures shown at 1120x820)
  ...Object.fromEntries(["t-3h", "t-6h", "t-24h", "t-all"].map((t) => [`d-${t}`, panel({ img: uri(path.join(CAP, `${t}.png`)), w: 1120, h: 820 })])),
  // Slide E — spin-up
  "e1-editor": browser({ img: uri(path.join(VG, "a-editor.png")), w: 1440, h: 800, url: "terra.foad.dev/admin/crises", crop: { x: 260, y: 0, w: 920, h: 800 } }),
  "e2-kit": browser({ img: uri(path.join(VG, "a-cak.png")), w: 1440, h: 800, url: "terra.foad.dev/admin/crises", crop: { x: 330, y: 0, w: 780, h: 800 } }),
  "e3-crises": browser({ img: uri(path.join(VG, "a-multicrisis.png")), w: 1440, h: 800, url: "terra.foad.dev/admin/crises", crop: { x: 120, y: 60, w: 1060, h: 260 } }),
});

const GUIDES = () => ({
  // Reporter guide (phones)
  "r1-open": phone({ img: uri(path.join(VG, "c-initial.png")) }),
  "r1-language": phone({ img: uri(path.join(VG, "c-language.png")) }),
  "r2-building": phone({ img: uri(path.join(VG, "c-building.png")), callout: { x: 4, y: 728, w: 320, h: 40, side: "right", scale: 1.5 } }),
  "r2-landmark": phone({ img: uri(path.join(VG, "c-landmark.png")), callout: { x: 6, y: 640, w: 370, h: 115, side: "right", scale: 1.35 } }),
  "r2-priority": phone({ img: uri(path.join(CAP, "p-phone.png")), callout: { x: 40, y: 350, w: 240, h: 180, side: "right", scale: 1.4 } }),
  "r4-damage": phone({ img: uri(path.join(VG, "c-photo-ai.png")), callout: { x: 8, y: 360, w: 272, h: 92, side: "right", scale: 1.55 } }),
  "r5-survey": phone({ img: uri(path.join(VG, "c-survey.png")) }),
  "r6-submitted": phone({ img: uri(path.join(VG, "c-confirm.png")) }),
  "r6-queued": phone({ img: uri(path.join(VG, "c-offline.png")) }),
  // Analyst guide (browser windows)
  "a1-dashboard": browser({ img: uri(path.join(VG, "d-default.png")), w: 1440, h: 800, url: "terra.foad.dev/dashboard" }),
  "a2-area": browser({ img: uri(path.join(VG, "d-polygon.png")), w: 1440, h: 800, url: "terra.foad.dev/dashboard" }),
  "a3-timeslider": browser({ img: uri(path.join(CAP, "t-6h.png")), w: 1120, h: 820, url: "terra.foad.dev/dashboard" }),
  "a4-review": browser({ img: uri(path.join(VG, "d-review.png")), w: 1440, h: 800, url: "terra.foad.dev/dashboard", crop: { x: 440, y: 40, w: 560, h: 760 } }),
  "a5-translation": browser({ img: uri(path.join(VG, "d-translation.png")), w: 1440, h: 800, url: "terra.foad.dev/dashboard", crop: { x: 440, y: 40, w: 560, h: 760 } }),
  "a6-priority": browser({ img: uri(path.join(VG, "d-priority-flag.png")), w: 1440, h: 800, url: "terra.foad.dev/dashboard", crop: { x: 690, y: 150, w: 700, h: 470 } }),
  // Deployment runbook (browser windows)
  "d1-crises": browser({ img: uri(path.join(VG, "a-crises.png")), w: 1440, h: 800, url: "terra.foad.dev/admin/crises", crop: { x: 120, y: 0, w: 1180, h: 330 } }),
  "d2-editor": browser({ img: uri(path.join(VG, "a-editor.png")), w: 1440, h: 800, url: "terra.foad.dev/admin/crises", crop: { x: 260, y: 0, w: 920, h: 800 } }),
  "d3-kit": browser({ img: uri(path.join(VG, "a-cak.png")), w: 1440, h: 800, url: "terra.foad.dev/admin/crises", crop: { x: 330, y: 0, w: 780, h: 800 } }),
});

const JOBS = SET === "pitch" ? PITCH() : GUIDES();

const only = process.argv[3];
const b = await chromium.launch({ headless: true, channel: "chrome" });
const page = await (await b.newContext({ deviceScaleFactor: 2 })).newPage();
for (const [name, svg] of Object.entries(JOBS)) {
  if (only && !name.startsWith(only)) continue;
  const m = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  await page.setViewportSize({ width: Math.ceil(+m[1]), height: Math.ceil(+m[2]) });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: true, clip: { x: 0, y: 0, width: +m[1], height: +m[2] } });
  console.log("rendered", name);
}
await b.close();
