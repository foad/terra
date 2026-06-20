import { test, expect } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_PHOTO = join(__dirname, "fixtures", "test-photo.jpg");

// Playwright default geolocation is (36.2, 36.16) — h3 r8 cell for that point.
// survey-prefs.ts keys by this cell, so the seeded prefs must match.
const H3_CELL = "882da1666bfffff";

test("survey pre-populates from AI, active crisis, and prior submission", async ({
  page,
}) => {
  await page.addInitScript((cell: string) => {
    localStorage.setItem(
      "terra-survey-prefs",
      JSON.stringify({
        [cell]: {
          debrisPresent: true,
          electricityStatus:
            "Severe damage (major infrastructure damaged, prolonged outages)",
          healthStatus: "Partially functional",
          pressingNeeds: ["Food assistance and safe drinking water"],
          savedAt: "2026-05-01T00:00:00.000Z",
        },
      }),
    );
  }, H3_CELL);

  await page.route("**/crisis-events/active*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000001",
        name: "E2E Test Crisis",
        crisis_type: "Earthquake",
      }),
    }),
  );

  await page.route("**/photos/upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo_key: "uploads/00000000-0000-0000-0000-000000000000.jpg",
        upload_url: "https://example.invalid/upload",
      }),
    }),
  );
  await page.route("https://example.invalid/upload", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );

  await page.route("**/photos/classify", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        damage_level: "partial",
        damage_confidence: 0.9,
        infrastructure_type: ["residential"],
        infrastructure_confidence: 0.9,
      }),
    }),
  );

  await page.goto("/");
  await expect(page.getByTestId("step-location")).toBeVisible({
    timeout: 15000,
  });

  // Drop the pin just off the map centre (the mocked GPS point). A small
  // offset clears the GPS location marker that sits dead-centre; at zoom 18
  // it's still metres away, well within the same H3 r8 cell the seeded
  // survey-prefs are keyed to.
  await page.waitForTimeout(3000);
  const canvas = page.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas not found");
  await canvas.click({
    position: { x: box.width / 2 + 40, y: box.height / 2 },
  });
  await expect(page.getByTestId("btn-next")).not.toHaveClass(/disabled/, {
    timeout: 5000,
  });
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("step-photo")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO);
  await expect(page.getByTestId("photo-uploaded")).toBeVisible({
    timeout: 15000,
  });
  await page.getByTestId("btn-next").click();

  // Damage: AI pre-selected "partial" with 90% confidence badge.
  await expect(page.getByTestId("step-damage")).toBeVisible();
  const partialCard = page.getByTestId("damage-partial");
  await expect(partialCard).toHaveAttribute("aria-pressed", "true");
  await expect(partialCard).toContainText("90%");
  await page.getByTestId("btn-next").click();

  // Survey step 0 — infrastructure type from AI.
  await expect(page.getByTestId("survey-step-0")).toBeVisible();
  await expect(
    page.locator(
      "#infra-Residential\\ Infrastructure\\ \\(Houses\\ and\\ apartments\\)",
    ),
  ).toBeChecked();
  await page.getByTestId("btn-next").click();

  // Survey step 1 — infrastructure name (no pre-fill, skip).
  await expect(page.getByTestId("survey-step-1")).toBeVisible();
  await page.getByTestId("btn-next").click();

  // Survey step 2 — crisis nature from active crisis lookup.
  await expect(page.getByTestId("survey-step-2")).toBeVisible();
  await expect(page.locator("#crisis-Earthquake")).toBeChecked();
  await page.getByTestId("btn-next").click();

  // Survey step 3 — debris from prior submission prefs.
  await expect(page.getByTestId("survey-step-3")).toBeVisible();
  await expect(page.locator("#debris-yes")).toBeChecked();
  await page.getByTestId("btn-next").click();

  // Survey step 4 — electricity from prior submission prefs.
  await expect(page.getByTestId("survey-step-4")).toBeVisible();
  await expect(
    page.locator(
      "#elec-Severe\\ damage\\ \\(major\\ infrastructure\\ damaged\\,\\ prolonged\\ outages\\)",
    ),
  ).toBeChecked();
  await page.getByTestId("btn-next").click();

  // Survey step 5 — health from prior submission prefs.
  await expect(page.getByTestId("survey-step-5")).toBeVisible();
  await expect(page.locator("#health-Partially\\ functional")).toBeChecked();
  await page.getByTestId("btn-next").click();

  // Survey step 6 — pressing needs from prior submission prefs.
  await expect(page.getByTestId("survey-step-6")).toBeVisible();
  await expect(
    page.locator("#need-Food\\ assistance\\ and\\ safe\\ drinking\\ water"),
  ).toBeChecked();
});
