#!/usr/bin/env node
/**
 * Pitch-deck captures from the LIVE site — strictly read-only.
 * - Logs in with the public evaluator demo account.
 * - Filters the /reports responses IN THIS BROWSER ONLY to a bounding box, so the
 *   dashboard auto-fits to the area we want (stray test reports elsewhere are hidden).
 *   Nothing is written to the server: no reports, no flags, no edits.
 * Output: scripts/guide-images/.out/captures/*.png at 2x pixel density (override with GUIDE_CAPTURE_DIR).
 *
 * Usage: TERRA_DEMO_PASSWORD=… node scripts/guide-images/capture.mjs [time|heat|priority|phone|all]
 */
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../../frontend/package.json", import.meta.url))("@playwright/test");
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = process.env.GUIDE_CAPTURE_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), ".out", "captures");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "https://terra.foad.dev";
const EMAIL = process.env.TERRA_DEMO_EMAIL || "demo@terra.foad.dev";
const PASS = process.env.TERRA_DEMO_PASSWORD; // evaluator demo password — never commit it
if (!PASS && process.argv[2] !== "phone") {
  console.error("Set TERRA_DEMO_PASSWORD (the evaluator demo account password) to capture dashboard views.");
  process.exit(1);
}
const what = process.argv[2] || "all";

const ANTAKYA = [36.0, 36.07, 36.33, 36.29]; // w,s,e,n — the Antakya crisis polygon bbox
const PRIORITY = [36.1585, 36.2012, 36.1608, 36.2032]; // tight box around the 5 flagged buildings

function filterRoute(ctx, bbox) {
  return ctx.route(/execute-api.*\/reports(\?|$)/, async (route) => {
    const res = await route.fetch();
    let body;
    try { body = await res.json(); } catch { return route.fulfill({ response: res }); }
    if (body && Array.isArray(body.features)) {
      const [w, s, e, n] = bbox;
      body.features = body.features.filter((f) => {
        const [x, y] = f.geometry?.coordinates || [];
        const late = f.properties?.submitted_at && f.properties.submitted_at > "2026-04-15";
        return x >= w && x <= e && y >= s && y <= n && !late;
      });
      if (typeof body.total === "number") body.total = body.features.length;
    }
    return route.fulfill({ response: res, json: body });
  });
}

async function login(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.locator('button:text-is("Sign in")').click();
  await page.locator('input[name="username"]:visible').first().fill(EMAIL);
  await page.locator('input[name="password"]:visible').first().fill(PASS);
  await page.locator('button[type="submit"]:visible').first().click();
  await page.waitForFunction(() => !!document.querySelector(".maplibregl-canvas"), undefined, { timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(5000);
}

async function dashboard(bbox, viewport = { width: 1440, height: 900 }) {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await filterRoute(ctx, bbox);
  const page = await ctx.newPage();
  await login(page);
  return { browser, page };
}

const shot = (page, id, clip) => page.screenshot({ path: path.join(OUT, `${id}.png`), ...(clip ? { clip } : {}) }).then(() => console.log("  📸", id));

async function dragTo(page, frac, wait = 1500) {
  const root = page.locator('[class*="sliderRoot"]').first();
  const thumb = page.locator('[aria-label="To"]').first();
  const rb = await root.boundingBox(); const tb = await thumb.boundingBox();
  const y = tb.y + tb.height / 2;
  await page.mouse.move(tb.x + tb.width / 2, y); await page.mouse.down();
  await page.mouse.move(rb.x + rb.width * frac, y, { steps: 15 }); await page.mouse.up();
  await page.waitForTimeout(wait);
}

async function wheelIn(page, steps, x = 880, y = 440) {
  await page.mouse.move(x, y);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(350); }
  await page.waitForTimeout(2500);
}

const MAP_CLIP = { x: 320, y: 80, width: 1120, height: 820 }; // map + timeline, no sidebar

if (what === "time" || what === "all") {
  console.log("time sequence");
  const { browser, page } = await dashboard(ANTAKYA);
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const parse = (t) => { const m = t.trim().match(/(\d+) (\w+) (\d+):(\d+)/); return new Date(2026, MON[m[2]], +m[1], +m[3], +m[4]).getTime(); };
  const labels = async () => page.evaluate(() => [...document.querySelectorAll('[class*="label"]')].filter((e) => /_label_/.test(e.className)).map((e) => e.innerText.trim()));
  const away = () => page.mouse.move(160, 860);
  await away(); await page.waitForTimeout(800);
  const [fromTxt] = await labels();
  const t0 = parse(fromTxt);
  console.log("  from label:", fromTxt);
  await dragTo(page, 1.0, 600);
  const lab0 = await labels(); const span = (parse(lab0[lab0.length - 1]) - t0) / 3.6e6;
  console.log(`  span ${span.toFixed(1)} h`);
  for (const [id, hrs] of [["t-3h", 3], ["t-6h", 6], ["t-24h", 24]]) {
    await dragTo(page, 1.0, 400); await dragTo(page, hrs / span, 1500); await away(); await page.waitForTimeout(800);
    const l = await labels(); console.log(`  ${id}: to=${l[l.length - 1]}`);
    await shot(page, id, MAP_CLIP);
  }
  await dragTo(page, 1.0, 1500); await away(); await page.waitForTimeout(800);
  await shot(page, "t-all", MAP_CLIP);
  await browser.close();
}

if (what === "heat" || what === "all") {
  console.log("heatmap retest");
  const { browser, page } = await dashboard(ANTAKYA);
  await page.locator('button:text-is("Heatmap")').click(); await page.waitForTimeout(2500);
  await shot(page, "h-city", MAP_CLIP);
  await wheelIn(page, 3); await shot(page, "h-district", MAP_CLIP);
  await wheelIn(page, 3); await shot(page, "h-street", MAP_CLIP);
  await page.locator('button:text-is("Both")').click(); await page.waitForTimeout(2500);
  await shot(page, "h-both-street", MAP_CLIP);
  await browser.close();
}

if (what === "priority" || what === "all") {
  console.log("priority (dashboard side)");
  const { browser, page } = await dashboard(PRIORITY);
  await wheelIn(page, 2, 899, 501); await page.mouse.move(160, 860); await page.waitForTimeout(1500);
  await shot(page, "p-dash-close", MAP_CLIP);
  await wheelIn(page, 1, 899, 501); await page.mouse.move(160, 860); await page.waitForTimeout(1500);
  await shot(page, "p-dash-closer", MAP_CLIP);
  await browser.close();
}

if (what === "phone" || what === "all") {
  console.log("priority (phone side)");
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    geolocation: { latitude: 36.2022, longitude: 36.1597 }, permissions: ["geolocation"],
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector(".maplibregl-canvas"), undefined, { timeout: 30_000 });
  await page.waitForTimeout(9000);
  await shot(page, "p-phone");
  await browser.close();
}
console.log("done");
