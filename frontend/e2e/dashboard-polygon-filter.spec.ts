import { expect, test } from "@playwright/test";
import { postE2EReport, setupDashboard } from "./helpers";

test("draw polygon, filter count drops, clear via map", async ({
  page,
}, testInfo) => {
  const { prefix, coord, cleanup } = await setupDashboard(page, testInfo);
  try {
    const inside = coord(36.21, 36.16);
    const outside = coord(36.3, 36.3);
    await postE2EReport(prefix, {
      ...inside,
      damage_level: "complete",
      infrastructure_type: [
        "Residential Infrastructure (Houses and apartments)",
      ],
      crisis_nature: ["Earthquake"],
    });
    await postE2EReport(prefix, {
      ...outside,
      damage_level: "partial",
      infrastructure_type: [
        "Residential Infrastructure (Houses and apartments)",
      ],
      crisis_nature: ["Earthquake"],
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-complete")).toHaveText("1");
    await expect(page.getByTestId("stat-partial")).toHaveText("1");

    await page.getByRole("button", { name: "Draw area" }).click();
    await page.waitForFunction(
      () =>
        Boolean(
          (globalThis as { __APPLY_POLYGON__?: unknown }).__APPLY_POLYGON__,
        ),
      { timeout: 5000 },
    );

    // Polygon that contains `inside` but not `outside`.
    const halo = 0.02;
    await page.evaluate(
      ({ lng, lat, halo }) => {
        const apply = (
          globalThis as { __APPLY_POLYGON__?: (p: unknown) => void }
        ).__APPLY_POLYGON__;
        apply!({
          type: "Polygon",
          coordinates: [
            [
              [lng - halo, lat - halo],
              [lng + halo, lat - halo],
              [lng + halo, lat + halo],
              [lng - halo, lat + halo],
              [lng - halo, lat - halo],
            ],
          ],
        });
      },
      { lng: inside.longitude, lat: inside.latitude, halo },
    );

    await expect(page.getByText(/Area filter active/i)).toBeVisible();
    await expect(page.getByText("1 of 2")).toBeVisible();
  } finally {
    await cleanup();
  }
});
