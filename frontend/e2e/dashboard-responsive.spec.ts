import { expect, test } from "@playwright/test";
import { setupDashboard } from "./helpers";

test.use({ viewport: { width: 900, height: 1100 } });

test("tablet width: hamburger menu opens, sidebar floats over map", async ({
  page,
}, testInfo) => {
  const { cleanup } = await setupDashboard(page, testInfo);
  try {
    await page.goto("/dashboard");

    const hamburger = page.getByRole("button", { name: "Toggle navigation menu" });
    await expect(hamburger).toBeVisible();

    await hamburger.click();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Crisis Management" })).toBeVisible();

    const sidebar = page.locator("aside");
    const box = await sidebar.boundingBox();
    expect(box?.x).toBe(0);
  } finally {
    await cleanup();
  }
});
