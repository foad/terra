import { expect, test } from "@playwright/test";
import { setupDashboard } from "./helpers";

test("collapse hides sidebar, statsBar expand restores", async ({
  page,
}, testInfo) => {
  const { cleanup } = await setupDashboard(page, testInfo);
  try {
    await page.goto("/dashboard");

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(sidebar).toHaveCount(0);

    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(sidebar).toBeVisible();
  } finally {
    await cleanup();
  }
});
