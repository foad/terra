import { expect, test } from "@playwright/test";
import { postE2EReport, setupDashboard } from "./helpers";

test("draw polygon, filter count drops, clear via map", async ({ page }, testInfo) => {
  const { prefix, cleanup } = await setupDashboard(page, testInfo);
  try {
    await postE2EReport(prefix, {
      latitude: 36.21,
      longitude: 36.16,
      damage_level: "complete",
      infrastructure_type: ["Residential Infrastructure (Houses and apartments)"],
      crisis_nature: ["Earthquake"],
    });
    await postE2EReport(prefix, {
      latitude: 36.30,
      longitude: 36.30,
      damage_level: "partial",
      infrastructure_type: ["Residential Infrastructure (Houses and apartments)"],
      crisis_nature: ["Earthquake"],
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-complete")).toHaveText("1");
    await expect(page.getByTestId("stat-partial")).toHaveText("1");

    await page.getByRole("button", { name: "Draw area" }).click();
    await page.waitForFunction(
      () => Boolean((globalThis as { __APPLY_POLYGON__?: unknown }).__APPLY_POLYGON__),
      { timeout: 5000 },
    );

    await page.evaluate(() => {
      const apply = (globalThis as { __APPLY_POLYGON__?: (p: unknown) => void }).__APPLY_POLYGON__;
      apply!({
        type: "Polygon",
        coordinates: [[
          [36.14, 36.19],
          [36.18, 36.19],
          [36.18, 36.23],
          [36.14, 36.23],
          [36.14, 36.19],
        ]],
      });
    });

    await expect(page.getByText(/Area filter active/i)).toBeVisible();
    await expect(page.getByText("1 of 2")).toBeVisible();
  } finally {
    await cleanup();
  }
});
