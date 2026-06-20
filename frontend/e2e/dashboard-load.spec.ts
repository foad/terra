import { expect, test } from "@playwright/test";
import { postE2EReport, setupDashboard } from "./helpers";

test("write tagged report, dashboard read returns it, delete cleans up", async ({
  page,
}, testInfo) => {
  const { prefix, coord, cleanup } = await setupDashboard(page, testInfo);

  try {
    await postE2EReport(prefix, {
      ...coord(36.21, 36.16),
      damage_level: "complete",
      infrastructure_type: [
        "Residential Infrastructure (Houses and apartments)",
      ],
      crisis_nature: ["Earthquake"],
    });
    await postE2EReport(prefix, {
      ...coord(36.21, 36.17),
      damage_level: "partial",
      infrastructure_type: [
        "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)",
      ],
      crisis_nature: ["Earthquake"],
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("stat-complete")).toHaveText("1");
    await expect(page.getByTestId("stat-partial")).toHaveText("1");
  } finally {
    await cleanup();
  }
});
