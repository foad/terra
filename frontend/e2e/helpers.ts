import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const TEST_PHOTO = join(__dirname, "fixtures", "test-photo.jpg");

/**
 * Stub everything except POST /reports so tests don't hit the real backend
 * (no Bedrock calls, no S3 photo uploads, no synthetic data in prod).
 * Tests retain control over POST /reports via their own `page.route` calls
 * registered AFTER this helper.
 */
export async function stubNonReportsApi(page: Page): Promise<void> {
  await page.route("**/photos/upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        photo_key: `uploads/${randomUUID()}.jpg`,
        upload_url: "/__e2e_fake_upload__",
      }),
    }),
  );
  await page.route("**/__e2e_fake_upload__", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await page.route("**/photos/classify", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "stubbed" }),
    }),
  );
  await page.route("**/crisis-events/active**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "stubbed" }),
    }),
  );
}

/**
 * Set the report location by dropping a pin on the map and advance to the
 * photo step. The location step stays disabled until a building is tapped or a
 * pin is placed; clicking empty map drops a draggable pin. Assumes the caller
 * is already on (or has just navigated to) the location step.
 */
export async function selectLocation(page: Page): Promise<void> {
  await expect(page.getByTestId("step-location")).toBeVisible({
    timeout: 15000,
  });
  // Let the map settle after the fly-to before clicking.
  await page.waitForTimeout(3000);
  await page
    .locator(".maplibregl-canvas")
    .click({ position: { x: 200, y: 250 } });
  await expect(page.getByTestId("btn-next")).not.toHaveClass(/disabled/, {
    timeout: 5000,
  });
  await page.getByTestId("btn-next").click();
}

/**
 * Run through the full submission flow from the location step (or via the
 * "Submit Another" button if already on the confirmation step) to the
 * confirmation. Caller is responsible for navigating to / waiting for SW.
 */
export async function completeReportFlow(page: Page): Promise<void> {
  // If we're on the confirmation step, bounce back to location first.
  const onConfirmation = await page
    .getByTestId("step-confirmation")
    .isVisible()
    .catch(() => false);
  if (onConfirmation) {
    await page.getByRole("button", { name: /submit another/i }).click();
  }

  await selectLocation(page);

  await expect(page.getByTestId("step-photo")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO);
  await expect(page.getByTestId("photo-uploaded")).toBeVisible({
    timeout: 15000,
  });
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("step-damage")).toBeVisible();
  await page.getByTestId("damage-partial").click();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-0")).toBeVisible();
  await page
    .locator(
      "#infra-Residential\\ Infrastructure\\ \\(Houses\\ and\\ apartments\\)",
    )
    .check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-1")).toBeVisible();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-2")).toBeVisible();
  await page.locator("#crisis-Earthquake").check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-3")).toBeVisible();
  await page.locator("#debris-yes").check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-4")).toBeVisible();
  await page.locator("#elec-No\\ damage\\ observed").check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-5")).toBeVisible();
  await page.locator("#health-Fully\\ functional").check();
  await page.getByTestId("btn-next").click();

  await expect(page.getByTestId("survey-step-6")).toBeVisible();
  await page
    .locator("#need-Food\\ assistance\\ and\\ safe\\ drinking\\ water")
    .check();
  await page.getByTestId("btn-submit").click();

  await expect(page.getByTestId("step-confirmation")).toBeVisible({
    timeout: 15000,
  });
}
