import { expect, test } from "@playwright/test";
import { completeReportFlow, stubNonReportsApi } from "./helpers";

test("response lost mid-flight, retry returns duplicate, no double-insert", async ({
  page,
}, testInfo) => {
  await stubNonReportsApi(page, testInfo);

  // Backend processed the first request but the response never reached the
  // client (simulated as an aborted connection). Subsequent retry with the
  // same offline_queue_id gets the dedup-by-offline_queue_id response.
  let postCount = 0;
  await page.route("**/reports", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    postCount++;
    if (postCount === 1) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "existing-id",
        status: "duplicate",
        message: "Report already submitted from offline queue",
      }),
    });
  });

  await page.goto("/");
  await completeReportFlow(page);

  // First POST aborted, second returned `duplicate`. Anything more would be
  // bad — frontend should mark the queue entry synced on the duplicate
  // response and not keep retrying.
  await expect.poll(() => postCount, { timeout: 30000 }).toBe(2);
  await page.waitForTimeout(2000);
  expect(postCount).toBe(2);
});
