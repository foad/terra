import { expect, test } from "@playwright/test";
import { postE2EReport, setupDashboard } from "./helpers";

test("damage, infrastructure type, crisis nature, date range, clear-all", async ({
  page,
}, testInfo) => {
  const { prefix, coord, cleanup } = await setupDashboard(page, testInfo);
  try {
    await postE2EReport(prefix, {
      ...coord(36.2, 36.15),
      damage_level: "complete",
      infrastructure_type: [
        "Residential Infrastructure (Houses and apartments)",
      ],
      crisis_nature: ["Earthquake"],
    });
    await postE2EReport(prefix, {
      ...coord(36.21, 36.16),
      damage_level: "partial",
      infrastructure_type: [
        "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)",
      ],
      crisis_nature: ["Earthquake"],
    });
    await postE2EReport(prefix, {
      ...coord(36.22, 36.17),
      damage_level: "minimal",
      infrastructure_type: [
        "Residential Infrastructure (Houses and apartments)",
      ],
      crisis_nature: ["Hurricane/Cyclone"],
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("stat-complete")).toHaveText("1");
    await expect(page.getByTestId("stat-partial")).toHaveText("1");
    await expect(page.getByTestId("stat-minimal")).toHaveText("1");

    await page.getByRole("button", { name: /^Complete$/ }).click();
    await expect(page.getByTestId("stat-complete")).toHaveText("1");
    await expect(page.getByTestId("stat-partial")).toHaveText("0");
    await expect(page.getByTestId("stat-minimal")).toHaveText("0");

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByTestId("stat-complete")).toHaveText("1");
    await expect(page.getByTestId("stat-partial")).toHaveText("1");
    await expect(page.getByTestId("stat-minimal")).toHaveText("1");
  } finally {
    await cleanup();
  }
});
