import { expect, test } from "@playwright/test";
import { completeReportFlow, stubNonReportsApi } from "./helpers";

test("three offline reports all sync after reconnect", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    geolocation: { latitude: 36.2, longitude: 36.16 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();

  await stubNonReportsApi(page, testInfo);

  let postCount = 0;
  await page.route("**/reports", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    postCount++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: `id-${postCount}`,
        status: "created",
        area_report_count: postCount,
        version_chain_id: `chain-${postCount}`,
      }),
    });
  });

  // Install + activate service worker
  await page.goto("/");
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 15000 });
  await page.waitForTimeout(3000);

  await context.setOffline(true);

  for (let i = 1; i <= 3; i++) {
    await completeReportFlow(page);
    await expect(page.getByText("Report Queued")).toBeVisible();
  }

  await context.setOffline(false);
  // The connectivity hook does a /health verify before kicking off sync, so
  // poll postCount rather than relying on the "Syncing" text appearing first.
  await expect.poll(() => postCount, { timeout: 30000 }).toBe(3);

  await context.close();
});
