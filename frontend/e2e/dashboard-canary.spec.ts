import { expect, test } from "@playwright/test";
import { signInAsAnalyst } from "./auth";
import { deleteE2EReports, e2ePrefix, postE2EReport } from "./helpers";

test("write tagged report, dashboard read returns it, delete cleans up", async ({
  page,
}, testInfo) => {
  const prefix = e2ePrefix(testInfo);
  const { accessToken } = await signInAsAnalyst(page);

  const ids: string[] = [];
  try {
    ids.push(
      await postE2EReport(prefix, {
        latitude: 36.21,
        longitude: 36.16,
        damage_level: "complete",
        infrastructure_type: ["Residential Infrastructure (Houses and apartments)"],
        crisis_nature: ["Earthquake"],
      }),
    );
    ids.push(
      await postE2EReport(prefix, {
        latitude: 36.21,
        longitude: 36.17,
        damage_level: "partial",
        infrastructure_type: ["Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)"],
        crisis_nature: ["Earthquake"],
      }),
    );

    await page.addInitScript((p) => {
      (globalThis as unknown as { __E2E_PREFIX__: string }).__E2E_PREFIX__ = p;
    }, prefix);

    await page.goto("/dashboard");

    await expect(page.getByTestId("stat-complete")).toHaveText("1");
    await expect(page.getByTestId("stat-partial")).toHaveText("1");
  } finally {
    const deleted = await deleteE2EReports(prefix, accessToken);
    expect(deleted).toBeGreaterThanOrEqual(ids.length);
  }
});
