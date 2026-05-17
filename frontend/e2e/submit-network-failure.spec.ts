import { expect, test } from "@playwright/test";
import { completeReportFlow, stubNonReportsApi } from "./helpers";

test("POST /reports failure is retried until it succeeds", async ({
  page,
}) => {
  await stubNonReportsApi(page);

  // First POST /reports fails (network error). Subsequent ones succeed.
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
        id: "test-id",
        status: "created",
        area_report_count: 1,
        version_chain_id: "chain-1",
      }),
    });
  });

  await page.goto("/");
  await completeReportFlow(page, { description: "Submit retry test" });

  // Sync engine retries on transient failure with exponential backoff
  // (starting at 2 s). Poll until we've seen the second (successful) POST.
  await expect.poll(() => postCount, { timeout: 30000 }).toBeGreaterThanOrEqual(
    2,
  );
});
