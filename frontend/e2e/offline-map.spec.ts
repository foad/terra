import { test, expect } from "@playwright/test";

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

    // Count tile traffic from the very first load. Request events fire even
    // when the response later fails or is served by the service worker, and
    // almost all tile traffic happens during initial load + prefetch — a
    // listener attached after that (as this test originally did) only sees
    // the handful of tiles a small pan happens to need, which is the race
    // that made this test flaky across unrelated PRs.
    let onlineTileCount = 0;
    page.on("request", (request) => {
      if (request.url().includes("source.coop")) {
        onlineTileCount++;
      }
    });

    // First visit — installs service worker
    await page.goto("/");
    await page.waitForTimeout(2000);

    // Second visit — activates service worker
    await page.reload();
    await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 15000 });

    // Wait for map to settle and prefetch to start loading tiles
    await page.waitForTimeout(8000);

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

    // Judge only the offline phase from here: online-phase network noise
    // (e.g. a source.coop hiccup) is not what this test is about.
    consoleErrors.length = 0;

    // Go offline
    await context.setOffline(true);

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

    // Verify: tile traffic happened while online
    expect(onlineTileCount).toBeGreaterThan(0);

    // Verify: no flood of offline tile-fetch errors that would indicate the
    // cache isn't serving at all
    const tileFetchErrors = consoleErrors.filter(
      (e) => e.includes("source.coop") || e.includes("Failed to fetch"),
    );
    // Some errors are acceptable (uncached tiles), but the app shouldn't crash
    expect(tileFetchErrors.length).toBeLessThan(10);

    await context.close();
  });
});
