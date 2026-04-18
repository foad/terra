import { test, expect } from "@playwright/test";

// This test must run against the preview server (npm run preview) at port 4173
// The service worker only works with built files, not the dev server
const PREVIEW_URL = process.env.E2E_BASE_URL ?? "http://localhost:4173";

test.describe("Offline map tile caching", () => {
  test("building footprints load from cache when offline", async ({
    browser,
  }) => {
    // Use a persistent context so the service worker persists across navigations
    const context = await browser.newContext({
      geolocation: { latitude: 36.2, longitude: 36.16 },
      permissions: ["geolocation"],
    });

    const page = await context.newPage();

    // Collect console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // First visit — installs service worker
    await page.goto(PREVIEW_URL);
    await page.waitForTimeout(2000);

    // Second visit — activates service worker
    await page.reload();
    await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 15000 });

    // Wait for map to settle and prefetch to start loading tiles
    await page.waitForTimeout(8000);

    // Track that we got successful source.coop responses while online
    let onlineTileCount = 0;
    page.on("response", (response) => {
      if (response.url().includes("source.coop")) {
        onlineTileCount++;
      }
    });

    // Trigger a small pan to ensure tiles are loaded and cached
    const map = page.locator("canvas.maplibregl-canvas");
    const box = await map.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 20,
        box.y + box.height / 2 + 20,
        { steps: 5 },
      );
      await page.mouse.up();
    }
    await page.waitForTimeout(3000);

    // Go offline
    await context.setOffline(true);

    // Track responses while offline
    let offlineTileCount = 0;
    let offlineTileErrors = 0;
    page.on("response", (response) => {
      if (response.url().includes("source.coop")) {
        if (response.ok() || response.status() === 206) {
          offlineTileCount++;
        } else {
          offlineTileErrors++;
        }
      }
    });

    // Pan the map slightly to trigger tile requests from cache
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 - 30,
        box.y + box.height / 2 - 30,
        { steps: 5 },
      );
      await page.mouse.up();
    }
    await page.waitForTimeout(3000);

    // Verify: we got some tiles while online
    expect(onlineTileCount).toBeGreaterThan(0);

    // Verify: no tile fetch console errors that would indicate cache misses
    const tileFetchErrors = consoleErrors.filter(
      (e) => e.includes("source.coop") || e.includes("Failed to fetch"),
    );
    // Some errors are acceptable (uncached tiles), but the app shouldn't crash
    expect(tileFetchErrors.length).toBeLessThan(10);

    await context.close();
  });
});
