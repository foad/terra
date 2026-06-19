import { expect, test } from "@playwright/test";
import { postE2EReport, setupDashboard } from "./helpers";

test("CSV and GeoJSON exports both download", async ({ page }, testInfo) => {
  const { prefix, cleanup } = await setupDashboard(page, testInfo);
  try {
    await postE2EReport(prefix, {
      latitude: 36.20,
      longitude: 36.15,
      damage_level: "complete",
      infrastructure_type: ["Residential Infrastructure (Houses and apartments)"],
      crisis_nature: ["Earthquake"],
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-complete")).toHaveText("1");

    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /^CSV$/ }).click();
    const csv = await csvDownload;
    expect(csv.suggestedFilename()).toMatch(/\.csv$/);

    const geoDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /^GeoJSON$/ }).click();
    const geo = await geoDownload;
    expect(geo.suggestedFilename()).toMatch(/\.geojson$/);
  } finally {
    await cleanup();
  }
});
