import { expect, test } from "@playwright/test";
import { postE2EReport, setupDashboard } from "./helpers";

test("click marker, detail panel opens, modal shows report", async ({
  page,
}, testInfo) => {
  const { prefix, coord, cleanup } = await setupDashboard(page, testInfo);
  try {
    const c = coord(36.21, 36.16);
    await postE2EReport(prefix, {
      ...c,
      damage_level: "complete",
      infrastructure_type: [
        "Residential Infrastructure (Houses and apartments)",
      ],
      crisis_nature: ["Earthquake"],
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-complete")).toHaveText("1");

    const canvas = page.locator(".maplibregl-canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas not visible");

    await page.waitForFunction(
      () => {
        const map = (
          globalThis as {
            __MAP__?: {
              isStyleLoaded: () => boolean;
              queryRenderedFeatures: (opts: { layers: string[] }) => unknown[];
            };
          }
        ).__MAP__;
        return (
          map?.isStyleLoaded() &&
          map.queryRenderedFeatures({ layers: ["report-markers"] }).length > 0
        );
      },
      { timeout: 10000 },
    );

    const point = await page.evaluate(
      ([lng, lat]) => {
        const map = (
          globalThis as {
            __MAP__?: {
              project: (c: [number, number]) => { x: number; y: number };
            };
          }
        ).__MAP__;
        if (!map) throw new Error("__MAP__ not exposed");
        return map.project([lng, lat]);
      },
      [c.longitude, c.latitude],
    );
    await canvas.click({ position: { x: point.x, y: point.y } });

    await expect(
      page.getByRole("heading", { name: /Report Detail/i }),
    ).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /^Details$/ }).click();
    await expect(
      page.getByRole("heading", { name: /Report details/i }),
    ).toBeVisible();
  } finally {
    await cleanup();
  }
});
